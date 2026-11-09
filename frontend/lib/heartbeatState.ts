// Lifecycle state of a Heartbeat switch, derived in the browser.
//
// Why not just call isOverdue() / isExpired()? Two reasons:
//
//  1. The countdown ticks once a second, and wagmi's useReadContract has no
//     `watch` option — refreshing means polling (query.refetchInterval). Polling
//     two view functions every second to animate a clock is wasteful when the
//     inputs (lastCheckIn, interval, gracePeriod) barely ever change.
//  2. Those views read block.timestamp, which only advances when a block is
//     mined. On an idle anvil they can report stale values.
//
// So we fetch the inputs occasionally and do the arithmetic locally. The
// comparisons below mirror Heartbeat.sol exactly — note the strict `>`:
//   isOverdue():  block.timestamp > lastCheckIn + interval
//   isExpired():  block.timestamp > lastCheckIn + interval + gracePeriod

export type SwitchState = "alive" | "grace" | "expired" | "released";

export type SwitchTiming = {
  lastCheckIn: bigint;
  interval: bigint;
  gracePeriod: bigint;
  released: boolean;
  /** Unix seconds. */
  now: number;
};

export type DerivedState = {
  state: SwitchState;
  /** Seconds until the next transition. 0 once expired or released. */
  secondsLeft: number;
  /** What that countdown means, for the UI. */
  countdownLabel: string;
};

export function deriveState({
  lastCheckIn,
  interval,
  gracePeriod,
  released,
  now,
}: SwitchTiming): DerivedState {
  const overdueAt = Number(lastCheckIn + interval);
  const expiresAt = Number(lastCheckIn + interval + gracePeriod);

  // Order matters. `released` wins over everything, and expiry must be checked
  // before overdue, because a switch stays overdue after it expires.
  if (released) {
    return { state: "released", secondsLeft: 0, countdownLabel: "Released" };
  }
  if (now > expiresAt) {
    return { state: "expired", secondsLeft: 0, countdownLabel: "Expired" };
  }
  if (now > overdueAt) {
    return {
      state: "grace",
      secondsLeft: expiresAt - now,
      countdownLabel: "Grace period ends in",
    };
  }
  return {
    state: "alive",
    secondsLeft: overdueAt - now,
    countdownLabel: "Next check-in due in",
  };
}

/** Seconds as `1d 03h 04m`, `3m 05s`, etc. Always at most two units. */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
