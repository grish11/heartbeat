"use client";

import { useEffect, useState } from "react";

/**
 * One guardian's key share, with a way to actually get it off the screen.
 *
 * These are generated in the browser and stored nowhere — not on-chain, not on
 * any server. This render is the only time they exist, so copying has to be
 * one click or people will lose them.
 */
export function ShareCard({
  guardian,
  share,
  index,
}: {
  guardian: string;
  share: string;
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <li className="rounded-lg border border-white/10 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs text-neutral-500">Guardian {index + 1}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(share);
            setCopied(true);
          }}
          className="rounded border border-white/15 px-2 py-0.5 text-xs text-neutral-300 hover:bg-white/10 hover:text-white"
        >
          {copied ? "copied ✓" : "copy share"}
        </button>
      </div>
      <code className="mt-1 block text-xs break-all text-neutral-400">
        {guardian}
      </code>
      <code className="mt-2 block font-mono text-xs break-all text-emerald-300">
        {share}
      </code>
    </li>
  );
}

/** Saves every share to a text file, so nothing depends on this tab staying open. */
export function DownloadShares({
  guardians,
  shares,
  switchAddress,
}: {
  guardians: string[];
  shares: string[];
  switchAddress: string | null;
}) {
  function download() {
    const body = [
      "Heartbeat — guardian key shares",
      `Switch: ${switchAddress ?? "(pending)"}`,
      "",
      "Give each guardian ONLY their own share, privately.",
      "These are stored nowhere else. If lost, the file cannot be decrypted.",
      "",
      ...shares.map(
        (share, i) => `Guardian ${i + 1}: ${guardians[i]}\n${share}\n`,
      ),
    ].join("\n");

    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "heartbeat-key-shares.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-500/15"
    >
      Download all shares
    </button>
  );
}
