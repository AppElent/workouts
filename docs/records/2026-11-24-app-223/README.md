---
type: record
kind: verification
description: Read for web screenshots of timed-hold polish (APP-223, PR 336).
version: 1.0.0
date: 2026-11-24
---

# Timed-hold polish — APP-223

Web screenshots for PR 336, taken in English on a Vite dev server against this
worktree's isolated Convex deployment, signed in as a throwaway Clerk test user.
Two Plank sets (30 s and 35 s, logged from the 30 s default and one ±5 step) were
logged through the normal UI.

| Screen | 1280 light | 1280 dark | 390 light | 390 dark |
| --- | --- | --- | --- | --- |
| Plank exercise page, History tab ("BW", not "0 kg") | [png](web-history-1280-light.png) | [png](web-history-1280-dark.png) | [png](web-history-390-light.png) | [png](web-history-390-dark.png) |
| Routine editor, Plank at 35 s (30 s default, one step of 5) | [png](web-routine-editor-35s-1280-light.png) | [png](web-routine-editor-35s-1280-dark.png) | [png](web-routine-editor-35s-390-light.png) | [png](web-routine-editor-35s-390-dark.png) |

The routine editor at its 30 s default: [390 light](web-routine-editor-30s-390-light.png).

The mobile long-hold confirm (over 600 s) is covered by the `typoCheck` unit test
only; it was not run on a simulator. The "before" screenshots are in
[2026-11-17-plank-seconds](../2026-11-17-plank-seconds/README.md).
