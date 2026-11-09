"use client";

// Provider stack for wagmi + RainbowKit.
// Nesting order (WagmiProvider -> QueryClientProvider -> RainbowKitProvider) is
// prescribed by https://rainbowkit.com/docs/installation

import "@rainbow-me/rainbowkit/styles.css";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { getConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  // Lazy initialisers so neither object is rebuilt on every render.
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({ borderRadius: "medium" })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
