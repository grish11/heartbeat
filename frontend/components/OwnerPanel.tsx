"use client";

import { useState } from "react";
import { isAddress } from "viem";

import { heartbeatAt } from "@/lib/contract";
import { useSwitchAddress } from "@/lib/SwitchContext";
import { useHeartbeat, useHeartbeatWrite } from "@/lib/useHeartbeat";
import { Button, Card, Note, TextInput, revertReason } from "./ui";

export function OwnerPanel() {
  const heartbeatContract = heartbeatAt(useSwitchAddress());
  const hb = useHeartbeat();
  const write = useHeartbeatWrite();
  const [newGuardian, setNewGuardian] = useState("");
  const [votes, setVotes] = useState("");

  if (!hb.ready || !hb.isOwner) return null;

  // Every owner action in Heartbeat.sol carries the `notExpired` modifier, so
  // once the switch expires the owner is locked out of all of them by design.
  const lockedOut = hb.derived?.state === "expired" || hb.released;
  const disabled = lockedOut || write.isBusy;

  const addressLooksValid = isAddress(newGuardian);
  const votesNumber = Number(votes);
  const votesValid =
    votes !== "" &&
    Number.isInteger(votesNumber) &&
    votesNumber > 0 &&
    votesNumber <= Number(hb.guardianCount);

  return (
    <Card title="Owner controls">
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex gap-2">
            <TextInput
              value={newGuardian}
              onChange={setNewGuardian}
              placeholder="0x… guardian address"
              disabled={disabled}
            />
            <Button
              disabled={disabled || !addressLooksValid}
              onClick={() =>
                write.writeContract({
                  ...heartbeatContract,
                  functionName: "addGuardian",
                  args: [newGuardian as `0x${string}`],
                })
              }
            >
              Add guardian
            </Button>
          </div>
          {newGuardian !== "" && !addressLooksValid && (
            <Note tone="error">That isn&apos;t a valid Ethereum address.</Note>
          )}
        </div>

        <div>
          <div className="flex gap-2">
            <TextInput
              value={votes}
              onChange={setVotes}
              placeholder={`votes needed (1–${hb.guardianCount})`}
              disabled={disabled}
            />
            <Button
              disabled={disabled || !votesValid}
              onClick={() =>
                write.writeContract({
                  ...heartbeatContract,
                  functionName: "setVotesNeeded",
                  args: [BigInt(votesNumber)],
                })
              }
            >
              Set votes
            </Button>
          </div>
          {hb.guardianCount === 0n ? (
            <Note>
              Add at least one guardian before setting a vote threshold.
            </Note>
          ) : (
            <Note>
              How many of your {hb.guardianCount.toString()} guardian
              {hb.guardianCount === 1n ? "" : "s"} must agree to release the
              secret.
            </Note>
          )}
        </div>

        {lockedOut && (
          <Note tone="error">
            This switch has expired. Every owner action is blocked from here on
            — that is the point of a dead man&apos;s switch.
          </Note>
        )}
        {write.error && <Note tone="error">{revertReason(write.error)}</Note>}
        {write.status === "signing" && <Note>Confirm in your wallet…</Note>}
        {write.status === "confirming" && <Note>Waiting for the chain…</Note>}
      </div>
    </Card>
  );
}
