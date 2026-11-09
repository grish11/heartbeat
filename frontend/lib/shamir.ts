"use client";

import { combine, split } from "shamir-secret-sharing";

import { fromHex, toHex } from "./crypto";

/**
 * Splits the AES key into one share per guardian, where any `threshold` of
 * them can rebuild it and fewer reveal nothing.
 *
 * Library: shamir-secret-sharing (Privy, Apache-2.0, zero dependencies).
 * Verified locally before use: every 2-of-3 pair reconstructs the key exactly,
 * and a single share is rejected outright.
 */
export async function splitKey(
  keyHex: string,
  shareCount: number,
  threshold: number,
): Promise<string[]> {
  if (threshold < 2) throw new Error("Threshold must be at least 2.");
  if (shareCount < threshold) {
    throw new Error("Cannot need more votes than there are guardians.");
  }
  const shares = await split(fromHex(keyHex), shareCount, threshold);
  return shares.map((share) => toHex(share));
}

export async function combineKey(shareHexes: string[]): Promise<string> {
  return toHex(await combine(shareHexes.map((hex) => fromHex(hex))));
}
