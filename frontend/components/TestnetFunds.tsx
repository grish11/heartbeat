"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { anvil, sepolia } from "wagmi/chains";

import { Button, Note } from "./ui";

const ANVIL_RPC = "http://127.0.0.1:8545";
const TOP_UP = parseEther("1000");

/** One JSON-RPC call to the local Anvil node. */
async function rpc(method: string, params: unknown[]) {
  const response = await fetch(ANVIL_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
}

/**
 * Public Sepolia faucets. There is no API to automate these: they are gated by
 * captchas and account checks precisely because the ETH is free.
 */
const SEPOLIA_FAUCETS: [string, string][] = [
  [
    "Google Cloud",
    "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
  ],
  ["Alchemy", "https://www.alchemy.com/faucets/ethereum-sepolia"],
  ["Infura", "https://www.infura.io/faucet/sepolia"],
];

/**
 * Shows the connected account's balance, and how to top it up.
 *
 * On Anvil this is a button: anvil_setBalance rewrites the balance outright,
 * because Anvil is a toy chain the developer controls. No real network has an
 * equivalent — minting yourself money is precisely what a blockchain prevents —
 * so on Sepolia this points at faucets instead.
 *
 * Renders on Anvil and Sepolia only, never on a network with real money.
 */
export function TestnetFunds() {
  const { address, chainId, isConnected } = useAccount();
  const { data: balance, refetch } = useBalance({ address });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAnvil = chainId === anvil.id;
  const onSepolia = chainId === sepolia.id;
  if (!isConnected || !address || (!onAnvil && !onSepolia)) return null;

  async function fund() {
    setBusy(true);
    setError(null);
    try {
      await rpc("anvil_setBalance", [address, `0x${TOP_UP.toString(16)}`]);
      // Wallets only re-read balances when a new block appears. anvil_setBalance
      // edits state without mining one, so MetaMask would sit on the stale
      // value until its next poll — mine an empty block to nudge it.
      await rpc("evm_mine", []);
      await refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `${caught.message} — is anvil running?`
          : "Could not reach anvil.",
      );
    } finally {
      setBusy(false);
    }
  }

  const empty = balance !== undefined && balance.value === 0n;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="text-xs text-neutral-500">
        Local chain balance:{" "}
        <span className={empty ? "text-amber-300" : "text-neutral-300"}>
          {balance
            ? `${Number(formatEther(balance.value)).toFixed(2)} ETH`
            : "…"}
        </span>
      </span>
      <Button onClick={fund} busy={busy}>
        Get test ETH
      </Button>
      {empty && <Note>You need test ETH to pay gas on anvil.</Note>}
      {error && <Note tone="error">{error}</Note>}
    </div>
  );
}
