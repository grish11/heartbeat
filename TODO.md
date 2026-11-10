# TODO

Work left before submission. Ordered by value, not by effort.

Deadline: **next week**. Everything required to submit is already done — the
items below make the project better, not merely finished.

---

## 1. Multi-chain: let people pick Ethereum, an L2, or Sepolia

**Why.** The contract is chain-agnostic; nothing in it assumes a network. Right
now the frontend hardcodes one choice. Offering several makes a concrete point
to a judge: *the design works anywhere, and here is what each one costs.*

**Chains to support** (all exported by `viem/chains`, ids verified):

| Chain | viem export | id | Role |
|---|---|---|---|
| Sepolia | `sepolia` | 11155111 | free testing, the default |
| Base Sepolia | `baseSepolia` | 84532 | free L2 testing |
| Base | `base` | 8453 | real L2, real money |
| Ethereum | `mainnet` | 1 | real L1, real money |

**Measured gas prices** (nominal $3000/ETH; L2 figures exclude the L1 data fee,
so treat them as a floor):

| Chain | gas price | deploy a switch | one check-in |
|---|---|---|---|
| Ethereum | 0.0950 gwei | $0.51 | $0.008 |
| Base | 0.0060 gwei | $0.03 | ~$0.000 |
| Arbitrum | 0.0203 gwei | $0.11 | $0.002 |
| Optimism | 0.0010 gwei | $0.01 | ~$0.000 |

Mainnet is unusually cheap right now. At a busy 30 gwei that deploy is **$160**,
which is the actual argument for an L2 — they stay cheap when mainnet does not.

**Steps**

- [ ] Add the chains to `frontend/lib/wagmi.ts`, with a transport each. Keep
      `NEXT_PUBLIC_DEFAULT_CHAIN` deciding which is first.
- [ ] Get an RPC endpoint per chain. Infura covers all of these — tick them in
      the dashboard, then add `NEXT_PUBLIC_BASE_RPC_URL` etc.
- [ ] **Add every new origin to the Infura allowlist**, including
      `localhost:3000`. A missing origin returns `403 rejected due to project ID
      settings` and every read silently fails.
- [ ] Show the connected chain prominently on the switch page. A guardian
      looking at the wrong network sees a valid-looking address and the wrong
      contract.
- [ ] **Guard the real-money chains.** Before deploying on `mainnet` or `base`,
      show the estimated cost in ETH and ask for explicit confirmation. Someone
      clicking through a hackathon demo must not spend real money by accident.
- [ ] Deploy a demo switch on Base Sepolia and verify the whole flow there.

**Watch out:** each chain is a separate world. A switch on Base does not exist
on Ethereum. The same address on two chains is two unrelated contracts — which
is exactly why shares carry a fingerprint tag.

---

## 2. One-transaction setup — contract change, hand-written

**Why this is the most valuable item.** Creating a switch currently costs
1 deploy + 1 tx per guardian + 1 for `setVotesNeeded` — five wallet prompts for
three guardians. Worse, a switch can exist **half-configured**, and if it
expires in that state it is bricked forever: every owner function is
`notExpired`, and `confirmRelease` needs `votesNeeded > 0`, so nobody can check
in, configure, or release it. Ever.

Moving guardians and the threshold into the constructor makes that state
**impossible to represent**, rather than something the UI warns about.

**What to write** (this is your Solidity — no AI):

- [ ] Add two constructor parameters: an array of guardian addresses and
      `votesNeeded`.
- [ ] Loop the array, doing what `addGuardian` does today: reject duplicates,
      reject the owner, fill `guardianIndex`/`guardianList`/`guardians`/
      `isGuardian`, emit `GuardianAdded`.
- [ ] Apply the same validation `setVotesNeeded` does — greater than zero, not
      more than the guardian count — then store it and emit `VotesNeededSet`.
- [ ] Update `contracts/test/Heartbeat.t.sol`; every test that calls the
      constructor needs the new arguments.
- [ ] Decide whether `addGuardian`/`removeGuardian`/`setVotesNeeded` stay. Keeping
      them allows changing guardians later; removing them shrinks the contract.

**Then I will:** re-run `npm run sync-abi`, collapse the setup flow to a single
deploy, delete `SetupWarning` (the case it warns about stops existing), and
update the README's gas table and obstacles list.

Saves ~84k gas, about 4%. The gas is not the point; the impossible-bad-state is.

---

## 3. Custom domain

**Why.** The first thing a judge currently sees is MetaMask warning *"signs of
phishing or wallet-draining activity"*. It is a false positive — new domain,
`*.vercel.app` (heavily abused by drainers), and an app that asks a fresh wallet
to deploy a contract then sign four more transactions, which is structurally
what a drainer does. A real domain removes most of the suspicion.

- [ ] Buy a domain (~$10).
- [ ] Add it in Vercel → Settings → Domains, follow the DNS instructions.
- [ ] Add the new origin to the Infura allowlist.
- [ ] Update the README and the submission links.

Highest impact per minute of work on this list.

---

## 4. Trim the demo video

Currently **4m55s**. Judges watching many submissions rarely finish a five
minute video.

- [ ] Cut to ~2 minutes: create → expire → guardians vote → unlock verified.
- [ ] Re-upload through a GitHub issue comment and replace the URL in the
      README. Do not delete the old comment until the new URL is in place.

The setup explanation belongs in the README, which already has it.

---

## 5. Per-guardian invite links

Copying three addresses by hand is the clumsiest part of setup.

- [ ] Generate one link per guardian carrying the switch address and that
      guardian's share.
- [ ] Decide where the share lives. In the URL fragment (`#...`) it never
      reaches a server — but it does land in browser history. Worth stating
      the trade-off wherever it is shown.

---

## Done

- Contract, 34 Foundry tests, 100% line coverage
- Frontend: landing, setup, dashboard, guardian voting, activity, unlock+verify
- 71 frontend tests
- In-browser crypto: fingerprint, AES-256-GCM, Shamir 2-of-3
- Pinata uploads with a localStorage fallback
- README with sources, demo video, public repo
- Live on Sepolia at <https://heartbeat-indol.vercel.app>
- 200-word write-up
