"use client";

import { use } from "react";
import { isAddress } from "viem";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ConnectPrompt } from "@/components/ConnectPrompt";
import { GuardianList } from "@/components/GuardianList";
import { GuardianVote } from "@/components/GuardianVote";
import { OwnerPanel } from "@/components/OwnerPanel";
import { SetupWarning } from "@/components/SetupWarning";
import { StatusPanel } from "@/components/StatusPanel";
import { UnlockPanel } from "@/components/UnlockPanel";
import { Tabs } from "@/components/Tabs";
import { SwitchProvider } from "@/lib/SwitchContext";

export default function SwitchPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);

  if (!isAddress(address)) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6">
        <p className="text-red-300">
          <code className="break-all">{address}</code> is not a valid Ethereum
          address.
        </p>
      </div>
    );
  }

  return (
    <SwitchProvider address={address}>
      <ConnectPrompt />
      <SetupWarning />
      <Tabs
        tabs={[
          {
            id: "switch",
            label: "Switch",
            content: (
              <>
                <StatusPanel />
                <OwnerPanel />
                <GuardianVote />
              </>
            ),
          },
          { id: "guardians", label: "Guardians", content: <GuardianList /> },
          { id: "unlock", label: "Unlock", content: <UnlockPanel /> },
          { id: "activity", label: "Activity", content: <ActivityTimeline /> },
        ]}
      />
    </SwitchProvider>
  );
}
