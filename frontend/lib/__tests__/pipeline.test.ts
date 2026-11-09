import { describe, expect, it } from "vitest";

import {
  computeFingerprint,
  decryptEnvelope,
  encryptEnvelope,
  randomSalt,
  toHex,
} from "../crypto";
import { combineKey, splitKey } from "../shamir";
import { encodeShare, inspectShares } from "../shareFormat";

/**
 * The whole product in one test: what /setup does, then what the Unlock tab
 * does, and the claim the project is built on — that a swapped file fails.
 */
describe("owner -> guardians -> unlock", () => {
  const original = new TextEncoder().encode(
    "The documents. Publish if I go dark.\n",
  );

  async function createSwitch(content: Uint8Array) {
    const salt = randomSalt();
    const fingerprint = await computeFingerprint(salt, content); // goes on-chain
    const { blob, keyHex } = await encryptEnvelope({
      fileName: "leak.txt",
      salt,
      content,
    });
    const shares = await splitKey(keyHex, 3, 2); // one per guardian
    return { fingerprint, blob, shares };
  }

  it("two guardians recover the exact original and it verifies", async () => {
    const { fingerprint, blob, shares } = await createSwitch(original);

    const key = await combineKey([shares[2], shares[0]]);
    const envelope = await decryptEnvelope(blob, key);
    const recomputed = await computeFingerprint(
      envelope.salt,
      envelope.content,
    );

    expect(toHex(envelope.content)).toBe(toHex(original));
    expect(envelope.fileName).toBe("leak.txt");
    expect(recomputed).toBe(fingerprint);
  });

  it("a substituted file fails verification", async () => {
    const { fingerprint } = await createSwitch(original);

    // An attacker encrypts different contents and serves those instead.
    const forged = new TextEncoder().encode(
      "The documents. (quietly edited)\n",
    );
    const salt = randomSalt();
    const { blob, keyHex } = await encryptEnvelope({
      fileName: "leak.txt",
      salt,
      content: forged,
    });
    const envelope = await decryptEnvelope(blob, keyHex);
    const recomputed = await computeFingerprint(
      envelope.salt,
      envelope.content,
    );

    expect(recomputed).not.toBe(fingerprint);
  });

  it("one guardian acting alone cannot open the file", async () => {
    const { blob, shares } = await createSwitch(original);
    const key = await combineKey([shares[0]]).catch(() => null);
    if (key === null) return; // refused outright, which is also correct
    await expect(decryptEnvelope(blob, key)).rejects.toThrow();
  });

  describe("tagged shares", () => {
    const SWITCH = "0x72e2bd7cbaf87c2e6168ae9ecec0311b95174c83";
    const OTHER = "0x1111111111111111111111111111111111111111";

    async function taggedSwitch() {
      const salt = randomSalt();
      const fingerprint = await computeFingerprint(salt, original);
      const { blob, keyHex } = await encryptEnvelope({
        fileName: "leak.txt",
        salt,
        content: original,
      });
      const shares = (await splitKey(keyHex, 3, 2)).map((shareHex) =>
        encodeShare({
          threshold: 2,
          total: 3,
          switchAddress: SWITCH,
          fingerprint: "",
          shareHex,
        }),
      );
      return { fingerprint, blob, shares };
    }

    it("unlocks from tagged shares and reports the right threshold", async () => {
      const { fingerprint, blob, shares } = await taggedSwitch();

      const report = inspectShares([shares[0], shares[2]], SWITCH);
      expect(report.threshold).toBe(2);
      expect(report.foreign).toBe(0);
      expect(report.invalid).toBe(0);

      const key = await combineKey(report.parsed.map((p) => p.shareHex));
      const envelope = await decryptEnvelope(blob, key);
      expect(await computeFingerprint(envelope.salt, envelope.content)).toBe(
        fingerprint,
      );
    });

    it("rejects a share belonging to a different switch", async () => {
      const { shares } = await taggedSwitch();
      const stray = encodeShare({
        threshold: 2,
        total: 3,
        switchAddress: OTHER,
        fingerprint: "",
        shareHex: "aabbcc",
      });
      const report = inspectShares([shares[0], stray], SWITCH);
      expect(report.foreign).toBe(1);
      expect(report.parsed).toHaveLength(1); // not enough to try decrypting
    });

    it("spots the same share pasted twice", async () => {
      const { shares } = await taggedSwitch();
      const report = inspectShares([shares[1], shares[1]], SWITCH);
      expect(report.duplicates).toBe(1);
    });
  });
});
