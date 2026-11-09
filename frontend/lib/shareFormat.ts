/**
 * Guardian shares carry their own context.
 *
 * A bare hex share says nothing about which switch it belongs to or how many
 * are needed — and the Shamir threshold is recorded nowhere else in the system
 * (not on-chain, not in the contract, nowhere). That left guardians guessing,
 * and let shares from two different switches be mixed with no warning beyond
 * an opaque decryption failure.
 *
 * Format:  hb1:<threshold>:<total>:<switchAddress>:<fpPrefix>:<shareHex>
 *
 * The fingerprint prefix matters more than it looks. A contract address is NOT
 * a unique identifier for a switch: anvil derives addresses from sender+nonce,
 * so restarting it and redeploying puts a brand new switch at an address an old
 * one already used. Shares tagged only with an address then look valid and fail
 * opaquely at decryption. The fingerprint identifies the actual file.
 *
 * Five-field (no fingerprint) and bare-hex shares still parse, so anything
 * handed out before this change keeps working.
 */

const PREFIX = "hb1";

export type ParsedShare = {
  threshold: number;
  total: number;
  switchAddress: string;
  /** First 10 hex chars of the file's fingerprint, or "" when untagged. */
  fingerprint: string;
  shareHex: string;
};

/** Shares carry a short prefix rather than the whole 64-char fingerprint. */
export function fingerprintTag(fingerprint: string): string {
  return fingerprint.replace(/^0x/, "").slice(0, 10).toLowerCase();
}

export function encodeShare(share: ParsedShare): string {
  return [
    PREFIX,
    share.threshold,
    share.total,
    share.switchAddress.toLowerCase(),
    share.fingerprint,
    share.shareHex,
  ].join(":");
}

/**
 * Accepts the tagged format, and also a bare hex string so shares handed out
 * before this format existed still work.
 */
export function parseShare(raw: string): ParsedShare | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith(`${PREFIX}:`)) {
    // Legacy / untagged: usable, but we learn nothing from it.
    return /^[0-9a-fA-F]+$/.test(trimmed)
      ? {
          threshold: 0,
          total: 0,
          switchAddress: "",
          fingerprint: "",
          shareHex: trimmed.toLowerCase(),
        }
      : null;
  }

  const parts = trimmed.split(":");
  // 6 fields = current format; 5 = earlier shares with no fingerprint tag.
  if (parts.length !== 6 && parts.length !== 5) return null;
  const [, threshold, total, switchAddress] = parts;
  const fingerprint = parts.length === 6 ? parts[4].toLowerCase() : "";
  const shareHex = parts[parts.length - 1];
  if (!/^[0-9a-fA-F]+$/.test(shareHex)) return null;

  return {
    threshold: Number(threshold) || 0,
    total: Number(total) || 0,
    switchAddress: switchAddress.toLowerCase(),
    fingerprint,
    shareHex: shareHex.toLowerCase(),
  };
}

/** What the Unlock tab needs to know about a set of pasted shares. */
export type ShareSetReport = {
  parsed: ParsedShare[];
  /** Shares that are not valid in any format. */
  invalid: number;
  /** Shares tagged for a different switch than the one being viewed. */
  foreign: number;
  /** Threshold the shares claim, or null when none of them say. */
  threshold: number | null;
  /** Duplicate pastes of the same share — they add nothing. */
  duplicates: number;
  /**
   * Shares tagged for a different FILE than this switch currently holds.
   * Almost always an old switch redeployed to the same address.
   */
  staleFingerprint: number;
};

export function inspectShares(
  raws: string[],
  switchAddress: string,
  fingerprint?: string,
): ShareSetReport {
  const parsed: ParsedShare[] = [];
  const expected = fingerprint ? fingerprintTag(fingerprint) : "";
  let invalid = 0;
  let foreign = 0;
  let staleFingerprint = 0;

  for (const raw of raws) {
    const share = parseShare(raw);
    if (!share) {
      invalid++;
      continue;
    }
    if (
      share.switchAddress &&
      share.switchAddress !== switchAddress.toLowerCase()
    ) {
      foreign++;
      continue;
    }
    if (expected && share.fingerprint && share.fingerprint !== expected) {
      staleFingerprint++;
      continue;
    }
    parsed.push(share);
  }

  const thresholds = parsed.map((s) => s.threshold).filter((t) => t > 0);
  const duplicates =
    parsed.length - new Set(parsed.map((s) => s.shareHex)).size;

  return {
    parsed,
    invalid,
    foreign,
    threshold: thresholds.length > 0 ? Math.max(...thresholds) : null,
    duplicates,
    staleFingerprint,
  };
}
