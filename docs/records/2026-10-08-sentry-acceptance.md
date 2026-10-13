---
type: record
kind: verification
description: Read for which Sentry surfaces still need live deployment verification.
version: 1.0.0
status: open
date: 2026-10-08
---

# Sentry acceptance

Setup and bindings: [Sentry runbook](../runbooks/sentry.md). Repository tests cover
redaction, rethrow/deduplication, and log selection.

## Open

- [ ] Live browser, Worker, and native symbolication.
- [ ] Native replay and profiling.
- [ ] Feedback image delivery.
- [ ] Dashboard alerts: new/regressed issues, crash-free sessions, Expo emergency launch.
- [ ] Hosted backend forwarder, including a scheduled backend failure. Until it is
      hosted, unattended backend coverage is a gap.
