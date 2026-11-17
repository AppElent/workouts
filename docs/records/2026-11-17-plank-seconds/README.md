---
type: record
kind: verification
description: Read for runtime screenshots of Plank logged in seconds (APP-218, PR 230).
version: 1.0.0
date: 2026-11-17
---

# Plank logs seconds — APP-218

Runtime screenshots for PR 230, taken at commit `95a42ec9` on the shared dev
deployment `colorless-sturgeon-704` with the documented test account, in English.

The test account already had an active seeded session ("Test: Strength B", started
16 Nov), so Plank was added to it rather than to a new empty session. That is why the
session clock reads ~23 h. Plank was removed again afterwards; the seeded session is
unchanged.

## Web (Vite dev, Chromium)

Widths 1280 px and 390 px, light and dark (`prefers-color-scheme`). Captured at 2x.

| Screen | 1280 light | 1280 dark | 390 light | 390 dark |
| --- | --- | --- | --- | --- |
| Session after logging 45 s | [png](web-session-1280-light.png) | [png](web-session-1280-dark.png) | [png](web-session-390-light.png) | [png](web-session-390-dark.png) |
| Set edit sheet (Seconds, 45) | [png](web-edit-sheet-1280-light.png) | [png](web-edit-sheet-1280-dark.png) | [png](web-edit-sheet-390-light.png) | [png](web-edit-sheet-390-dark.png) |
| Plank exercise page, History tab | [png](web-exercise-history-1280-light.png) | [png](web-exercise-history-1280-dark.png) | [png](web-exercise-history-390-light.png) | [png](web-exercise-history-390-dark.png) |
| Plank exercise page, Overview tab | [png](web-exercise-overview-1280-light.png) | [png](web-exercise-overview-1280-dark.png) | [png](web-exercise-overview-390-light.png) | [png](web-exercise-overview-390-dark.png) |

## iOS (development client, iOS 27 simulator)

| Screen | iPhone 17 light | iPhone 17 dark | iPhone SE (3rd gen) dark |
| --- | --- | --- | --- |
| Set editor on add (Seconds, default 30, ±5) | [png](ios-set-editor-default-iphone17-light.png) | — | [png](ios-set-editor-default-iphonese-dark.png) |
| Set editor at 45 s | [png](ios-set-editor-45-iphone17-light.png) | [png](ios-set-editor-45-iphone17-dark.png) | [png](ios-set-editor-45-iphonese-dark.png) |
| Session row ("45 s") | [png](ios-session-iphone17-light.png) | [png](ios-session-iphone17-dark.png) | [png](ios-session-iphonese-dark.png) |
| Finish recap ("1 set · 45 s") | [png](ios-recap-iphone17-light.png) | [png](ios-recap-iphone17-dark.png) | [png](ios-recap-iphonese-dark.png) |

The iPhone 17 dark editor shows the logged set reopened for editing; the add-flow
default in dark is covered by the iPhone SE run.

## Observations

- No Plank surface shows "reps"; headers read "Seconds", "SEC" or "+kg × sec".
- Web history shows the weight as `0 kg` while the session row shows `BW`.
- Web exercise Overview still says "Log sets for this exercise to see your 1RM." for a hold.
- The web edit sheet steps seconds by ±5/±10; the iOS editor by ±5.
