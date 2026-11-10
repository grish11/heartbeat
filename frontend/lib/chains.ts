"use client";

import { base, baseSepolia, mainnet, sepolia } from "wagmi/chains";
import type { Chain } from "viem";

/**
 * The networks a switch can live on, and what choosing each one means.
 *
 * This is a real decision for the user, not a technical detail. A switch is
 * meant to still work years from now, possibly when its owner cannot
 * intervene:
 *
 *   L1 buys durability. Ethereum is the chain most likely to exist unchanged
 *   in a decade, and the hardest to censor.
 *
 *   L2 buys affordability. Rollups are far cheaper, which matters because
 *   check-ins recur for years — but they are younger, and today they run
 *   centralised sequencers with upgrade keys held by a company.
 *
 *   Testnets buy nothing but convenience. The ETH is free because it is
 *   worthless, and testnets are retired on a schedule.
 */
export type ChainKind = "test" | "real";

export type ChainInfo = {
  chain: Chain;
  kind: ChainKind;
  /** Short label for the picker. */
  label: string;
  /** One line on what picking this means. */
  note: string;
};

export const CHAINS: ChainInfo[] = [
  {
    chain: sepolia,
    kind: "test",
    label: "Sepolia",
    note: "Ethereum's test network. Free, and discarded when the testnet retires.",
  },
  {
    chain: baseSepolia,
    kind: "test",
    label: "Base Sepolia",
    note: "Base's test network. Free, and equally impermanent.",
  },
  {
    chain: base,
    kind: "real",
    label: "Base",
    note: "A real L2. Cheap enough for years of check-ins, but Base runs a centralised sequencer.",
  },
  {
    chain: mainnet,
    kind: "real",
    label: "Ethereum",
    note: "The most durable and censorship-resistant option, and the most expensive.",
  },
];

export function chainInfo(chainId: number | undefined): ChainInfo | undefined {
  return CHAINS.find((c) => c.chain.id === chainId);
}

/** True when a mistake on this chain costs actual money. */
export function isRealMoney(chainId: number | undefined): boolean {
  return chainInfo(chainId)?.kind === "real";
}
