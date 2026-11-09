"use client";

import { heartbeatAt } from "@/lib/contract";
import { useSwitchAddress } from "@/lib/SwitchContext";
import { useHeartbeat, useHeartbeatWrite } from "@/lib/useHeartbeat";
import { Button, Card, Note, revertReason } from "./ui";

export function GuardianVote() {
  const heartbeatContract = heartbeatAt(useSwitchAddress());
  const hb = useHeartbeat();
  const write = useHeartbeatWrite();

  if (!hb.ready || !hb.isGuardian) return null;

  const expired = hb.derived?.state === "expired";
  const needed = Number(hb.votesNeeded);
  const cast = Number(hb.voteCount);

  return (
    <Card title="Guardian">
      <p className="text-sm text-neutral-300">
        {cast} of {needed === 0 ? "—" : needed} votes cast.
      </p>

      <div className="mt-4">
        <Button
          variant="primary"
          disabled={!expired || hb.released || needed === 0 || write.isBusy}
          busy={write.isBusy}
          onClick={() =>
            write.writeContract({
              ...heartbeatContract,
              functionName: "confirmRelease",
            })
          }
        >
          Confirm release
        </Button>
      </div>

      {hb.released ? (
        <Note>Released. The secret can now be unlocked.</Note>
      ) : !expired ? (
        <Note>
          Voting opens only once the switch expires — the owner still has time
          to check in.
        </Note>
      ) : needed === 0 ? (
        <Note tone="error">
          The owner never set a vote threshold, so no vote can be counted.
        </Note>
      ) : (
        <Note>Your vote is final and cannot be withdrawn.</Note>
      )}
      {write.error && <Note tone="error">{revertReason(write.error)}</Note>}
    </Card>
  );
}
