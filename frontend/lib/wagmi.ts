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

/**
 * Sepolia's own RPC endpoint.
 *
 * Falls back to viem's public default when unset, which works but is shared
 * and rate-limited — fine for development, risky mid-demo. Point this at an
 * Infura or Alchemy endpoint for anything people will watch.
 */
const sepoliaRpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

/**
 * Which chain the app defaults to before a wallet picks one.
 *
 * Local work wants anvil; a deployed site must default to Sepolia, or every
 * visitor's browser tries to reach a node on their own machine.
 */
const defaultToSepolia = process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "sepolia";

// getDefaultConfig forwards transports/storage/ssr/pollingInterval/batch straight
// through to wagmi's createConfig (verified in the source linked above; the
// custom-chains docs don't mention it).
export function getConfig() {
  return getDefaultConfig({
    appName: "Heartbeat",
    projectId,
    // The first entry is wagmi's default. A deployed site must not offer Anvil
    // at all: a visitor who picks it would be pointed at a node on their own
    // machine, which does not exist.
    chains: defaultToSepolia ? [sepolia] : [anvil, sepolia],
    transports: {
      // viem's `anvil` chain already points at 127.0.0.1:8545, but being explicit
      // means the URL is visible here rather than buried in a dependency.
      [anvil.id]: http("http://127.0.0.1:8545"),
      [sepolia.id]: sepoliaRpc ? http(sepoliaRpc) : http(),
    },
    // ssr: true stops wagmi hydrating from storage during the server render,
    // and cookie storage persists the connection across reloads.
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  });
}
