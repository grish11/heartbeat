import { NextResponse } from "next/server";

/**
 * Pins an already-encrypted blob to IPFS through Pinata.
 *
 * Runs on the server for one reason: PINATA_JWT must never reach the browser.
 * It is the app's single shared account — users don't have their own.
 *
 * What arrives here is ciphertext. The server cannot read it, and the
 * decryption key never leaves the user's browser.
 *
 * https://docs.pinata.cloud/api-reference/endpoint/upload-a-file
 */
const PINATA_UPLOAD = "https://uploads.pinata.cloud/v3/files";

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;

  // Not configured — tell the client so it can fall back to local storage.
  // This is what lets the whole flow be demoed offline with no account.
  if (!jwt) {
    return NextResponse.json(
      { configured: false, error: "PINATA_JWT is not set." },
      { status: 501 },
    );
  }

  // formData() throws outright on a body that is not multipart, which would
  // surface as an unhandled 500 rather than telling the caller what is wrong.
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart form upload." },
      { status: 400 },
    );
  }

  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file supplied." }, { status: 400 });
  }

  const outgoing = new FormData();
  outgoing.append("file", file, file.name);
  // Without this, v3 uploads default to PRIVATE, and a guardian on another
  // machine could never fetch the file from a public gateway. The blob is
  // encrypted, so public is the correct choice here.
  outgoing.append("network", "public");
  outgoing.append("name", file.name);

  const response = await fetch(PINATA_UPLOAD, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: outgoing,
  }).catch(() => null);

  if (!response) {
    return NextResponse.json(
      { error: "Could not reach Pinata." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      {
        error:
          `Pinata rejected the upload (${response.status}). ${detail}`.trim(),
      },
      { status: 502 },
    );
  }

  const result = (await response.json()) as { data?: { cid?: string } };
  const cid = result.data?.cid;
  if (!cid) {
    return NextResponse.json(
      { error: "Pinata returned no CID." },
      { status: 502 },
    );
  }

  return NextResponse.json({ configured: true, cid });
}
