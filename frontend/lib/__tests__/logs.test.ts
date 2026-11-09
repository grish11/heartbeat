import { describe, expect, it } from "vitest";

import { MAX_BLOCK_RANGE, fetchLogsInChunks, findDeploymentBlock } from "../logs";

const ADDR = "0x1111111111111111111111111111111111111111" as const;

/** A chain where the contract exists from `deployedAt` onwards, and not before. */
function fakeChain(deployedAt: bigint) {
  const probed: bigint[] = [];
  const client = {
    getBytecode: async ({ blockNumber }: { blockNumber?: bigint }) => {
      const at = blockNumber ?? 0n;
      probed.push(at);
      return at >= deployedAt ? "0x60806040" : "0x";
    },
  };
  return { probed, client: client as unknown as Parameters<typeof findDeploymentBlock>[0] };
}

describe("findDeploymentBlock", () => {
  it("finds the exact block on a Sepolia-sized chain", async () => {
    const { client, probed } = fakeChain(9_876_543n);
    expect(await findDeploymentBlock(client, ADDR, 12_100_905n)).toBe(9_876_543n);
    // log2(12.1m) is about 24. The point is that it is not millions of calls.
    expect(probed.length).toBeLessThan(30);
  });

  it("handles a contract deployed in the latest block", async () => {
    const { client } = fakeChain(500n);
    expect(await findDeploymentBlock(client, ADDR, 500n)).toBe(500n);
  });

  it("handles a tiny local chain", async () => {
    const { client } = fakeChain(3n);
    expect(await findDeploymentBlock(client, ADDR, 30n)).toBe(3n);
  });
});

/** Records every range requested, so chunk boundaries can be asserted. */
function recordingClient(logsPerCall: number) {
  const ranges: Array<[bigint, bigint]> = [];
  const client = {
    getLogs: async ({
      fromBlock,
      toBlock,
    }: {
      fromBlock?: bigint;
      toBlock?: bigint;
    }) => {
      ranges.push([fromBlock ?? 0n, toBlock ?? 0n]);
      return Array.from({ length: logsPerCall }, () => ({ blockNumber: fromBlock }));
    },
  };
  return {
    ranges,
    client: client as unknown as Parameters<typeof fetchLogsInChunks>[0],
  };
}

describe("fetchLogsInChunks", () => {
  it("never requests a range wider than the provider allows", async () => {
    const { client, ranges } = recordingClient(0);

    await fetchLogsInChunks(client, { address: ADDR, events: [] }, 1_000n, 35_000n);

    expect(ranges.length).toBeGreaterThan(1);
    for (const [from, to] of ranges) {
      expect(to - from + 1n).toBeLessThanOrEqual(MAX_BLOCK_RANGE);
    }
    // Contiguous, starting where asked and ending at the tip.
    expect(ranges[0][0]).toBe(1_000n);
    expect(ranges.at(-1)?.[1]).toBe(35_000n);
  });

  it("combines the logs from every chunk", async () => {
    const { client } = recordingClient(1);
    const logs = await fetchLogsInChunks(
      client,
      { address: ADDR, events: [] },
      0n,
      25_000n,
    );
    expect(logs).toHaveLength(3); // 0-9999, 10000-19999, 20000-25000
  });

  it("does one request when the whole span fits in a single range", async () => {
    const { client, ranges } = recordingClient(0);
    await fetchLogsInChunks(client, { address: ADDR, events: [] }, 100n, 200n);
    expect(ranges).toEqual([[100n, 200n]]);
  });
});
