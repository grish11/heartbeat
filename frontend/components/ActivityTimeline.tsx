"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useBlockNumber, usePublicClient } from "wagmi";
import type { AbiEvent } from "viem";

import { shortHex } from "@/lib/format";
import { useSwitchAddress } from "@/lib/SwitchContext";
import { heartbeatAbi } from "@/lib/heartbeat";
import { fetchLogsInChunks, findDeploymentBlock } from "@/lib/logs";
import { Card } from "./ui";

const EVENTS = heartbeatAbi.filter(
  (item) => item.type === "event",
) as AbiEvent[];

/** Turns a decoded log into one line of plain English. */
function describe(eventName: string, args: Record<string, unknown>): string {
  switch (eventName) {
    case "CheckedIn":
      return "Owner checked in";
    case "GuardianAdded":
      return `Guardian added — ${shortHex(String(args.guardian))}`;
    case "GuardianRemoved":
      return `Guardian removed — ${shortHex(String(args.guardian))}`;
    case "VotesNeededSet":
      return `Vote threshold set to ${String(args.votesNeeded)}`;
    case "VoteCast":
      return `${shortHex(String(args.guardian))} voted to release (${String(args.voteCount)} total)`;
    case "Released":
      return "Released — guardians can now unlock the secret";
    default:
      return eventName;
  }
}

export function ActivityTimeline() {
  const address = useSwitchAddress();
  const client = usePublicClient();
  // Re-fetch whenever a new block arrives, so the timeline is live.
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // A switch's deployment block never changes, so find it once and keep it.
  // The binary search costs ~24 RPC calls; repeating it on every new block
  // would exhaust a provider's rate limit within minutes.
  const { data: deployedAt } = useQuery({
    queryKey: ["heartbeat-deploy-block", address],
    enabled: Boolean(client),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async () => {
      if (!client) throw new Error("No RPC client available.");
      const latest = await client.getBlockNumber();
      // Not fromBlock 0: providers cap getLogs ranges — Infura at 10,000
      // blocks — and Sepolia is past 12 million.
      return findDeploymentBlock(client, address, latest);
    },
  });

  const {
    data: logs,
    isPending,
    error,
    refetch,
  } = useQuery({
    // The block number stays out of the key: including it minted a fresh cache
    // entry every block and refetched all history each time.
    queryKey: ["heartbeat-logs", address, deployedAt?.toString()],
    enabled: Boolean(client) && deployedAt !== undefined,
    queryFn: async () => {
      if (!client || deployedAt === undefined) {
        throw new Error("No RPC client available.");
      }
      const latest = await client.getBlockNumber();
      const found = await fetchLogsInChunks(
        client,
        { address, events: EVENTS },
        deployedAt,
        latest,
      );
      return found.reverse(); // newest first
    },
  });

  // New block -> something may have happened. Refetch, reusing one cache entry.
  useEffect(() => {
    if (blockNumber !== undefined) void refetch();
  }, [blockNumber, refetch]);

  return (
    <Card title="Activity">
      {isPending ? (
        <p className="text-sm text-neutral-500">Reading history…</p>
      ) : error ? (
        <p className="text-sm text-red-300">
          Could not read the history: {error.message}
        </p>
      ) : !logs?.length ? (
        <p className="text-sm text-neutral-500">
          Nothing has happened yet. Deploying the switch counted as the first
          check-in, but the contract emits no event for that.
        </p>
      ) : (
        <ol className="flex flex-col">
          {logs.map((log) => (
            <li
              key={`${log.transactionHash}-${log.logIndex}`}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 py-2 last:border-0"
            >
              <span className="text-sm">
                {describe(
                  String(log.eventName),
                  (log.args ?? {}) as Record<string, unknown>,
                )}
              </span>
              <span className="text-xs text-neutral-600">
                block {log.blockNumber?.toString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
