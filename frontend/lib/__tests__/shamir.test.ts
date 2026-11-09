import { describe, expect, it } from "vitest";

import { toHex } from "../crypto";
import { combineKey, splitKey } from "../shamir";

const aKey = () => toHex(crypto.getRandomValues(new Uint8Array(32)));

describe("splitKey / combineKey", () => {
  it("produces one share per guardian", async () => {
    expect(await splitKey(aKey(), 3, 2)).toHaveLength(3);
    expect(await splitKey(aKey(), 5, 3)).toHaveLength(5);
  });

  it("rebuilds the key from any combination at or above the threshold", async () => {
    const key = aKey();
    const [a, b, c] = await splitKey(key, 3, 2);
    for (const subset of [
      [a, b],
      [a, c],
      [b, c],
      [a, b, c],
      [c, a],
    ]) {
      expect(await combineKey(subset)).toBe(key);
    }
  });

  it("does not depend on the order shares are supplied in", async () => {
    const key = aKey();
    const [a, b, c] = await splitKey(key, 3, 2);
    expect(await combineKey([c, a])).toBe(key);
    expect(await combineKey([a, c])).toBe(key);
    expect(await combineKey([c, b, a])).toBe(key);
  });

  it("does not reveal the key below the threshold", async () => {
    const key = aKey();
    const [a] = await splitKey(key, 3, 2);
    // Either it refuses outright or it yields something unrelated — the one
    // thing it must never do is return the real key.
    const result = await combineKey([a]).catch(() => null);
    expect(result).not.toBe(key);
  });

  it("gives a wrong key, never a partial one, with too few of a 3-threshold", async () => {
    const key = aKey();
    const [a, b] = await splitKey(key, 4, 3);
    const result = await combineKey([a, b]).catch(() => null);
    expect(result).not.toBe(key);
  });

  it("refuses a threshold below 2, which would make shares pointless", async () => {
    await expect(splitKey(aKey(), 3, 1)).rejects.toThrow(/at least 2/i);
  });

  it("refuses to need more votes than there are guardians", async () => {
    await expect(splitKey(aKey(), 2, 3)).rejects.toThrow(/more votes than/i);
  });

  it("gives every guardian a different share", async () => {
    const shares = await splitKey(aKey(), 5, 3);
    expect(new Set(shares).size).toBe(5);
  });
});
