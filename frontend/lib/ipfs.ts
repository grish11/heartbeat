"use client";

import { fromHex, toHex } from "./crypto";

const STUB_PREFIX = "local-";
const STORAGE_PREFIX = "heartbeat:blob:";

/**
 * Accepts a gateway in whatever shape someone pasted it.
 *
 * Pinata's dashboard shows a bare hostname ("xyz.mypinata.cloud"). Without a
 * scheme, `gateway + cid` is a RELATIVE url — the browser resolves it against
 * our own origin, Next.js answers with the app's HTML and a 200, and that HTML
 * reaches the decryptor as if it were the file. Normalise rather than trust.
 */
function normalizeGateway(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const withoutTrailingSlash = withScheme.replace(/\/+$/, "");
  const withPath = /\/ipfs$/i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/ipfs`;
  return `${withPath}/`;
}

/**
 * Gateways tried in order. The user's own comes first when configured;
 * ipfs.io is the vendor-neutral fallback, which also demonstrates the file is
 * genuinely on IPFS rather than only on Pinata's servers.
 */
const GATEWAYS = [
  normalizeGateway(process.env.NEXT_PUBLIC_IPFS_GATEWAY),
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
].filter((gateway): gateway is string => Boolean(gateway));

export type UploadResult = { cid: string; stubbed: boolean };

/**
 * Publishes the encrypted blob and returns the address to store on-chain.
 *
 * Tries the server route (Pinata) first. If the app has no PINATA_JWT, the
 * route answers 501 and the blob is kept in localStorage under a
 * content-derived fake CID instead — so the whole flow works offline and
 * nothing in the UI has to care which happened.
 */
export async function uploadEncrypted(
  blob: Uint8Array,
  fileName: string,
): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", new File([blob as BlobPart], `${fileName}.enc`));

  // A 501 means no PINATA_JWT, which is a configuration choice rather than a
  // failure — fall through to the stub. Anything else is a real problem.
  const response = await fetch("/api/upload", { method: "POST", body }).catch(
    () => null, // no server reachable at all
  );

  if (response?.ok) {
    const { cid } = (await response.json()) as { cid: string };
    return { cid, stubbed: false };
  }
  if (response && response.status !== 501) {
    const { error } = (await response.json()) as { error?: string };
    throw new Error(error ?? `Upload failed (${response.status}).`);
  }

  const digest = await crypto.subtle.digest("SHA-256", blob as BufferSource);
  const cid = STUB_PREFIX + toHex(new Uint8Array(digest)).slice(0, 46);
  localStorage.setItem(STORAGE_PREFIX + cid, toHex(blob));
  return { cid, stubbed: true };
}

export function isStubbed(cid: string): boolean {
  return cid.startsWith(STUB_PREFIX);
}

/** `<!doctype`, `<html` or any leading `<` — never the start of our envelope. */
function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = new TextDecoder()
    .decode(bytes.slice(0, 64))
    .trim()
    .toLowerCase();
  return head.startsWith("<");
}

/**
 * Retrieves the encrypted blob a switch points at.
 *
 * Local stubs never left this browser, so they come back out of localStorage.
 * Real CIDs are fetched from a public gateway — the file is ciphertext, so a
 * third party serving it gives nothing away.
 */
export async function fetchEncrypted(cid: string): Promise<Uint8Array> {
  if (isStubbed(cid)) {
    const stored = localStorage.getItem(STORAGE_PREFIX + cid);
    if (!stored) {
      throw new Error(
        "This file was stored locally by another browser, so it cannot be " +
          "fetched here. Local switches only unlock where they were created.",
      );
    }
    return fromHex(stored);
  }

  const failures: string[] = [];
  for (const gateway of GATEWAYS) {
    try {
      const response = await fetch(gateway + cid);
      if (!response.ok) {
        failures.push(`${gateway} → ${response.status}`);
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      // A misconfigured gateway can answer 200 with a web page. Handing that to
      // the decryptor produces a baffling "could not decrypt" instead of the
      // real problem, so reject anything that is obviously not our blob.
      if (looksLikeHtml(bytes)) {
        failures.push(`${gateway} → returned a web page, not a file`);
        continue;
      }
      return bytes;
    } catch {
      failures.push(`${gateway} → unreachable`);
    }
  }
  throw new Error(`Could not fetch ${cid}. Tried: ${failures.join(", ")}`);
}
