"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Which switch the current page is about.
 *
 * Lives in context so the panels don't each need the address threaded through
 * as a prop — and so there is exactly one place that decides which switch is
 * being viewed (the URL).
 */
const SwitchAddressContext = createContext<`0x${string}` | null>(null);

export function SwitchProvider({
  address,
  children,
}: {
  address: `0x${string}`;
  children: ReactNode;
}) {
  return (
    <SwitchAddressContext.Provider value={address}>
      {children}
    </SwitchAddressContext.Provider>
  );
}

export function useSwitchAddress(): `0x${string}` {
  const address = useContext(SwitchAddressContext);
  if (!address) {
    throw new Error("useSwitchAddress must be used inside a <SwitchProvider>.");
  }
  return address;
}
