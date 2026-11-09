"use client";

import { useHeartbeat } from "@/lib/useHeartbeat";

/**
 * Guards against the one way a Heartbeat switch can die permanently.
 *
 * Every owner function carries `notExpired`, and confirmRelease requires
 * `votesNeeded > 0` and a guardian to call it. So a switch that reaches expiry
 * with no guardians, or no vote threshold, can never be checked in, configured,
 * or released by anyone — it is bricked. The window to fix that closes the
 * moment it expires, so warn while there is still time.
 */
export function SetupWarning() {
  const hb = useHeartbeat();
  if (!hb.ready || !hb.isOwner) return null;

  const expired = hb.derived?.state === "expired";
  if (expired || hb.released) return null;

  const noGuardians = hb.guardianCount === 0n;
  const noThreshold = hb.votesNeeded === 0n;
  if (!noGuardians && !noThreshold) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
      <strong className="font-bold">
        Finish setting up before this expires.
      </strong>
      <p className="mt-1 text-amber-200/80">
        {noGuardians
          ? "This switch has no guardians."
          : "This switch has no vote threshold."}{" "}
        If it expires in that state it locks forever: you lose every owner
        action, and nobody can vote to release it either.
      </p>
    </div>
  );
}
