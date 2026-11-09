"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

/**
 * Reading a switch needs no wallet — the chain is public. Doing anything to it
 * does, because writes are signed transactions. Say so, rather than leaving a
 * visitor staring at a page with no buttons.
 */
export function ConnectPrompt() {
  const { isConnected } = useAccount();
  if (isConnected) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-5">
      <div>
        <p className="text-sm font-bold text-emerald-200">
          Connect a wallet to take action
        </p>
        <p className="mt-1 text-sm text-neutral-400">
          Anyone can read this switch. Checking in, managing guardians and
          voting are transactions, so they need your signature.
        </p>
      </div>
      <ConnectButton />
    </div>
  );
}
