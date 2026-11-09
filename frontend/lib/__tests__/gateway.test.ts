import { describe, expect, it } from "vitest";

/**
 * Mirrors normalizeGateway in lib/ipfs.ts. Kept in sync deliberately: the
 * function is module-private because nothing else should call it, but the
 * bare-hostname case silently broke unlocking and must not regress.
 */
function normalizeGateway(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const withoutTrailingSlash = withScheme.replace(/\/+$/, "");
  const withPath = /\/ipfs$/i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/ipfs`;
  return `${withPath}/`;
}

describe("gateway normalisation", () => {
  const expected = "https://xyz.mypinata.cloud/ipfs/";

  it.each([
    ["bare hostname, as Pinata's dashboard shows it", "xyz.mypinata.cloud"],
    ["hostname with scheme", "https://xyz.mypinata.cloud"],
    ["with trailing slash", "https://xyz.mypinata.cloud/"],
    ["already complete", "https://xyz.mypinata.cloud/ipfs/"],
    ["complete, no trailing slash", "https://xyz.mypinata.cloud/ipfs"],
    ["padded with whitespace", "  xyz.mypinata.cloud  "],
  ])("%s", (_label, input) => {
    expect(normalizeGateway(input)).toBe(expected);
  });

  it("produces an absolute url, never a relative one", () => {
    // The actual bug: a relative url resolved against localhost:3000 and
    // returned the app's own HTML with a 200.
    const result = normalizeGateway("xyz.mypinata.cloud");
    expect(result?.startsWith("https://")).toBe(true);
    expect(() => new URL(`${result}bafkreiabc`)).not.toThrow();
  });

  it("returns null when unset or blank", () => {
    expect(normalizeGateway(undefined)).toBeNull();
    expect(normalizeGateway("   ")).toBeNull();
  });
});
