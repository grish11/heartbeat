"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";

import { TestnetFunds } from "@/components/TestnetFunds";
import { Button, Note, TextInput } from "@/components/ui";
import { DEV_SWITCH_ADDRESS } from "@/lib/contract";

export default function Home() {
  const devSwitch = DEV_SWITCH_ADDRESS;
  const router = useRouter();
  const { isConnected } = useAccount();
  const [lookup, setLookup] = useState("");

  const valid = isAddress(lookup);

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Image
              src="/heart.png"
              alt=""
              width={32}
              height={32}
              className="[image-rendering:pixelated]"
              priority
            />
            Heartbeat
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            A dead man&apos;s switch, guarded by people you trust.
          </p>
        </div>

        <section>
          <h3 className="text-sm uppercase tracking-wider text-neutral-500">
            Connect your wallet
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-5">
            <p className="max-w-sm text-sm text-neutral-400">
              Your wallet is how the contract knows a check-in really came from
              you. Connect one to create a switch, check in, or vote. Reading a
              switch needs no wallet at all.
            </p>
            <ConnectButton />
          </div>
          <TestnetFunds />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-sm uppercase tracking-wider text-neutral-500">
              Create a switch
            </h3>
            <p className="mt-2 flex-1 text-sm text-neutral-400">
              Encrypt a file, pick your guardians, set your timer.
            </p>
            <div className="mt-4">
              <Button
                variant="primary"
                disabled={!isConnected}
                onClick={() => router.push("/setup")}
              >
                Create a switch
              </Button>
              {!isConnected && <Note>Connect a wallet first.</Note>}
            </div>
          </div>

          <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-sm uppercase tracking-wider text-neutral-500">
              Open an existing switch
            </h3>
            <p className="mt-2 flex-1 text-sm text-neutral-400">
              Paste a switch address. No wallet needed to look.
            </p>
            <div className="mt-4 flex gap-2">
              <TextInput
                value={lookup}
                onChange={setLookup}
                placeholder="0x…"
              />
              <Button
                disabled={!valid}
                onClick={() => router.push(`/switch/${lookup}`)}
              >
                Open
              </Button>
            </div>
            {lookup !== "" && !valid && (
              <Note tone="error">That isn&apos;t a valid address.</Note>
            )}
            {devSwitch && (
              <Note>
                Local dev switch:{" "}
                <button
                  className="block break-all text-left font-mono underline underline-offset-4 hover:text-neutral-200"
                  onClick={() => setLookup(devSwitch)}
                >
                  {devSwitch}
                </button>
              </Note>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
