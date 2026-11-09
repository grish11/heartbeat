// Copies the Heartbeat ABI + bytecode out of the Foundry build artifact and into
// a committed TypeScript module.
//
// Why this exists: `contracts/out/` is gitignored, so the frontend cannot import
// the artifact directly — a fresh clone would fail to build until someone ran
// `forge build`. Generating a committed file keeps the frontend self-contained
// while staying a mechanical copy of the real compiler output (never hand-edited).
//
// Runs automatically via the `predev` / `prebuild` npm lifecycle hooks.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifactPath = resolve(here, "../../contracts/out/Heartbeat.sol/Heartbeat.json");
const outPath = resolve(here, "../lib/heartbeat.ts");

if (!existsSync(artifactPath)) {
  console.error(
    `\nsync-abi: no build artifact at\n  ${artifactPath}\n\n` +
      `Run \`forge build\` in contracts/ first (inside \`nix develop\`).\n`,
  );
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const { abi, bytecode } = artifact;

if (!Array.isArray(abi) || abi.length === 0) {
  console.error("sync-abi: artifact has no ABI — is the contract compiling?");
  process.exit(1);
}
if (typeof bytecode?.object !== "string" || !bytecode.object.startsWith("0x")) {
  console.error("sync-abi: artifact has no deployable bytecode.");
  process.exit(1);
}

const banner = `// GENERATED FILE — do not edit by hand.
// Regenerate with \`npm run sync-abi\` (runs automatically before \`dev\` and \`build\`).
// Source: contracts/out/Heartbeat.sol/Heartbeat.json, produced by \`forge build\`.
`;

// \`as const\` is what gives wagmi its type inference over functionName/args.
// https://wagmi.sh/react/api/hooks/useReadContract
const body = `
export const heartbeatAbi = ${JSON.stringify(abi, null, 2)} as const;

// Creation bytecode, for deploying a new switch straight from the browser.
export const heartbeatBytecode =
  "${bytecode.object}" as const;
`;

writeFileSync(outPath, banner + body, "utf8");

const fns = abi.filter((e) => e.type === "function").length;
const evs = abi.filter((e) => e.type === "event").length;
console.log(`sync-abi: wrote lib/heartbeat.ts (${fns} functions, ${evs} events)`);
