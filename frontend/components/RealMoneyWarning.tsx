"use client";

import { useEstimateFeesPerGas } from "wagmi";
import { formatEther } from "viem";

import { chainInfo } from "@/lib/chains";

/** Rough gas for a deploy plus the guardian and threshold transactions. */
const SETUP_GAS = 1_786_622n + 121_846n * 3n + 51_932n;

/**
 * Shown before creating a switch on a chain where ETH is worth something.
 *
 * Creating a switch is irreversible and the deploy is the expensive part, so a
 * visitor poking at a demo should see the price before a wallet opens, not
 * after.
 */
export function RealMoneyWarning({ chainId }: { chainId: number | undefined }) {
  const info = chainInfo(chainId);
  const { data: fees } = useEstimateFeesPerGas({ chainId });

  if (info?.kind !== "real") return null;

  const perGas = fees?.maxFeePerGas;
  const estimate = perGas ? formatEther(SETUP_GAS * perGas) : null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
      <strong className="font-bold text-amber-200">
        {info.label} is a real network — this costs real money.
      </strong>
      <p className="mt-1 text-amber-200/80">{info.note}</p>
      <p className="mt-2 text-amber-200/80">
        Creating a switch here is estimated at{" "}
        <strong className="font-mono">
          {estimate ? `${Number(estimate).toFixed(5)} ETH` : "…"}
        </strong>{" "}
        at current gas, and cannot be undone. Switch to a test network if you
        are only trying this out.
      </p>
    </div>
  );
}
