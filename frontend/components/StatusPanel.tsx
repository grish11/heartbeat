"use client";

import { useAccount } from "wagmi";
import { anvil, sepolia } from "wagmi/chains";

import { formatDuration } from "@/lib/heartbeatState";
import { useSwitchAddress } from "@/lib/SwitchContext";
import { shortHex } from "@/lib/format";
import { isStubbed } from "@/lib/ipfs";
import { useHeartbeat } from "@/lib/useHeartbeat";
import { CheckInButton } from "./CheckInButton";
import { StatusBadge } from "./StatusBadge";
import { Card, revertReason } from "./ui";

const SUPPORTED_CHAIN_IDS: number[] = [anvil.id, sepolia.id];

/** Short value: label left, value right. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2.5">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className="font-mono text-sm text-neutral-100">{value}</span>
    </div>
  );
}

/** Long value: shown in full on its own line, never truncated or hidden. */
function LongField({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  /** When set, the value renders as a link anyone can open to check it. */
  href?: string;
}) {
  return (
    <div className="border-b border-white/5 py-2.5 last:border-0">
      <div className="text-sm text-neutral-400">{label}</div>
      <code className="mt-1 block font-mono text-xs leading-relaxed break-all text-neutral-100">
        {value}
      </code>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block font-mono text-xs break-all text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
        >
          {href}
        </a>
      )}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function StatusPanel() {
  const switchAddress = useSwitchAddress();
  const { chainId, isConnected } = useAccount();
  const hb = useHeartbeat();

  if (
    isConnected &&
    chainId !== undefined &&
    !SUPPORTED_CHAIN_IDS.includes(chainId)
  ) {
    return (
      <Card>
        <p className="text-amber-300">
          Wallet is on chain {chainId}. Switch to the local anvil network
          (31337) to see this switch.
        </p>
      </Card>
    );
  }

  if (hb.isPending) {
    return (
      <Card>
        <p className="text-neutral-400">Reading the switch…</p>
      </Card>
    );
  }

  if (!hb.ready) {
    return (
      <Card>
        <p className="text-red-300">
          No switch found at {shortHex(switchAddress)}.
        </p>
        <p className="mt-2 text-sm text-neutral-400">
          Check the address is right. If this is a local switch, make sure anvil
          is running — it forgets everything when it restarts.
        </p>
        <p className="mt-2 font-mono text-xs break-all text-neutral-600">
          {revertReason(hb.error ?? null)}
        </p>
      </Card>
    );
  }

  const role = !hb.viewer
    ? null
    : hb.isOwner
      ? "You are the owner of this switch."
      : hb.isGuardian
        ? "You are a guardian of this switch."
        : "You are observing. This switch is not yours.";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {hb.derived ? <StatusBadge state={hb.derived.state} /> : <span />}
        <code className="text-xs text-neutral-500">
          {shortHex(switchAddress)}
        </code>
      </div>

      <div className="my-8 text-center">
        {hb.derived === null ? (
          <div className="h-20" />
        ) : (
          <>
            <p className="text-sm text-neutral-400">
              {hb.derived.countdownLabel}
            </p>
            <p className="mt-1 font-mono text-5xl tabular-nums">
              {hb.derived.secondsLeft > 0
                ? formatDuration(hb.derived.secondsLeft)
                : "—"}
            </p>
          </>
        )}
        <div className="mt-6 flex justify-center">
          <CheckInButton />
        </div>
      </div>

      <div>
        <Field
          label="Last check-in"
          value={new Date(Number(hb.lastCheckIn) * 1000).toLocaleString()}
        />
        <Field
          label="Check-in interval"
          value={formatDuration(Number(hb.interval))}
        />
        <Field
          label="Grace period"
          value={formatDuration(Number(hb.gracePeriod))}
        />
        <Field label="Guardians" value={hb.guardianCount.toString()} />
        <Field
          label="Votes to release"
          value={`${hb.voteCount} of ${hb.votesNeeded === 0n ? "— (not set)" : hb.votesNeeded}`}
        />
        <LongField label="Owner" value={hb.owner} />
        <LongField
          label="Fingerprint"
          value={hb.fingerprint}
          hint="SHA-256 of the original file. Proves a released file was never altered."
        />
        <LongField
          label="Encrypted file (IPFS)"
          value={hb.ipfsLink}
          // A local- stub never reached IPFS, so there is nothing to link to.
          href={
            isStubbed(hb.ipfsLink)
              ? undefined
              : `https://ipfs.io/ipfs/${hb.ipfsLink}`
          }
          hint={
            isStubbed(hb.ipfsLink)
              ? "Stored in this browser only — no PINATA_JWT was set when this switch was created."
              : "Open it: you get encrypted bytes. Useless without enough guardian key shares."
          }
        />
      </div>

      {role && <p className="mt-6 text-sm text-neutral-400">{role}</p>}
    </Card>
  );
}
