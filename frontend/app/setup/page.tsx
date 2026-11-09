"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "viem";
import {
  useAccount,
  useDeployContract,
  usePublicClient,
  useWriteContract,
} from "wagmi";

import { DevFaucet } from "@/components/DevFaucet";
import { DownloadShares, ShareCard } from "@/components/ShareCard";
import { DurationInput, toSeconds } from "@/components/DurationInput";
import { Button, Card, Note, TextInput, revertReason } from "@/components/ui";
import { computeFingerprint, encryptEnvelope, randomSalt } from "@/lib/crypto";
import { heartbeatAbi, heartbeatBytecode } from "@/lib/heartbeat";
import { uploadEncrypted } from "@/lib/ipfs";
import { splitKey } from "@/lib/shamir";
import { encodeShare, fingerprintTag } from "@/lib/shareFormat";

type Stage =
  | "idle"
  | "encrypting"
  | "uploading"
  | "splitting"
  | "deploying"
  | "configuring"
  | "done";

export default function SetupPage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  const [file, setFile] = useState<File | null>(null);
  const [guardians, setGuardians] = useState<string[]>([""]);
  const [threshold, setThreshold] = useState("2");
  // Default to a demo-friendly 5 minutes / 3 minutes.
  const [checkIn, setCheckIn] = useState({ amount: "5", unit: 0 });
  const [grace, setGrace] = useState({ amount: "3", unit: 0 });

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shares, setShares] = useState<string[] | null>(null);
  const [stubbed, setStubbed] = useState(false);

  const { deployContractAsync } = useDeployContract();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [deployedAddress, setDeployedAddress] = useState<`0x${string}` | null>(
    null,
  );
  const [progress, setProgress] = useState("");

  const cleanGuardians = guardians.map((g) => g.trim()).filter(Boolean);
  const guardiansValid =
    cleanGuardians.length > 0 && cleanGuardians.every((g) => isAddress(g));
  const uniqueGuardians = new Set(cleanGuardians.map((g) => g.toLowerCase()))
    .size;
  const noDuplicates = uniqueGuardians === cleanGuardians.length;
  const thresholdNumber = Number(threshold);
  const thresholdValid =
    Number.isInteger(thresholdNumber) &&
    thresholdNumber >= 2 &&
    thresholdNumber <= cleanGuardians.length;

  const intervalSeconds = toSeconds(checkIn.amount, checkIn.unit);
  const graceSeconds = toSeconds(grace.amount, grace.unit);
  const timingValid = intervalSeconds > 0 && graceSeconds > 0;

  const canSubmit =
    isConnected &&
    file &&
    guardiansValid &&
    noDuplicates &&
    thresholdValid &&
    timingValid &&
    stage === "idle";

  async function create() {
    if (!file || !publicClient) return;
    setError(null);
    try {
      // 1. Fingerprint + encrypt, entirely in this browser.
      setStage("encrypting");
      const content = new Uint8Array(await file.arrayBuffer());
      const salt = randomSalt();
      const fingerprint = await computeFingerprint(salt, content);
      const { blob, keyHex } = await encryptEnvelope({
        fileName: file.name,
        salt,
        content,
      });

      // 2. Publish only the ciphertext.
      setStage("uploading");
      const { cid, stubbed: wasStubbed } = await uploadEncrypted(
        blob,
        file.name,
      );
      setStubbed(wasStubbed);

      // 3. Deploy first: the shares are tagged with the switch address, so it
      //    has to exist before they can be generated.
      setStage("deploying");
      const txHash = await deployContractAsync({
        abi: heartbeatAbi,
        bytecode: heartbeatBytecode,
        args: [BigInt(intervalSeconds), BigInt(graceSeconds), fingerprint, cid],
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      const switchAddress = receipt.contractAddress;
      if (!switchAddress)
        throw new Error("Deployment produced no contract address.");
      setDeployedAddress(switchAddress);

      // 4. Split the key so no single guardian can open it alone, and tag each
      //    share with its switch and threshold so guardians are never guessing.
      setStage("splitting");
      const keyShares = (
        await splitKey(keyHex, cleanGuardians.length, thresholdNumber)
      ).map((shareHex) =>
        encodeShare({
          threshold: thresholdNumber,
          total: cleanGuardians.length,
          switchAddress,
          fingerprint: fingerprintTag(fingerprint),
          shareHex,
        }),
      );

      // 5. Guardians are not constructor arguments, so each one is its own
      //    transaction, and the vote threshold is another. Every owner action
      //    carries `notExpired`, so a switch left unconfigured until it expires
      //    can never be checked in, configured, or released — do it now.
      setStage("configuring");
      for (const [index, guardian] of cleanGuardians.entries()) {
        setProgress(
          `Adding guardian ${index + 1} of ${cleanGuardians.length}…`,
        );
        const added = await writeContractAsync({
          address: switchAddress,
          abi: heartbeatAbi,
          functionName: "addGuardian",
          args: [guardian as `0x${string}`],
        });
        await publicClient.waitForTransactionReceipt({ hash: added });
      }

      setProgress("Setting the vote threshold…");
      const voted = await writeContractAsync({
        address: switchAddress,
        abi: heartbeatAbi,
        functionName: "setVotesNeeded",
        args: [BigInt(thresholdNumber)],
      });
      await publicClient.waitForTransactionReceipt({ hash: voted });

      setProgress("");
      setShares(keyShares);
      setStage("done");
    } catch (caught) {
      setError(revertReason(caught as Error));
      setStage("idle");
    }
  }

  if (shares) {
    return (
      <div className="flex flex-col gap-6">
        <Card title="Your switch is live">
          {deployedAddress ? (
            <>
              <p className="text-sm text-neutral-300">Deployed at:</p>
              <code className="mt-1 block font-mono text-xs break-all text-emerald-300">
                {deployedAddress}
              </code>
              <div className="mt-4">
                <Button
                  variant="primary"
                  onClick={() => router.push(`/switch/${deployedAddress}`)}
                >
                  Open the dashboard
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-400">
              Waiting for the deployment to confirm…
            </p>
          )}
        </Card>

        <Card
          title="Guardian key shares"
          hint="hand these out privately — shown once, stored nowhere"
        >
          <p className="text-sm text-neutral-400">
            One share each, privately. {threshold} of {cleanGuardians.length}{" "}
            unlock the file.{" "}
            <strong className="text-amber-300">
              Shown once, stored nowhere.
            </strong>
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {shares.map((share, i) => (
              <ShareCard
                key={share}
                index={i}
                guardian={cleanGuardians[i]}
                share={share}
              />
            ))}
          </ul>
          <div className="mt-4">
            <DownloadShares
              guardians={cleanGuardians}
              shares={shares}
              switchAddress={deployedAddress}
            />
          </div>
        </Card>

        {stubbed && (
          <Note tone="error">
            No PINATA_JWT is configured, so the encrypted file was kept in this
            browser&apos;s local storage instead of real IPFS. Fine for a local
            demo; set the key before showing this to anyone else.
          </Note>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-200"
        >
          ← back
        </Link>
        <h2 className="mt-2 text-xl font-bold">Create a switch</h2>
      </div>

      {!isConnected && (
        <Note tone="error">
          Connect a wallet first — you&apos;ll own this switch.
        </Note>
      )}

      <DevFaucet />

      <Card
        title="File"
        hint="encrypted in your browser — only the scrambled copy is ever published"
      >
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-neutral-300 file:mr-4 file:rounded-lg file:border file:border-white/20 file:bg-transparent file:px-4 file:py-2 file:text-sm file:text-neutral-200 hover:file:bg-white/10"
        />
        {file && (
          <Note>
            {file.name} — {(file.size / 1024).toFixed(1)} KB
          </Note>
        )}
      </Card>

      <Card
        title="Guardians"
        hint="people you trust to release the file if you stop checking in"
      >
        <div className="flex flex-col gap-2">
          {guardians.map((guardian, i) => (
            <div key={i} className="flex gap-2">
              <TextInput
                value={guardian}
                placeholder="0x… guardian wallet address"
                onChange={(v) =>
                  setGuardians((list) => list.map((g, j) => (j === i ? v : g)))
                }
              />
              {guardians.length > 1 && (
                <Button
                  variant="danger"
                  onClick={() =>
                    setGuardians((list) => list.filter((_, j) => j !== i))
                  }
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button onClick={() => setGuardians((list) => [...list, ""])}>
            Add another
          </Button>
        </div>
        {cleanGuardians.length > 0 && !guardiansValid && (
          <Note tone="error">One of those isn&apos;t a valid address.</Note>
        )}
        {!noDuplicates && (
          <Note tone="error">Each guardian must be different.</Note>
        )}
      </Card>

      <Card
        title="Votes needed"
        hint="how many guardians must agree before the file unlocks"
      >
        <div className="flex items-center gap-2">
          <TextInput value={threshold} onChange={setThreshold} />
          <span className="text-sm whitespace-nowrap text-neutral-400">
            of {cleanGuardians.length || "—"} guardians
          </span>
        </div>
      </Card>

      <Card title="Timing" hint="how long you have before guardians can act">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="mb-2 text-sm text-neutral-400">Check in every</p>
            <DurationInput
              amount={checkIn.amount}
              unitIndex={checkIn.unit}
              onChange={(amount, unit) => setCheckIn({ amount, unit })}
            />
          </div>
          <div>
            <p className="mb-2 text-sm text-neutral-400">Grace period</p>
            <DurationInput
              amount={grace.amount}
              unitIndex={grace.unit}
              onChange={(amount, unit) => setGrace({ amount, unit })}
            />
          </div>
        </div>
        {!timingValid && (
          <Note tone="error">Both must be greater than zero.</Note>
        )}
      </Card>

      <div>
        <Button
          variant="primary"
          disabled={!canSubmit}
          busy={stage !== "idle"}
          onClick={create}
        >
          Create switch
        </Button>
        {stage !== "idle" && (
          <Note>
            {stage === "encrypting" && "Hashing and encrypting your file…"}
            {stage === "uploading" && "Publishing the encrypted file…"}
            {stage === "splitting" && "Splitting the key for your guardians…"}
            {stage === "deploying" && "Confirm the deployment in your wallet…"}
            {stage === "configuring" && progress}
          </Note>
        )}
        {error && <Note tone="error">{error}</Note>}
      </div>
    </div>
  );
}
