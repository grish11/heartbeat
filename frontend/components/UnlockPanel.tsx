"use client";

import { useState } from "react";

import { computeFingerprint, decryptEnvelope } from "@/lib/crypto";
import { fetchEncrypted } from "@/lib/ipfs";
import { combineKey } from "@/lib/shamir";
import { inspectShares } from "@/lib/shareFormat";
import { useSwitchAddress } from "@/lib/SwitchContext";
import { useHeartbeat } from "@/lib/useHeartbeat";
import { Button, Card, Note, TextInput } from "./ui";

type Result = {
  fileName: string;
  content: Uint8Array;
  computed: string;
  matches: boolean;
};

/**
 * Deliberately not gated on being a guardian.
 *
 * Unlocking is local computation, not a transaction: combine shares, fetch the
 * ciphertext, decrypt, hash. The contract is never called, so there is nothing
 * for it to reject — unlike checkIn (onlyOwner) or confirmRelease
 * (onlyGuardian), whose panels do gate on the connected wallet.
 *
 * Requiring a guardian wallet here would also be wrong twice over. It stops
 * nobody, since this pipeline is open-source client-side code anyone can run
 * offline. And whoever assembles the shares frequently is not a guardian:
 * guardians handing their shares to a journalist or a lawyer is the entire
 * point of the project.
 */
export function UnlockPanel() {
  const switchAddress = useSwitchAddress();
  const hb = useHeartbeat();
  const [shares, setShares] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  if (!hb.ready) return null;

  // Captured after the readiness guard: `unlock` is a hoisted function
  // declaration, so TypeScript will not carry the narrowing into it.
  const { ipfsLink, fingerprint, released } = hb;

  const filled = shares.map((s) => s.trim()).filter(Boolean);

  // Shares carry their own switch and threshold, so we can tell a guardian
  // exactly what is wrong instead of letting decryption fail opaquely.
  // Note this is NOT votesNeeded: the Shamir threshold was fixed when the file
  // was encrypted, while the owner can change votesNeeded on-chain afterwards.
  const report = inspectShares(filled, switchAddress, fingerprint);
  const usable = report.parsed.length - report.duplicates;
  const required = report.threshold ?? 2;
  const enough = usable >= required;

  async function unlock() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // 1. Rebuild the AES key. Below the threshold this yields a wrong key,
      //    never a partial one — the decrypt step below is what catches it.
      setStep("Rebuilding the key from the shares…");
      const keyHex = await combineKey(report.parsed.map((p) => p.shareHex));

      // 2. Fetch the ciphertext the contract points at.
      setStep("Fetching the encrypted file…");
      const blob = await fetchEncrypted(ipfsLink);

      // 3. AES-GCM is authenticated, so a wrong key or a tampered file throws
      //    here rather than quietly returning rubbish.
      setStep("Decrypting…");
      const envelope = await decryptEnvelope(blob, keyHex);

      // 4. The claim this whole project rests on: recompute the fingerprint
      //    from the salt and contents, and compare with what has been on-chain
      //    since the switch was created.
      setStep("Verifying the fingerprint…");
      const computed = await computeFingerprint(
        envelope.salt,
        envelope.content,
      );

      setResult({
        fileName: envelope.fileName,
        content: envelope.content,
        computed,
        matches: computed.toLowerCase() === fingerprint.toLowerCase(),
      });
    } catch (caught) {
      // Too few shares rebuild a wrong key, and AES-GCM then refuses to
      // decrypt — which surfaces as an opaque error. Say what it usually means.
      const message =
        caught instanceof Error ? caught.message : "Could not unlock.";
      setError(
        /operation-specific reason|decrypt|OperationError/i.test(message)
          ? "The shares rebuilt a key, but it does not open the file this switch points at. Either you need more shares, or these shares belong to a different switch — check you are on the right network, and that this address was not reused by an earlier deployment."
          : message,
      );
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  function save() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([result.content as BlobPart]));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!released) {
    return (
      <Card
        title="Unlock"
        hint="available once the guardians have voted to release"
      >
        <p className="text-sm text-neutral-400">
          This switch has not been released. Guardians can vote once it expires;
          after enough votes, the file can be rebuilt here.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Unlock"
      hint="anyone holding enough shares can unlock — they need not be a guardian"
    >
      <div className="flex flex-col gap-2">
        {shares.map((share, i) => (
          <div key={i} className="flex gap-2">
            <TextInput
              value={share}
              placeholder={`guardian share ${i + 1}`}
              onChange={(v) =>
                setShares((list) => list.map((s, j) => (j === i ? v : s)))
              }
            />
            {shares.length > 2 && (
              <Button
                variant="danger"
                onClick={() => setShares((l) => l.filter((_, j) => j !== i))}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setShares((l) => [...l, ""])}>
          Add another
        </Button>
        <Button
          variant="primary"
          disabled={!enough}
          busy={busy}
          onClick={unlock}
        >
          Rebuild and verify
        </Button>
      </div>

      {report.invalid > 0 && (
        <Note tone="error">
          {report.invalid} entr{report.invalid === 1 ? "y is" : "ies are"} not a
          valid share.
        </Note>
      )}
      {report.foreign > 0 && (
        <Note tone="error">
          {report.foreign} share{report.foreign === 1 ? " belongs" : "s belong"}{" "}
          to a different switch and {report.foreign === 1 ? "was" : "were"}{" "}
          ignored.
        </Note>
      )}
      {report.duplicates > 0 && (
        <Note tone="error">
          The same share was pasted {report.duplicates + 1} times. Duplicates
          add nothing — you need shares from different guardians.
        </Note>
      )}
      {!enough && (
        <Note>
          {report.threshold
            ? `${usable} of ${required} needed. These shares say ${required} guardians must combine them.`
            : "At least 2 shares are needed — however many the owner chose."}{" "}
          Fewer reveal nothing at all; that is the point of splitting the key.
        </Note>
      )}
      {busy && <Note>{step}</Note>}
      {error && <Note tone="error">{error}</Note>}

      {result && (
        <div
          className={`mt-5 rounded-lg border p-4 ${
            result.matches
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-red-500/40 bg-red-500/10"
          }`}
        >
          <p
            className={`font-bold ${result.matches ? "text-emerald-300" : "text-red-300"}`}
          >
            {result.matches
              ? "✓ Verified original"
              : "✗ Fingerprint does not match"}
          </p>
          <p className="mt-1 text-sm text-neutral-300">
            {result.matches
              ? "The decrypted file hashes to exactly the fingerprint recorded on-chain when this switch was created. It has not been altered."
              : "The file decrypted, but its hash differs from the on-chain fingerprint. Do not trust these contents."}
          </p>

          <dl className="mt-4 text-xs">
            <dt className="text-neutral-500">File</dt>
            <dd className="font-mono text-neutral-200">{result.fileName}</dd>
            <dt className="mt-2 text-neutral-500">On-chain fingerprint</dt>
            <dd className="font-mono break-all text-neutral-200">
              {hb.fingerprint}
            </dd>
            <dt className="mt-2 text-neutral-500">Recomputed from the file</dt>
            <dd
              className={`font-mono break-all ${result.matches ? "text-emerald-300" : "text-red-300"}`}
            >
              {result.computed}
            </dd>
          </dl>

          <div className="mt-4">
            <Button variant="primary" onClick={save}>
              Download {result.fileName}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
