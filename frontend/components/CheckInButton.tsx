"use client";

import { heartbeatAt } from "@/lib/contract";
import { useSwitchAddress } from "@/lib/SwitchContext";
import { shortHex } from "@/lib/format";
import { useHeartbeat, useHeartbeatWrite } from "@/lib/useHeartbeat";
import { Button, Note, revertReason } from "./ui";

/**
 * The single most important control, so it sits directly under the countdown
 * rather than in a panel below the fold.
 *
 * It always explains itself: who may press it, and why it is unavailable.
 */
export function CheckInButton() {
  const contract = heartbeatAt(useSwitchAddress());
  const hb = useHeartbeat();
  const write = useHeartbeatWrite();

  if (!hb.ready) return null;

  const state = hb.derived?.state;
  // Checking in early is allowed by the contract and genuinely useful — the
  // owner may be about to go off-grid. Only expiry closes the door.
  const lockedOut = state === "expired" || hb.released;

  if (!hb.viewer) {
    return <Note>Connect the owner&apos;s wallet to check in.</Note>;
  }

  if (!hb.isOwner) {
    return (
      <Note>
        Only the owner can check in. This switch belongs to{" "}
        <span className="text-neutral-300">{shortHex(hb.owner)}</span>, and
        you&apos;re connected as{" "}
        <span className="text-neutral-300">{shortHex(hb.viewer)}</span>.
      </Note>
    );
  }

  return (
    <div>
      <Button
        variant="primary"
        disabled={lockedOut}
        busy={write.isBusy}
        onClick={() =>
          write.writeContract({ ...contract, functionName: "checkIn" })
        }
      >
        I&apos;m alive
      </Button>
      {lockedOut ? (
        <Note tone="error">
          Too late — this switch has expired and the owner is locked out.
        </Note>
      ) : state === "grace" ? (
        <Note tone="error">
          You&apos;re in the grace period. Check in now or your guardians can
          vote.
        </Note>
      ) : null}
      {write.status === "signing" && <Note>Confirm in your wallet…</Note>}
      {write.status === "confirming" && <Note>Waiting for the chain…</Note>}
      {write.error && <Note tone="error">{revertReason(write.error)}</Note>}
    </div>
  );
}
