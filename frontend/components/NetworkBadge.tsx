"use client";

import { useAccount } from "wagmi";

import { chainInfo } from "@/lib/chains";

/**
 * Says which network you are on and whether the money is real.
 *
 * Not decoration: the same address on two chains is two unrelated contracts,
 * and "real" versus "test" is the difference between a transaction costing
 * nothing and costing actual money.
 */
export function NetworkBadge() {
  const { chainId, isConnected } = useAccount();
  if (!isConnected) return null;

  const info = chainInfo(chainId);
  if (!info) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300 ring-1 ring-amber-500/30 ring-inset">
        Unsupported network ({chainId})
      </span>
    );
  }

  const real = info.kind === "real";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1 ring-inset ${
        real
          ? "bg-amber-500/15 text-amber-200 ring-amber-500/40"
          : "bg-sky-500/10 text-sky-300 ring-sky-500/30"
      }`}
      title={info.note}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {info.label}
      <span className="opacity-70">
        {real ? "· real money" : "· test network"}
      </span>
    </span>
  );
}
