# TODO

Work left before submission. Ordered by value, not by effort.

Deadline: **next week**. Everything required to submit is already done — the
items below make the project better, not merely finished.

---

## 1. One-transaction setup — contract change, hand-written

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

## 2. Custom domain

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

## 3. Trim the demo video

Currently **4m55s**. Judges watching many submissions rarely finish a five
minute video.

- [ ] Cut to ~2 minutes: create → expire → guardians vote → unlock verified.
- [ ] Re-upload through a GitHub issue comment and replace the URL in the
      README. Do not delete the old comment until the new URL is in place.

The setup explanation belongs in the README, which already has it.

---

## 4. Per-guardian invite links

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
- **Multi-chain.** Sepolia, Base Sepolia, Base and Ethereum, all four verified
  live through Infura from both origins. Testnets are listed first so a
  real-money chain is always a deliberate choice. `NetworkBadge` labels the
  connected chain "test network" or "real money"; `RealMoneyWarning` estimates
  the setup cost at current gas and blocks creation until acknowledged. One
  `NEXT_PUBLIC_INFURA_KEY` serves every chain, varying only the subdomain.

  Still worth doing once: **create a switch on Base Sepolia** and run it through
  to unlock, to confirm the flow holds on a chain that is not Sepolia.
