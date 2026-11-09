"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { heartbeatAt } from "./contract";
import { useSwitchAddress } from "./SwitchContext";
import { deriveState, type DerivedState } from "./heartbeatState";
import { useNow } from "./useNow";

/**
 * Every value the UI needs about the switch, in one place.
 *
 * Components call this freely — React Query dedupes identical reads, so three
 * components sharing this hook still produce one set of RPC calls.
 */
export function useHeartbeat() {
  const now = useNow();
  const { address } = useAccount();
  const heartbeatContract = heartbeatAt(useSwitchAddress());

  const { data, isPending, isError, error } = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...heartbeatContract, functionName: "owner" },
      { ...heartbeatContract, functionName: "lastCheckIn" },
      { ...heartbeatContract, functionName: "interval" },
      { ...heartbeatContract, functionName: "gracePeriod" },
      { ...heartbeatContract, functionName: "fingerprint" },
      { ...heartbeatContract, functionName: "ipfsLink" },
      { ...heartbeatContract, functionName: "votesNeeded" },
      { ...heartbeatContract, functionName: "voteCount" },
      { ...heartbeatContract, functionName: "released" },
      { ...heartbeatContract, functionName: "getGuardianCount" },
    ],
    query: { refetchInterval: 12_000 },
  });

  const { data: viewerIsGuardian } = useReadContract({
    ...heartbeatContract,
    functionName: "isGuardian",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  if (isPending || isError || !data) {
    return { isPending, isError, error, ready: false as const };
  }

  const [
    owner,
    lastCheckIn,
    interval,
    gracePeriod,
    fingerprint,
    ipfsLink,
    votesNeeded,
    voteCount,
    released,
    guardianCount,
  ] = data;

  const derived: DerivedState | null =
    now === null
      ? null
      : deriveState({ lastCheckIn, interval, gracePeriod, released, now });

  return {
    ready: true as const,
    isPending: false,
    isError: false,
    error: null,
    owner,
    lastCheckIn,
    interval,
    gracePeriod,
    fingerprint,
    ipfsLink,
    votesNeeded,
    voteCount,
    released,
    guardianCount,
    derived,
    viewer: address,
    isOwner:
      address !== undefined && address.toLowerCase() === owner.toLowerCase(),
    isGuardian: Boolean(viewerIsGuardian),
  };
}

/**
 * Sends one write transaction and tracks it through to confirmation.
 *
 * useWriteContract resolves as soon as the wallet returns a hash, which is
 * before the chain has done anything — useWaitForTransactionReceipt is what
 * tells us it actually landed. https://wagmi.sh/react/api/hooks/useWriteContract
 */
export function useHeartbeatWrite() {
  const queryClient = useQueryClient();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  // Once it lands, drop every cached read so the UI reflects the new state
  // immediately rather than waiting out the 12s refetch.
  useEffect(() => {
    if (isSuccess) queryClient.invalidateQueries();
  }, [isSuccess, queryClient]);

  return {
    writeContract,
    isBusy: isPending || isConfirming,
    // "waiting on wallet" vs "waiting on chain" are different things to a user.
    status: isPending ? "signing" : isConfirming ? "confirming" : "idle",
    error: error ?? receiptError ?? null,
  };
}
