"use client";

import type { AbiEvent, Log, PublicClient } from "viem";

/**
 * A log viem has decoded against our ABI.
 *
 * The event list is a widened `AbiEvent[]` rather than a const tuple, so viem
 * cannot infer literal event names and both fields are optional at the type
 * level. Callers switch on `eventName` anyway.
 */
export type DecodedLog = Log & {
  eventName?: string;
  args?: Record<string, unknown>;
};

/**
 * Reading a contract's whole event history on a public chain.
 *
 * `fromBlock: 0` works on a local chain with a few dozen blocks and is rejected
 * everywhere else — Infura answers "range exceeds limit of 10000", and most
 * providers impose something similar. Sepolia is past 12 million blocks, so the
 * whole history has to be found and fetched deliberately.
 */

/** Providers cap a single getLogs range; 10k is Infura's and a safe common floor. */
export const MAX_BLOCK_RANGE = 10_000n;

/** Guard against an unbounded scan if a switch turns out to be very old. */
const MAX_CHUNKS = 50;

/**
 * Binary-searches for the block a contract was deployed in.
 *
 * getCode returns empty for every block before deployment and non-empty after,
 * so the boundary is findable in ~log2(height) calls — about 24 for Sepolia,
 * versus 1,200 chunked requests to scan from genesis.
 */
export async function findDeploymentBlock(
  client: Pick<PublicClient, "getBytecode">,
  address: `0x${string}`,
  latest: bigint,
): Promise<bigint> {
  const hasCode = async (blockNumber: bigint) => {
    const code = await client.getBytecode({ address, blockNumber });
    return Boolean(code && code !== "0x");
  };

  // Nothing there at all — caller decides what that means.
  if (!(await hasCode(latest))) return latest;

  let low = 0n; // known: no code
  let high = latest; // known: has code
  while (low + 1n < high) {
    const mid = (low + high) / 2n;
    if (await hasCode(mid)) high = mid;
    else low = mid;
  }
  return high;
}

/**
 * Fetches every matching log from `fromBlock` to the tip, in provider-sized
 * chunks. Returns oldest-first; the caller decides the display order.
 */
export async function fetchLogsInChunks(
  client: Pick<PublicClient, "getLogs">,
  params: { address: `0x${string}`; events: AbiEvent[] },
  fromBlock: bigint,
  latest: bigint,
): Promise<DecodedLog[]> {
  const span = latest - fromBlock + 1n;
  const chunks = span / MAX_BLOCK_RANGE + 1n;
  if (chunks > BigInt(MAX_CHUNKS)) {
    // Fall back to the most recent window rather than issuing hundreds of
    // requests. Better a partial timeline than a hung page.
    fromBlock = latest - MAX_BLOCK_RANGE * BigInt(MAX_CHUNKS) + 1n;
  }

  const all: DecodedLog[] = [];
  for (let start = fromBlock; start <= latest; start += MAX_BLOCK_RANGE) {
    const end = start + MAX_BLOCK_RANGE - 1n;
    all.push(
      ...((await client.getLogs({
        address: params.address,
        events: params.events,
        fromBlock: start,
        toBlock: end > latest ? latest : end,
      })) as DecodedLog[]),
    );
  }
  return all;
}
