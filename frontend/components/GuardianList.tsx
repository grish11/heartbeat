"use client";

import { useReadContracts } from "wagmi";

import { heartbeatAt } from "@/lib/contract";
import { useSwitchAddress } from "@/lib/SwitchContext";
import { useHeartbeat, useHeartbeatWrite } from "@/lib/useHeartbeat";
import { Button, Card, Note, revertReason } from "./ui";

export function GuardianList() {
  const heartbeatContract = heartbeatAt(useSwitchAddress());
  const hb = useHeartbeat();
  const write = useHeartbeatWrite();

  const count = hb.ready ? Number(hb.guardianCount) : 0;

  // guardianList is a plain array with only an index getter, so the addresses
  // have to be read one slot at a time.
  const { data: addresses } = useReadContracts({
    allowFailure: false,
    contracts: Array.from({ length: count }, (_, i) => ({
      ...heartbeatContract,
      functionName: "guardianList" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: count > 0 },
  });

  // Then each guardian's card: (hasVoted, whenAdded).
  const { data: records } = useReadContracts({
    allowFailure: false,
    contracts: (addresses ?? []).map((a) => ({
      ...heartbeatContract,
      functionName: "guardians" as const,
      args: [a] as const,
    })),
    query: { enabled: Boolean(addresses?.length) },
  });

  if (!hb.ready) return null;

  // removeGuardian reverts unless the remaining count still covers votesNeeded,
  // so don't offer a button that is guaranteed to fail.
  const wouldLeaveTooFew = count - 1 < Number(hb.votesNeeded);
  const canRemove =
    hb.isOwner &&
    hb.derived?.state !== "expired" &&
    !hb.released &&
    !wouldLeaveTooFew;

  return (
    <Card title={`Guardians (${count})`}>
      {count === 0 ? (
        <p className="text-sm text-neutral-500">
          No guardians yet. Without them, an expired switch can never be
          released.
        </p>
      ) : (
        <ul className="flex flex-col">
          {(addresses ?? []).map((address, i) => {
            const record = records?.[i];
            const hasVoted = record?.[0] ?? false;
            const whenAdded = record?.[1];
            return (
              <li
                key={address}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <code className="block truncate text-sm">{address}</code>
                  {whenAdded !== undefined && whenAdded > 0n && (
                    <span className="text-xs text-neutral-600">
                      added{" "}
                      {new Date(Number(whenAdded) * 1000).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs ${hasVoted ? "text-violet-300" : "text-neutral-600"}`}
                  >
                    {hasVoted ? "voted to release" : "not voted"}
                  </span>
                  {canRemove && (
                    <Button
                      variant="danger"
                      disabled={write.isBusy}
                      onClick={() =>
                        write.writeContract({
                          ...heartbeatContract,
                          functionName: "removeGuardian",
                          args: [address],
                        })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hb.isOwner && count > 0 && wouldLeaveTooFew && (
        <Note>
          Removing anyone would leave fewer guardians than the{" "}
          {hb.votesNeeded.toString()} votes required, so lower the threshold
          first.
        </Note>
      )}
      {write.error && <Note tone="error">{revertReason(write.error)}</Note>}
    </Card>
  );
}
