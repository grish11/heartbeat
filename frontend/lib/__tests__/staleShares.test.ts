import { describe, expect, it } from "vitest";

import {
  computeFingerprint,
  decryptEnvelope,
  encryptEnvelope,
  randomSalt,
} from "../crypto";
import { combineKey, splitKey } from "../shamir";
import { encodeShare, inspectShares } from "../shareFormat";

const SWITCH = "0x1c46e3001fea1197c9bb4d2aad2f8f379150e56c";

async function roundTrip(bytes: Uint8Array, guardians = 3, threshold = 2) {
  const salt = randomSalt();
  const fingerprint = await computeFingerprint(salt, bytes);
  const { blob, keyHex } = await encryptEnvelope({
    fileName: "pop.txt",
    salt,
    content: bytes,
  });

  const tagged = (await splitKey(keyHex, guardians, threshold)).map(
    (shareHex) =>
      encodeShare({
        threshold,
        total: guardians,
        switchAddress: SWITCH,
        fingerprint: "",
        shareHex,
      }),
  );

  const report = inspectShares(tagged, SWITCH);
  const rebuilt = await combineKey(report.parsed.map((p) => p.shareHex));
  const envelope = await decryptEnvelope(blob, rebuilt);
  const recomputed = await computeFingerprint(envelope.salt, envelope.content);

  return { report, rebuilt, keyHex, recomputed, fingerprint };
}

describe("setup -> unlock with ALL shares pasted", () => {
  it("works for a normal file", async () => {
    const r = await roundTrip(new TextEncoder().encode("secret document\n"));
    expect(r.rebuilt).toBe(r.keyHex);
    expect(r.recomputed).toBe(r.fingerprint);
  });

  it("works for an EMPTY file", async () => {
    const r = await roundTrip(new Uint8Array(0));
    expect(r.rebuilt).toBe(r.keyHex);
    expect(r.recomputed).toBe(r.fingerprint);
  });

  it("parses all 3 tagged shares with threshold 2", async () => {
    const r = await roundTrip(new TextEncoder().encode("x"));
    expect(r.report.parsed).toHaveLength(3);
    expect(r.report.threshold).toBe(2);
    expect(r.report.duplicates).toBe(0);
    expect(r.report.foreign).toBe(0);
    expect(r.report.invalid).toBe(0);
  });
});

describe("shares from an earlier switch at the same address", () => {
  it("are rejected before decryption is attempted", () => {
    // Anvil derives addresses from sender+nonce, so restarting it and
    // redeploying puts a NEW switch at an address an OLD one already used.
    // Address alone cannot catch that; the fingerprint can.
    const oldShare = encodeShare({
      threshold: 2,
      total: 3,
      switchAddress: SWITCH,
      fingerprint: "aaaaaaaaaa", // old file
      shareHex: "deadbeef",
    });

    const report = inspectShares([oldShare], SWITCH, "0xbbbbbbbbbb0000");

    expect(report.staleFingerprint).toBe(1);
    expect(report.parsed).toHaveLength(0);
    expect(report.foreign).toBe(0); // the address matched — only the file differs
  });

  it("still accepts shares whose fingerprint matches", () => {
    const share = encodeShare({
      threshold: 2,
      total: 3,
      switchAddress: SWITCH,
      fingerprint: "bbbbbbbbbb",
      shareHex: "deadbeef",
    });

    const report = inspectShares([share], SWITCH, "0xbbbbbbbbbb0000");

    expect(report.staleFingerprint).toBe(0);
    expect(report.parsed).toHaveLength(1);
  });
});
