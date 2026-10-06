# Log food screen redesign

## Current status

Implemented on the live `nutrition-food` route on `t3code/entry-editor-redesign`
(code in `apps/mobile/src/features/nutrition/log-food/`).
Reference: [log food · definitief](../../../designs/nutrition/log_final.html).
Automated checks pass (mobile Jest 512/512, typecheck, Biome, architecture check).
iOS visual comparison done on 2026-10-06 on simulator `sim-pool-ios-e8e0175cad`
(iOS 27, light and dark, English locale), against the test account on the
development backend, from a Metro started with `--clear`.

The first device pass reported "done" without a per-state comparison and was
looking at a stale bundle (see [Lessons](#lessons)); the comparison below
replaces it.

## State comparison

| Design state (phone) | Result | Evidence |
| --- | --- | --- |
| 1 · In rust | Pass | [rest](assets/ios-rest.png), [dark](assets/ios-rest-dark.png) |
| 1 · Typen / met zoekterm | Pass | [results](assets/ios-results.png) |
| 2 · Titelmenu open | Agreed deviation: the native menu shows each meal's tally as a subtitle, not right-aligned | [title menu](assets/ios-title-menu.png) |
| 3 · Na + (✓ on row, toast, bar) | Pass; Undo verified on device | [toast](assets/ios-quick-add-toast.png) |
| 3 · Maaltijdregel open | Pass (native inset rows, no emoji tile); delete verified with confirm | [summary](assets/ios-meal-summary-open.png) |
| 4 · Lang ingedrukt | Pass (system context menu with lifted row) | [long press](assets/ios-long-press.png) |
| 4 · Geveegd | Not compared on device (swipe gesture not exercised) | — |
| 5 · + menu, geen resultaten | Pass (no-results card); + menu not re-shot | [no results](assets/ios-no-results.png) |
| 6 · Open Food Facts geladen / niets lokaal | Pass | [OFF](assets/ios-open-food-facts.png) |
| 6 · Laden, even wachten | Not exercised on device (covered by Jest) | — |
| 7 · Barcode opzoeken | Pass for chrome; simulator has no camera feed | [scanner](assets/ios-scanner.png) |
| 7 · Barcode niet gevonden, offline | Not exercised on device (covered by Jest) | — |

Untested: Android, VoiceOver walkthrough (toolbar buttons now expose their
labels), Dynamic Type, physical-device haptics and camera.

## Lessons

- **Compare per state before reporting.** List the design's states first, then
  record a device screenshot and pass/deviation per state. "Matches the design"
  without that table is not a verification.
- **Prove the bundle is current.** Without Watchman, Metro in this worktree did
  not pick up file changes, so Fast Refresh and even cold launches showed old
  code. Start Metro with `--clear` for a verification pass and confirm a fresh
  `Bundled … (N modules)` with N in the thousands, not `(1 module)`.
- **Use a simulator nobody else drives.** Shared booted simulators were held by
  other sessions; a pool simulator with the dev client copied in was reliable.
- **Dev-only overlays hide controls.** The dev-tools bubble covers the toast's
  Undo; drag it away before tapping.
