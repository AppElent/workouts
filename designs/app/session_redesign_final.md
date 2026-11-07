# Strength session redesign

Approved in Claude canvas v45 and rendered in
[session_redesign_final.html](session_redesign_final.html). It extends
[session_final.html](session_final.html) (set editor + krachtprofiel) and replaces
it where they differ: the editor is now a sheet over a set table, percentages come
from Measured, and set details moved under Meer.

## Decisions

- **1RM runs both ways.** Choose a percentage of 1RM to get a weight; every set
  shows the 1RM it would produce. Percentages use Measured unless the person saves
  a newer manual 1RM.
- **Warm-ups never count toward 1RM** on the client: not in the row, toast, recap
  or work volume. The server still counts them (see Limits).
- **A set is logged by its check.** Swipe and long press offer the same actions.
  Tap opens the editor. Open sets can be added from an empty start.
- **Set groups repeat.** Rounds carry rest; AMRAP carries a clock and a score, and
  no rest. Group classes stay out of scope.
- **Hosted** keeps its behaviour and score routes, in the session body.
- **Session saves at Gereed.** "Terug naar sessie" reopens it; closing the app on
  the recap keeps it open behind the resume bar.

## Bindings

| Concern | Binding |
| --- | --- |
| Plan, groups, calculations | `session-plan.ts`, pure and tested |
| Device workspace | `data/session-workspace.ts`, kv key `strength-session-plan:v1:<subject>:<sessionId>` |
| Server writes | `data/session-actions.ts`: `sets.add/update/remove`, `workoutSessions.addExercise/finish/cancel`, `oneRepMaxes.addManual`, `exercises.create` |
| Rest and clock alerts | `components/rest-timer.tsx`, `data/session-notifications.ts` |
| Chrome | `Stack.Toolbar` and native materials; the study's CSS glass is not shipped |

No Convex change: the plan, groups, rest default and drafts live on the device and
reconcile with logged Sets from the server.

## Slices built

1. Plan model and workspace, seeded from the session and restored after a restart.
2. Table, row check, undo, rest, toast.
3. Editor, Meer, Krachtprofiel, manual 1RM, typo checks.
4. Picker, empty start, new exercise.
5. Swipe, long press, session and exercise menus, swap, move, remove.
6. Set groups: rounds and AMRAP.
7. Offline, retry, receipts, finish, recap, resume bar.
8. Dynamic Type, Reduce Motion, VoiceOver labels.

## Deviations

- At the largest text sizes the editor keeps weight and reps side by side instead
  of stacking: both fit, and stacking pushes Log off the screen. Percent chips do
  go to two columns.
- The resume bar stays on Train and the Home card, the existing placement.

## Limits

- Warm-up singles still count server-side, because no Convex deployment comes with
  this work. Fix with a backend change to eligibility.
- A saved manual 1RM applies only when newer than the measured one, while the
  picker lists current references with manual first, so they can disagree on old
  data.
- The plan is per device. Logged Sets sync; open sets and groups do not.
- Recap rows do not link to exercise progress.
