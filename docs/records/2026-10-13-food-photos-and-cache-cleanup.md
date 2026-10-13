---
type: record
kind: verification
description: Read for food photo storage and local cache cleanup evidence as of 2026-10-13.
version: 1.0.0
status: open
date: 2026-10-13
---

# Food photos and local account cache retirement

Follow-up to issue 89 after the sole user confirmed build 20 upload and cleanup.
Manual Food and One-off Entry photos now use Convex storage IDs; OFF visuals use
provider URLs with `expo-image` memory/disk caching. Existing ambiguous OFF images
adopt the provider image. Custom OFF crops become own account photos.

Account library and revision stores use independent in-memory SQLite connections.
Diary/goals/measures/servings snapshots use bounded session maps. Disk retains
optional remembered portions/favorites, goal display order, bounded OFF request
cache, general device settings and Set Drafts. Empty legacy source files and old
account mirrors are retired. Unknown originals and unacknowledged legacy journals
are guarded; an old manual photo source survives until upload acknowledgement.

Removed the legacy library outbox, diary replay, saved-note database and recipe
migration implementation. New writes still require a connection and server ACK;
failed editor input remains available for retry while the editor stays open.

## Automated verification

- Root: 63 suites, 455 tests passed.
- Mobile: 91 suites, 565 tests passed.
- Root and mobile TypeScript passed; Biome/mobile architecture passed.
- Web build passed.
- Public Convex API tests cover photo ownership, fresh reads, frozen diary values,
  OFF conversion and account-specific test-data photo removal.
- Repository tests cover nonpersistent snapshots, retained optional defaults,
  legacy pending-write protection and server ACK surviving optional disk failure.

## Rollout status

Regular development backend `colorless-sturgeon-704` deployed successfully.
The old isolated deployment `earnest-cobra-841` is no longer accessible.
Native photo flow, production photo adoption and preview distribution are pending
verification at this checkpoint. Physical phone SQLite counts are not inferred
from simulator or unit-test results.

## Open

- [ ] Native photo save and cold-start retrieval.
- [ ] Production OFF image adoption and preview TestFlight availability.
- [ ] Physical phone installation and SQLite cleanup verification.
