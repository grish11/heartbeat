"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useBalance } from "wagmi";
import { anvil } from "wagmi/chains";

import { Button, Note } from "./ui";

const ANVIL_RPC = "http://127.0.0.1:8545";
const TOP_UP = parseEther("1000");

/**
 * Local-dev only: tops the connected account up with fake ETH.
 *
 * Anvil pre-funds its own ten accounts, but an account you made yourself in
 * MetaMask starts at zero and can't pay gas. anvil_setBalance just sets it —
 * no faucet, no mining, no real money. Anvil allows cross-origin calls, so
 * the browser can ask it directly.
 *
 * Renders only on chain 31337, so it can never appear on Sepolia or mainnet.
 */
async function rpc(method: string, params: unknown[]) {
  const response = await fetch(ANVIL_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
}

export function DevFaucet() {
  const { address, chainId, isConnected } = useAccount();
  const { data: balance, refetch } = useBalance({ address });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected || chainId !== anvil.id || !address) return null;

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
