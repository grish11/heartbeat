/**
 * All the cryptography for Heartbeat, running entirely in the browser.
 *
 * Nothing here ever leaves the user's machine except the ciphertext. The
 * server never sees the file, the key, or the shares.
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle), which is built into
 * every modern browser — no dependency, and a vetted implementation.
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
 */

const SALT_BYTES = 32;
const IV_BYTES = 12; // 96 bits, the size AES-GCM is specified for
const KEY_BITS = 256;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("Hex string has an odd length.");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte))
      throw new Error("Hex string contains a non-hex character.");
    out[i] = byte;
  }
  return out;
}

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * The fingerprint stored on-chain: SHA-256(salt ‖ file bytes).
 *
 * The salt is there so the fingerprint doesn't leak which file this is — a
 * plain hash of a known public document would be recognisable. Guardians get
 * the salt back when they decrypt, so they can recompute and verify.
 *
 * Returns a 0x-prefixed 32-byte hex string, exactly what `bytes32` wants.
 */
export async function computeFingerprint(
  salt: Uint8Array,
  content: Uint8Array,
): Promise<`0x${string}`> {
  const joined = new Uint8Array(salt.length + content.length);
  joined.set(salt, 0);
  joined.set(content, salt.length);
  const digest = await crypto.subtle.digest("SHA-256", joined as BufferSource);
  return `0x${toHex(new Uint8Array(digest))}`;
}

/**
 * The encrypted envelope laid out as bytes:
 *
 *   [12-byte IV][ciphertext of: [4-byte header length][JSON header][file bytes]]
 *
 * The header carries the filename and the salt, so a guardian who decrypts
 * gets back everything needed to restore the file and re-verify its
 * fingerprint, with no out-of-band information.
 */
export type Envelope = {
  fileName: string;
  salt: Uint8Array;
  content: Uint8Array;
};

export async function encryptEnvelope(
  envelope: Envelope,
): Promise<{ blob: Uint8Array; keyHex: string }> {
  const header = new TextEncoder().encode(
    JSON.stringify({ name: envelope.fileName, salt: toHex(envelope.salt) }),
  );
  const plain = new Uint8Array(4 + header.length + envelope.content.length);
  new DataView(plain.buffer).setUint32(0, header.length, false); // big-endian
  plain.set(header, 4);
  plain.set(envelope.content, 4 + header.length);

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: KEY_BITS },
    true, // extractable, because we have to split it among guardians
    ["encrypt", "decrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      plain as BufferSource,
    ),
  );

  const blob = new Uint8Array(iv.length + cipher.length);
  blob.set(iv, 0);
  blob.set(cipher, iv.length);

  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { blob, keyHex: toHex(raw) };
}

export async function decryptEnvelope(
  blob: Uint8Array,
  keyHex: string,
): Promise<Envelope> {
  const key = await crypto.subtle.importKey(
    "raw",
    fromHex(keyHex) as BufferSource,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = blob.slice(0, IV_BYTES);
  // AES-GCM is authenticated: a wrong key or a tampered file throws here
  // rather than returning garbage.
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      blob.slice(IV_BYTES) as BufferSource,
    ),
  );

  const headerLength = new DataView(plain.buffer, plain.byteOffset).getUint32(
    0,
    false,
  );
  const header = JSON.parse(
    new TextDecoder().decode(plain.slice(4, 4 + headerLength)),
  ) as { name: string; salt: string };

  return {
    fileName: header.name,
    salt: fromHex(header.salt),
    content: plain.slice(4 + headerLength),
  };
}
