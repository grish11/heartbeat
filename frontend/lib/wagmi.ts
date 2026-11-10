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
import { anvil, base, baseSepolia, mainnet, sepolia } from "wagmi/chains";
import { cookieStorage, createStorage, http } from "wagmi";

// RainbowKit wires up every connector at once, including WalletConnect, so this
// field is mandatory even when you only ever connect a browser extension.
// Extensions (MetaMask/Rabby) inject themselves into the page and never touch
// WalletConnect's relay servers — only the "scan a QR code" path does.
// Get one free at https://dashboard.reown.com
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "PLACEHOLDER_PROJECT_ID";

/**
 * Infura serves every chain from the same key, varying only the subdomain, so
 * one env var covers all of them. Each network also has to be ticked on in the
 * Infura dashboard, and every origin added to its allowlist — a missing origin
 * answers 403 and every read fails silently.
 */
const INFURA_KEY = process.env.NEXT_PUBLIC_INFURA_KEY;

function infura(subdomain: string) {
  return INFURA_KEY
    ? http(`https://${subdomain}.infura.io/v3/${INFURA_KEY}`)
    : http(); // viem's public default: works, but shared and rate-limited
}

/**
 * Which chain the app defaults to before a wallet picks one.
 *
 * Local work wants anvil; a deployed site must not offer it at all, since a
 * visitor selecting it would be pointed at a node on their own machine.
 */
const deployed = process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "sepolia";

// getDefaultConfig forwards transports/storage/ssr/pollingInterval/batch straight
// through to wagmi's createConfig (verified in the source linked above; the
// custom-chains docs don't mention it).
export function getConfig() {
  return getDefaultConfig({
    appName: "Heartbeat",
    projectId,
    // The first entry is wagmi's default. Testnets lead deliberately: the two
    // real-money chains should be a deliberate choice, never a stray click.
    chains: deployed
      ? [sepolia, baseSepolia, base, mainnet]
      : [anvil, sepolia, baseSepolia, base, mainnet],
    transports: {
      // viem's `anvil` chain already points at 127.0.0.1:8545, but being
      // explicit keeps the URL visible here rather than buried in a dependency.
      [anvil.id]: http("http://127.0.0.1:8545"),
      [sepolia.id]: infura("sepolia"),
      [baseSepolia.id]: infura("base-sepolia"),
      [base.id]: infura("base-mainnet"),
      [mainnet.id]: infura("mainnet"),
    },
    // ssr: true stops wagmi hydrating from storage during the server render,
    // and cookie storage persists the connection across reloads.
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
  });
}
