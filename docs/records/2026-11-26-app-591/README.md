---
type: record
kind: verification
description: Read for the regenerated App Store screenshot 06 (nutrition week) after the week menu fix (APP-591, APP-576).
version: 1.0.0
date: 2026-11-26
---

# App Store screenshot 06 rerun — APP-591

Shot 06 ("This week") showed the header ⋯ dots above an empty circle. The fix
landed in workouts#307 (APP-576); this rerun shows the dots centred in the glass
button.

Taken on 26 Nov 2026 from `main` at `5f34e1e6` with
`node scripts/store-screenshots.mjs --issue APP-591 --name foundry` (iPhone 17 Pro
Max and iPad Pro 13-inch (M5) simulators, iOS 27.2), a local development-client
build, and a local Convex deployment seeded by `scripts/store-screenshots-seed.mjs`
for the shared test user. The full six-shot set from this run replaced
`~/Developer/.screenshots/APP-433/foundry/`; the previous set is kept beside it as
`foundry-2026-11-22/` (both local to Eric's Mac, not in the repo). Nothing was uploaded to App Store Connect.

| Shot | en-US | nl-NL |
| --- | --- | --- |
| iPhone 6.9" | [png](06-week-iphone-6.9-en-US.png) | [png](06-week-iphone-6.9-nl-NL.png) |
| iPad 13" | [png](06-week-ipad-13-en-US.png) | [png](06-week-ipad-13-nl-NL.png) |

Checks:

- Before (22 Nov set): [png](before-06-week-iphone-6.9-en-US.png), dots above an empty circle.
- Dark appearance (iPhone only), iPhone 17 Pro, same build: [png](week-header-dark-iphone.png), dots centred.

The shoot day is a Thursday, so the week shows three full days and today.
