import { describe, expect, it } from "vitest";
import { CHAINS, chainInfo, isRealMoney } from "/home/may/Programming/heartbeat/frontend/lib/chains";

describe("chain metadata", () => {
  it("covers exactly the four intended networks", () => {
    expect(CHAINS.map((c) => c.chain.id)).toEqual([11155111, 84532, 8453, 1]);
  });

  it("labels the money correctly", () => {
    expect(isRealMoney(11155111)).toBe(false); // Sepolia
    expect(isRealMoney(84532)).toBe(false);    // Base Sepolia
    expect(isRealMoney(8453)).toBe(true);      // Base
    expect(isRealMoney(1)).toBe(true);         // Ethereum
  });

  it("treats an unknown chain as not-real rather than guessing", () => {
    expect(chainInfo(999999)).toBeUndefined();
    expect(isRealMoney(999999)).toBe(false);
  });

  it("puts testnets before real-money chains", () => {
    const firstReal = CHAINS.findIndex((c) => c.kind === "real");
    const lastTest = CHAINS.map((c) => c.kind).lastIndexOf("test");
    expect(lastTest).toBeLessThan(firstReal);
  });

  it("gives every chain a note explaining the trade-off", () => {
    for (const c of CHAINS) expect(c.note.length).toBeGreaterThan(20);
  });
});
