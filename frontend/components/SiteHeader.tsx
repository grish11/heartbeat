"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

import { NetworkBadge } from "./NetworkBadge";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();

  // The landing page renders its own title inside its box, so there is no
  // second header competing with it there.
  if (pathname === "/") return null;

  return (
    <header className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-4 px-6 py-10">
      <div>
        <Link href="/" className="text-2xl font-bold hover:text-emerald-300">
          Heartbeat
        </Link>
        <p className="text-sm text-neutral-400">
          A dead man&apos;s switch, guarded by people you trust.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <NetworkBadge />
        <ConnectButton />
      </div>
    </header>
  );
}
