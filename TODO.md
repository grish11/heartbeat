# TODO

Work left before submission. Ordered by value, not by effort.

Deadline: **next week**. Everything required to submit is already done — the
items below make the project better, not merely finished.

---

## 1. Custom domain

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

## 2. Trim the demo video

Currently **4m55s**. Judges watching many submissions rarely finish a five
minute video.

- [ ] Cut to ~2 minutes: create → expire → guardians vote → unlock verified.
- [ ] Re-upload through a GitHub issue comment and replace the URL in the
      README. Do not delete the old comment until the new URL is in place.

The setup explanation belongs in the README, which already has it.

---

## 3. Per-guardian invite links

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
- **One-transaction setup.** Guardians and votesNeeded are constructor
  arguments, validated before the contract exists, so a deploy produces a
  complete switch or nothing at all. Zero guardians is unconstructable, which
  removes the bricking case entirely. Guardian count capped at 50. Creating a
  2-of-3 switch is 2,128,920 gas in one transaction, 75k less than the old five.
  Contract tests 34 -> 45, line coverage 100% (77/77).
- **Multi-chain.** Sepolia, Base Sepolia, Base and Ethereum, all four verified
  live through Infura from both origins. Testnets are listed first so a
  real-money chain is always a deliberate choice. `NetworkBadge` labels the
  connected chain "test network" or "real money"; `RealMoneyWarning` estimates
  the setup cost at current gas and blocks creation until acknowledged. One
  `NEXT_PUBLIC_INFURA_KEY` serves every chain, varying only the subdomain.

  Still worth doing once: **create a switch on Base Sepolia** and run it through
  to unlock, to confirm the flow holds on a chain that is not Sepolia.
