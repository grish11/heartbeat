/** Shared display helpers. */

/** `0x1234…abcd` — one definition, so every address renders identically. */
export function shortHex(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}
