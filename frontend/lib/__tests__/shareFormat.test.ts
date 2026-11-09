import { describe, expect, it } from "vitest";

import { encodeShare, inspectShares, parseShare } from "../shareFormat";

const SWITCH = "0x72e2bd7cbaf87c2e6168ae9ecec0311b95174c83";
const tagged = (hex: string, threshold = 2, total = 3, addr = SWITCH) =>
  encodeShare({
    threshold,
    total,
    switchAddress: addr,
    fingerprint: "",
    shareHex: hex,
  });

describe("encode / parse", () => {
  it("round-trips", () => {
    const encoded = tagged("deadbeef");
    const parsed = parseShare(encoded);
    expect(parsed).toEqual({
      fingerprint: "",
      threshold: 2,
      total: 3,
      switchAddress: SWITCH,
      shareHex: "deadbeef",
    });
  });

  it("normalises case so copy-paste casing never matters", () => {
    const parsed = parseShare(tagged("DEADBEEF", 2, 3, SWITCH.toUpperCase()));
    expect(parsed?.shareHex).toBe("deadbeef");
    expect(parsed?.switchAddress).toBe(SWITCH);
  });

  it("tolerates surrounding whitespace from a sloppy paste", () => {
    expect(parseShare(`  ${tagged("abcd")}\n`)?.shareHex).toBe("abcd");
  });

  it("still accepts a bare hex share handed out before this format", () => {
    const parsed = parseShare("abcdef01");
    expect(parsed?.shareHex).toBe("abcdef01");
    expect(parsed?.threshold).toBe(0); // unknown, not zero-threshold
    expect(parsed?.switchAddress).toBe("");
  });

  it("rejects nonsense", () => {
    expect(parseShare("")).toBeNull();
    expect(parseShare("not a share")).toBeNull();
    expect(parseShare("hb1:2:3:0xabc")).toBeNull(); // too few fields
    expect(parseShare(`hb1:2:3:${SWITCH}:nothex!`)).toBeNull();
  });
});

describe("inspectShares", () => {
  it("reports the threshold the shares declare", () => {
    const report = inspectShares([tagged("aa"), tagged("bb")], SWITCH);
    expect(report.threshold).toBe(2);
    expect(report.parsed).toHaveLength(2);
  });

  it("flags a share belonging to a different switch", () => {
    const other = "0x1111111111111111111111111111111111111111";
    const report = inspectShares(
      [tagged("aa"), tagged("bb", 2, 3, other)],
      SWITCH,
    );
    expect(report.foreign).toBe(1);
    expect(report.parsed).toHaveLength(1);
  });

  it("flags the same share pasted twice, which adds nothing", () => {
    const report = inspectShares([tagged("aa"), tagged("aa")], SWITCH);
    expect(report.duplicates).toBe(1);
  });

  it("counts unparseable entries", () => {
    const report = inspectShares([tagged("aa"), "garbage!"], SWITCH);
    expect(report.invalid).toBe(1);
  });

  it("reports no threshold when every share is untagged", () => {
    expect(inspectShares(["aabb", "ccdd"], SWITCH).threshold).toBeNull();
  });

  it("accepts untagged shares alongside tagged ones", () => {
    const report = inspectShares([tagged("aa"), "bbcc"], SWITCH);
    expect(report.parsed).toHaveLength(2);
    expect(report.threshold).toBe(2);
  });
});
