import { describe, expect, it } from "vitest";

import {
  computeFingerprint,
  decryptEnvelope,
  encryptEnvelope,
  fromHex,
  randomSalt,
  toHex,
} from "../crypto";

const text = (s: string) => new TextEncoder().encode(s);

describe("hex helpers", () => {
  it("round-trips", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(toHex(bytes)).toBe("00010f10ff");
    expect(fromHex("00010f10ff")).toEqual(bytes);
  });

  it("accepts a 0x prefix", () => {
    expect(fromHex("0xff00")).toEqual(new Uint8Array([255, 0]));
  });

  it("rejects malformed input rather than returning garbage", () => {
    expect(() => fromHex("abc")).toThrow(/odd length/i);
    expect(() => fromHex("zz")).toThrow(/non-hex/i);
  });
});

describe("computeFingerprint", () => {
  it("produces a 0x-prefixed 32-byte value, the shape bytes32 needs", async () => {
    const print = await computeFingerprint(randomSalt(), text("hello"));
    expect(print).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic for the same salt and content", async () => {
    const salt = randomSalt();
    const a = await computeFingerprint(salt, text("same"));
    const b = await computeFingerprint(salt, text("same"));
    expect(a).toBe(b);
  });

  it("changes when a single byte of content changes", async () => {
    const salt = randomSalt();
    const a = await computeFingerprint(salt, text("report v1"));
    const b = await computeFingerprint(salt, text("report v2"));
    expect(a).not.toBe(b);
  });

  it("changes with the salt, so identical files are not recognisable", async () => {
    const content = text("a well-known public document");
    const a = await computeFingerprint(randomSalt(), content);
    const b = await computeFingerprint(randomSalt(), content);
    expect(a).not.toBe(b);
  });

  it("matches sha256(salt || content) computed independently", async () => {
    const salt = randomSalt();
    const content = text("verify me");
    const joined = new Uint8Array([...salt, ...content]);
    const expected = toHex(
      new Uint8Array(await crypto.subtle.digest("SHA-256", joined)),
    );
    expect(await computeFingerprint(salt, content)).toBe(`0x${expected}`);
  });
});

describe("encrypt / decrypt envelope", () => {
  it("round-trips filename, salt and contents", async () => {
    const salt = randomSalt();
    const content = text("Maya's insurance file");
    const { blob, keyHex } = await encryptEnvelope({
      fileName: "insurance.txt",
      salt,
      content,
    });

    const out = await decryptEnvelope(blob, keyHex);
    expect(out.fileName).toBe("insurance.txt");
    expect(toHex(out.content)).toBe(toHex(content));
    expect(toHex(out.salt)).toBe(toHex(salt));
  });

  it("produces a 32-byte (AES-256) key", async () => {
    const { keyHex } = await encryptEnvelope({
      fileName: "f",
      salt: randomSalt(),
      content: text("x"),
    });
    expect(fromHex(keyHex)).toHaveLength(32);
  });

  it("does not leak the plaintext into the ciphertext", async () => {
    const { blob } = await encryptEnvelope({
      fileName: "secret.txt",
      salt: randomSalt(),
      content: text("ATTACK AT DAWN"),
    });
    const raw = new TextDecoder("latin1").decode(blob);
    expect(raw).not.toContain("ATTACK AT DAWN");
    expect(raw).not.toContain("secret.txt");
  });

  it("uses a fresh key and IV every time", async () => {
    const args = { fileName: "f", salt: randomSalt(), content: text("same") };
    const a = await encryptEnvelope(args);
    const b = await encryptEnvelope(args);
    expect(a.keyHex).not.toBe(b.keyHex);
    expect(toHex(a.blob)).not.toBe(toHex(b.blob));
  });

  it("rejects a tampered file instead of returning garbage", async () => {
    const { blob, keyHex } = await encryptEnvelope({
      fileName: "f",
      salt: randomSalt(),
      content: text("original"),
    });
    const tampered = Uint8Array.from(blob);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(decryptEnvelope(tampered, keyHex)).rejects.toThrow();
  });

  it("rejects the wrong key", async () => {
    const { blob } = await encryptEnvelope({
      fileName: "f",
      salt: randomSalt(),
      content: text("original"),
    });
    const wrong = toHex(crypto.getRandomValues(new Uint8Array(32)));
    await expect(decryptEnvelope(blob, wrong)).rejects.toThrow();
  });

  it("handles binary content, not just text", async () => {
    const binary = crypto.getRandomValues(new Uint8Array(5000));
    const { blob, keyHex } = await encryptEnvelope({
      fileName: "photo.bin",
      salt: randomSalt(),
      content: binary,
    });
    const out = await decryptEnvelope(blob, keyHex);
    expect(toHex(out.content)).toBe(toHex(binary));
  });

  it("handles an empty file", async () => {
    const { blob, keyHex } = await encryptEnvelope({
      fileName: "empty.txt",
      salt: randomSalt(),
      content: new Uint8Array(0),
    });
    const out = await decryptEnvelope(blob, keyHex);
    expect(out.content).toHaveLength(0);
    expect(out.fileName).toBe("empty.txt");
  });
});
