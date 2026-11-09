"use client";

// wagmi + RainbowKit configuration.
//
// This module is client-only because RainbowKit's entire bundle is marked
// "use client" — getDefaultConfig cannot be called from a server component.
// That rules out the cookieToInitialState pattern in wagmi's generic SSR guide;
// RainbowKit's own App Router example keeps the config on the client instead:
// https://github.com/rainbow-me/rainbowkit/tree/main/examples/with-next-app
//
// Docs:
//   RainbowKit install    https://rainbowkit.com/docs/installation
//   wagmi SSR guide       https://wagmi.sh/react/guides/ssr
//   getDefaultConfig src  https://github.com/rainbow-me/rainbowkit/blob/main/packages/rainbowkit/src/config/getDefaultConfig.ts

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { anvil, sepolia } from "wagmi/chains";
import { cookieStorage, createStorage, http } from "wagmi";

// RainbowKit wires up every connector at once, including WalletConnect, so this
// field is mandatory even when you only ever connect a browser extension.
// Extensions (MetaMask/Rabby) inject themselves into the page and never touch
// WalletConnect's relay servers — only the "scan a QR code" path does.
// Get one free at https://dashboard.reown.com
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "PLACEHOLDER_PROJECT_ID";

// getDefaultConfig forwards transports/storage/ssr/pollingInterval/batch straight
// through to wagmi's createConfig (verified in the source linked above; the
// custom-chains docs don't mention it).
export function getConfig() {
  return getDefaultConfig({
    appName: "Heartbeat",
    projectId,
    chains: [anvil, sepolia],
    transports: {
      // viem's `anvil` chain already points at 127.0.0.1:8545, but being explicit
      // means the URL is visible here rather than buried in a dependency.
      [anvil.id]: http("http://127.0.0.1:8545"),
      [sepolia.id]: http(),
    },
    // ssr: true stops wagmi hydrating from storage during the server render,
    // and cookie storage persists the connection across reloads.
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  });
}
