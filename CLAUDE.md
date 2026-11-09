# CLAUDE.md: Heartbeat

Context for Claude Code working in this repo. Read this before making changes.

## What this project is

**Heartbeat** is a dead man's switch on Ethereum, built for a hackathon (top-3 prizes).

The owner ("Maya") locks away an encrypted secret (a file, a folder, or a crypto
wallet's recovery phrase) and checks in regularly to prove she's okay. If she stops
checking in, a grace period starts. If the grace period also passes, the switch
**expires**, Maya is locked out, and her trusted **guardians vote** to release it.
Once enough guardians vote (e.g. 2 of 3), the switch is **released** and the
guardians combine their key pieces to unlock the file. A fingerprint stored
on-chain proves the unlocked file is the untouched original.

**Pitch line:** other dead man's switches trust a timer. Heartbeat trusts a timer
*and* the people who know you. Guardian voting prevents false triggers (e.g. the
owner is in hospital, not dead).

**The WikiLeaks angle:** WikiLeaks' 2010 "insurance file" couldn't be proven real
or unaltered. Heartbeat's on-chain fingerprint fixes exactly that.

## Hackathon rules (important)

- **The smart contract must be hand-written by the user, with no AI.** Do **not**
  edit `contracts/src/Heartbeat.sol` or rewrite its logic. If you find a bug in it,
  explain the bug and let the user fix it. Tests and scripts are fair game, but ask first.
- **The frontend may be AI-assisted.** That's what you're here for.
- Submission needs: the contract (100+ lines, done), a ~200-word write-up, and a
  frontend using RainbowKit.

## About the user

- CS student at Berkeley, new to blockchain. Explain things simply and briefly,
  with the *why*, especially blockchain/crypto concepts.
- Uses **NixOS**, Neovim (nvf), VS Code, and tmux.
- Prefers code and answers shown inline in chat rather than as extra files, unless
  a file is clearly needed.
- Wants to understand what's being built. Don't make large changes silently;
  summarize what you changed and why.

## Repo layout

```
heartbeat/
├── flake.nix              # Nix dev shell: foundry + nodejs_22. Run `nix develop`
├── CLAUDE.md              # this file
├── TODO.md
├── contracts/             # Foundry project (run forge commands from here)
│   ├── src/Heartbeat.sol          # the contract (USER-WRITTEN, don't edit)
│   ├── test/Heartbeat.t.sol       # ~35 tests, all passing
│   ├── script/Heartbeat.s.sol     # deploy script
│   ├── out/Heartbeat.sol/Heartbeat.json   # compiled ABI + bytecode (after forge build)
│   ├── broadcast/                 # deploy records (contract addresses)
│   └── lib/forge-std/             # vendored copy (no git submodule)
└── frontend/              # TO CREATE: RainbowKit + wagmi + Next.js app
```

Note: `forge-std` is vendored as plain files and `foundry.lock` was deleted on
purpose, after nested-git-repo issues. Don't reintroduce submodules.

## Environment

- Always work inside `nix develop` from the repo root. It provides `forge`, `anvil`,
  `cast`, and `node`. Global `npm -g` installs are awkward on NixOS, so prefer
  project-local deps or `npx`.
- Foundry comes from nixpkgs (`pkgs.foundry`). Forge downloads the right solc itself.
- Never commit `.env`, `.env.local`, private keys, or API keys. `.gitignore` covers
  `.env`, `node_modules/`, `contracts/out/`, `contracts/cache/`.

## The contract: `Heartbeat.sol`

**One contract per switch.** Each owner deploys their own `Heartbeat`.

### Constructor
```solidity
constructor(uint256 _interval, uint256 _gracePeriod, bytes32 _fingerprint, string memory _ipfsLink)
```
- `msg.sender` (the deployer) becomes `owner`; deploying counts as the first check-in.
- Reverts if `_fingerprint == bytes32(0)` or `_ipfsLink` is empty.

### Lifecycle states (derived, for the UI)
| State | Condition |
|---|---|
| Alive | `!isOverdue()` |
| Grace period (overdue) | `isOverdue() && !isExpired()`: show a warning, owner can still check in |
| Expired | `isExpired() && !released()`: owner locked out, guardians can vote |
| Released | `released()`: guardians can unlock the file |

Check `isExpired()` before `isOverdue()`, since `isOverdue()` stays true after expiry.
There is **no `trigger()` function and no "Expired" event**: expiry is purely
time-based (`block.timestamp > lastCheckIn + interval + gracePeriod`).

### Public state (auto-getters)
| Getter | Returns |
|---|---|
| `owner()` | `address` |
| `lastCheckIn()` | `uint256` (unix seconds) |
| `interval()`, `gracePeriod()` | `uint256` seconds (immutable) |
| `fingerprint()` | `bytes32` (immutable) |
| `ipfsLink()` | `string` (the IPFS CID) |
| `guardianList(uint256 i)` | `address` at index `i` |
| `guardians(address)` | `(bool hasVoted, uint256 whenAdded)` |
| `isGuardian(address)` | `bool` |
| `guardianIndex(address)` | `uint256` |
| `votesNeeded()`, `voteCount()` | `uint256` |
| `released()` | `bool` |

### Functions
| Function | Who / when | Notes |
|---|---|---|
| `checkIn()` | owner, not expired | resets `lastCheckIn` |
| `addGuardian(address)` | owner, not expired | no duplicates, owner can't be a guardian |
| `removeGuardian(address)` | owner, not expired | swap-and-pop; blocked if it would leave fewer guardians than `votesNeeded` |
| `getGuardianCount()` | anyone (view) | |
| `isOverdue()`, `isExpired()` | anyone (view) | |
| `setVotesNeeded(uint256)` | owner, not expired | must be > 0 and ≤ guardian count |
| `confirmRelease()` | guardian, expired | needs `votesNeeded > 0`, not released, hasn't voted; releases when `voteCount == votesNeeded` |

Modifiers: `onlyOwner`, `onlyGuardian`, `notExpired`, `onlyExpired`.
Revert messages are plain `require` strings (e.g. `"Caller is not owner!"`,
`"Switch has expired!"`, `"Switch is not expired!"`, `"Guardian has already voted!"`).
Check the source for exact text before matching on them in the UI.

### Events
```solidity
event CheckedIn(uint256 timestamp);
event GuardianAdded(address indexed guardian);
event GuardianRemoved(address indexed guardian);
event VotesNeededSet(uint256 votesNeeded);
event VoteCast(address indexed guardian, uint256 voteCount);
event Released(uint256 timestamp);
```
Use these for live UI updates and an **activity timeline** (a demo highlight).

## Local development flow (verified working)

```bash
# Window 1 (from repo root)
nix develop
anvil                       # local chain, chain ID 31337, http://127.0.0.1:8545
                            # 10 public test accounts with 10,000 ETH each

# Window 2
nix develop
cd contracts
forge test
forge script script/Heartbeat.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil account 0 key>
```
- First deploy from anvil account 0 lands at `0x5FbDB2315678afecb367f032d93F642f64180aa3`.
- **Anvil forgets everything when restarted.** Redeploy after a restart.
- Time travel on anvil: `cast rpc evm_increaseTime <seconds>` then `cast rpc evm_mine`.
- The full lifecycle (add guardians, set votes, check in, early vote rejected, expire,
  owner locked out, two votes, released) has been run successfully by hand with `cast`.
- The browser wallet (MetaMask/Rabby, a dev-only wallet) has the anvil network
  added (RPC `http://127.0.0.1:8545`, chain ID `31337`) and anvil accounts imported.
  Anvil keys are public; never use them anywhere real.

## Frontend: the plan

### Stack
- **Next.js + React** (scaffolded via `npm init @rainbow-me/rainbowkit@latest`, folder `frontend/`)
- **RainbowKit:** wallet connect UI (`ConnectButton`)
- **wagmi:** contract hooks (`useReadContract`, `useWriteContract`, `useWatchContractEvent`, deploying)
- **viem:** low-level Ethereum utilities
- **WalletConnect projectId** in `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (`.env.local`)
- Chains: the local anvil/foundry chain (id 31337) for development, **Sepolia** for the demo
- ABI: import from `contracts/out/Heartbeat.sol/Heartbeat.json` (or copy into
  `frontend/` with a small sync script). Don't hand-write the ABI.

### Pages
1. **Setup (owner, once)**
   - Pick a file or folder (zip folders client-side, e.g. with `fflate`)
   - Generate a random **salt**; fingerprint = **SHA-256(salt ‖ content)** (Web Crypto,
     32 bytes, fits `bytes32`, and anyone can verify it independently with `sha256sum`)
   - Encrypt (salt + content + filename metadata) with a random **AES-256-GCM** key
     (Web Crypto). Prepend the IV to the ciphertext
   - Upload the ciphertext to **IPFS** via Pinata → CID = `_ipfsLink`
   - Split the AES key with **Shamir secret sharing** (e.g. the `shamir-secret-sharing`
     npm package; verify it before use) into one share per guardian, threshold = votes needed
   - Choose interval + grace period (offer short "demo" presets: e.g. 2 min / 1 min)
   - **Deploy a new Heartbeat** from the browser (wagmi deploy with ABI + bytecode)
   - Show each guardian's key share, plus a share link containing the contract address
2. **Owner dashboard**
   - Status badge (Alive / Grace period / Expired / Released) + live countdown
   - Big **"I'm alive"** button → `checkIn()`
   - Add/remove guardians (paste address), set votes needed
   - Activity timeline from events
3. **Guardian page** (`/switch/[address]` or `?switch=0x…`)
   - Status, vote progress ("1 of 2"), who voted
   - **"Confirm release"** button → `confirmRelease()` (enabled only when expired)
   - After release: enter key shares, combine, download from IPFS, decrypt,
     recompute SHA-256(salt ‖ content), compare to `fingerprint()` → "✅ Verified original"

### Security notes for the frontend
- **Never put the Pinata JWT in client code.** Upload through a Next.js API route
  that reads `PINATA_JWT` from server-side env.
- Nothing secret goes on-chain or in events. Only the CID and fingerprint.
- Key shares never touch the chain or our server. They're shown to the owner to
  hand out privately.
- Guardians should use fresh wallets not linked to their identity (privacy).
- For local dev without Pinata, it's fine to stub IPFS (e.g. store the ciphertext in
  memory/localStorage behind the same interface) so the flow can be demoed offline.

## What exists now (frontend)

```
frontend/
├── app/
│   ├── page.tsx                 landing: explain, connect, create or open a switch
│   ├── setup/page.tsx           create flow: file -> guardians -> votes -> timing -> deploy
│   ├── switch/[address]/page.tsx   one switch's dashboard (3 tabs)
│   ├── api/upload/route.ts      Pinata upload; 501 when PINATA_JWT is unset
│   ├── layout.tsx, providers.tsx, globals.css
│   └── fonts/                   Comic Code (licensed font - do not publish)
├── components/                  StatusPanel, OwnerPanel, GuardianList, GuardianVote,
│                                ActivityTimeline, Tabs, SiteHeader, ConnectPrompt,
│                                SetupWarning, StatusBadge, ui.tsx
├── lib/
│   ├── heartbeat.ts             GENERATED abi + bytecode (npm run sync-abi)
│   ├── contract.ts              heartbeatAt(address)
│   ├── SwitchContext.tsx        which switch the page is showing
│   ├── useHeartbeat.ts          all reads + write helper (shared by every panel)
│   ├── heartbeatState.ts        alive / grace / expired / released, derived locally
│   ├── crypto.ts                salt, SHA-256 fingerprint, AES-256-GCM (Web Crypto)
│   ├── shamir.ts                key splitting (shamir-secret-sharing, verified)
│   ├── ipfs.ts                  upload via the API route, localStorage fallback
│   └── useNow.ts                1-second clock
├── lib/__tests__/               52 vitest tests (npm test)
│                                state machine, crypto, Shamir, full pipeline
└── scripts/sync-abi.mjs         copies the Foundry artifact into lib/heartbeat.ts
```

Working and verified: wallet connect, live status + countdown, check-in, add/remove
guardians, set votes needed, guardian voting, activity timeline from events, and the
full crypto pipeline (fingerprint, encrypt, split 2-of-3, rebuild, decrypt, detect
tampering).

## Tasks left (in order — one at a time)

Deadline pressure is off; these are ordered by what makes the project best.

1. [x] **Test the setup flow in a browser.** DONE — verified on anvil.
2. [x] **Unlock + verify page.** DONE — `components/UnlockPanel.tsx`, "Unlock" tab.
3. [x] **Frontend test suite.** DONE — `npm test`, 38 vitest tests covering the
       state machine (boundaries mirror the contract's strict `>`), hex helpers,
       fingerprinting, AES-GCM round-trips, tamper and wrong-key rejection,
       Shamir thresholds and order-independence, and the full owner -> guardian
       pipeline including "a substituted file fails verification". Verified the
       tests actually catch a regression, not just pass.
4. [x] **Self-describing key shares.** DONE — `lib/shareFormat.ts`. A share is
       now `hb1:<threshold>:<total>:<switchAddress>:<hex>`, so the Unlock tab
       knows how many are needed and can reject shares from another switch or
       the same share pasted twice. Bare-hex shares still parse, so anything
       handed out before this change keeps working. Setup now deploys before
       splitting, since the share has to carry the address.
5. [ ] **One-transaction setup (contract change — user writes it).** Constructor
       takes only interval/grace/fingerprint/ipfsLink, so setup costs 1 deploy +
       1 tx per guardian + 1 for `setVotesNeeded`. Move guardians and votesNeeded
       into the constructor: ~84k gas saved, but the real win is that a
       half-configured switch (which bricks permanently on expiry) becomes
       impossible to create. Tests need updating too.
6. [x] **Pinata.** DONE — account created, `PINATA_JWT` in `frontend/.env.local`,
       real CIDs confirmed (`bafkrei…`) and fetched back from a public gateway.
       The API route uses Pinata v3 (`uploads.pinata.cloud/v3/files`) and must
       send `network: "public"` — v3 defaults to private, which would make files
       unfetchable by guardians. Retrieval tries the dedicated gateway, then
       gateway.pinata.cloud, then ipfs.io.
7. [x] **README.** DONE — `README.md`: WikiLeaks framing, mermaid lifecycle
       diagram, security model with honest limitations, measured gas table,
       run instructions, layout.
8. [ ] **Deploy to Sepolia.** Faucet ETH, `cast wallet import` (never raw keys),
       point the frontend at Sepolia.
9. [ ] **200-word write-up + 2-minute demo** with a short timer so judges watch it
       release live.

Optional if time allows: zip folders before encrypting, per-guardian share links,
a "copy invite link" button.

## Frontend gotchas

- `frontend/package.json` has an `overrides` entry forcing **`cuer@0.0.4`**. Do not
  remove it. RainbowKit 2.2.11 pins `cuer@0.0.3`, which calls the `qr` library with
  `border: 0`; `qr >=0.6` rejects that with `RangeError: invalid border=0`, which
  crashes the whole app at `<RainbowKitProvider>`. cuer 0.0.4 is the upstream fix.
  Drop the override only once RainbowKit bumps its own dependency.
- Restarting anvil invalidates the nonce your browser wallet has cached. If
  transactions start failing oddly, clear the wallet's activity/history data.

## Known limitations (be honest about these in the write-up and README)

- Guardians hold key shares from the start, so enough of them could collude early.
  This is the same trust model as multisig wallets.
- Guardian addresses are public on-chain.
- IPFS files persist only while someone pins them (guardians can pin backups).
- `block.timestamp` can be nudged by validators by a few seconds. That's irrelevant at
  minutes-to-days scales (lint warnings are intentionally disabled with comments).
- Future ideas: timelock encryption, duress check-in, ETH inheritance held in the
  contract, deploying to a cheaper L2, a public "whistleblower mode."

## Useful docs

- Foundry: https://www.getfoundry.sh (scripting, anvil, cast, cheatcodes)
- RainbowKit: https://rainbowkit.com/docs/installation
- wagmi: https://wagmi.sh
- viem: https://viem.sh
- Solidity: https://docs.soliditylang.org
- WalletConnect Cloud (projectId): https://cloud.walletconnect.com
