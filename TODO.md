HEARTBEAT TODO

What it does:

- Owner locks an encrypted file (stored on IPFS)
- Owner checks in regularly to reset a timer
- Miss a check-in -> grace period starts
- Grace period ends -> switch triggers
- Guardians vote to release (e.g. 2 of 3)
- Guardians combine their key pieces to unlock the file
- File fingerprint proves it was never changed

TODO:

- Write the contract: check-in, timer, grace period, trigger, guardian voting,
  file fingerprint, events
- Test it locally
- Build the frontend: wallet connect, countdown, "I'm alive" button, guardian
  page, file encrypt + upload
- Deploy to Sepolia
- Write the 200-word write-up
- Prepare the demo (2-minute timer)
