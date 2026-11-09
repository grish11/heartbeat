import { describe, expect, it } from "vitest";

import { deriveState, formatDuration } from "../heartbeatState";

/**
 * These mirror Heartbeat.sol exactly:
 *   isOverdue():  block.timestamp >  lastCheckIn + interval
 *   isExpired():  block.timestamp >  lastCheckIn + interval + gracePeriod
 * Note the strict `>` — at the boundary the switch is NOT yet overdue.
 */
const base = {
  lastCheckIn: 1000n,
  interval: 100n, // overdue after 1100
  gracePeriod: 50n, // expired after 1150
  released: false,
};

describe("deriveState", () => {
  it("is alive before the interval elapses", () => {
    expect(deriveState({ ...base, now: 1050 }).state).toBe("alive");
  });

  it("is still alive exactly ON the boundary (contract uses strict >)", () => {
    expect(deriveState({ ...base, now: 1100 }).state).toBe("alive");
  });

  it("enters the grace period one second past the interval", () => {
    expect(deriveState({ ...base, now: 1101 }).state).toBe("grace");
  });

  it("is still in grace exactly ON the expiry boundary", () => {
    expect(deriveState({ ...base, now: 1150 }).state).toBe("grace");
  });

  it("expires one second past interval + grace", () => {
    expect(deriveState({ ...base, now: 1151 }).state).toBe("expired");
  });

  it("reports released regardless of the clock", () => {
    const released = { ...base, released: true };
    expect(deriveState({ ...released, now: 1050 }).state).toBe("released");
    expect(deriveState({ ...released, now: 9999 }).state).toBe("released");
  });

  it("checks expiry before overdue, since overdue stays true after expiry", () => {
    // The ordering bug this guards against would report "grace" forever.
    expect(deriveState({ ...base, now: 99999 }).state).toBe("expired");
  });

  it("counts down to the next transition, not past it", () => {
    expect(deriveState({ ...base, now: 1040 }).secondsLeft).toBe(60); // to overdue
    expect(deriveState({ ...base, now: 1120 }).secondsLeft).toBe(30); // to expiry
    expect(deriveState({ ...base, now: 1200 }).secondsLeft).toBe(0);
  });

  it("survives realistic uint256 values without precision loss", () => {
    const real = {
      lastCheckIn: 1762000000n,
      interval: 604800n, // a week
      gracePeriod: 172800n, // two days
      released: false,
    };
    expect(deriveState({ ...real, now: 1762000001 }).state).toBe("alive");
    expect(deriveState({ ...real, now: 1762604801 }).state).toBe("grace");
    expect(deriveState({ ...real, now: 1762777601 }).state).toBe("expired");
  });
});

describe("formatDuration", () => {
  it("never shows more than two units", () => {
    expect(formatDuration(90061)).toBe("1d 01h");
    expect(formatDuration(3725)).toBe("1h 02m");
    expect(formatDuration(125)).toBe("2m 05s");
  });

  it("clamps at zero rather than showing negatives", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(-10)).toBe("0s");
  });
});
