import { heartbeatAbi } from "./heartbeat";

/** Builds the wagmi contract descriptor for one particular switch. */
export function heartbeatAt(address: `0x${string}`) {
  return { address, abi: heartbeatAbi } as const;
}

/**
 * Only used to prefill the "open an existing switch" box during local
 * development — the app is no longer tied to a single address.
 */
export const DEV_SWITCH_ADDRESS = process.env.NEXT_PUBLIC_HEARTBEAT_ADDRESS as
  `0x${string}` | undefined;
