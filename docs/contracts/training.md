---
type: contract
description: Read when changing Training, Start activity, Strength Sessions, the set editor, Set Drafts, or strength references.
version: 1.0.0
status: current
---

# Training

A person starts an Activity, logs Sets against plans, and sees honest strength
references. Studies: [training](../../designs/app/training_final.html),
[start activity](../../designs/app/start-activity_final.html),
[session overview A](../../designs/app/session_round1.html),
[set editor and Krachtprofiel](../../designs/app/session_final.html).

## Behavior

### Training screen

- Start activity sits above compact routines; New sits beside the routine section;
  library rows follow (Exercises, WODs, Hosted Workouts, History). One header menu
  holds the history shortcuts (all, strength, running, cycling); no header +.
- Tap a routine name to edit; a separate play button starts it. Row menu and long
  press expose Start, Edit, Delete. Swipe reveals Edit/Delete and never commits.
- Deletion confirms and explains that past sessions remain; a failed deletion keeps
  the row.
- The ActiveSessionBar stays in the shell accessory and shows only while the
  Train tab is selected. Starting another Strength
  Session offers to resume the active one. An unresolved active-session query is
  not evidence of none; keep the server race fallback.

### Start activity

- One sheet: compact title, close on the left, Start on the right. Defaults to an
  empty Strength Session. Selecting a routine only selects; Start creates.
- The optional name appears only for an empty session and survives selection and
  sport changes; a routine keeps its own name. The return key uses the same
  guarded start handler.
- Running, cycling, and WOD use Continue (Verder) and push within the sheet; Back
  restores selection, name, and scroll. Destinations keep their own unsaved-change
  protection.
- Close and swipe confirm only when a typed name would be lost. Starting disables
  edits, duplicate submission, and dismissal; failure keeps input for retry.

### Strength Session

- Starting a Routine creates Planned Sets and zero performed Sets. Only explicit
  logging records performance; plans and drafts never count toward totals or
  references ([ADR 0012](../adr/0012-separate-planned-sets-from-performance.md)).
  Exercise membership and order persist without logged Sets.
- The session is a table: per set the percentage of 1RM, weight × reps, the 1RM it
  would produce, and a check that logs it. Tap opens the editor; swipe and long
  press offer the same set actions. Sets can be added from an empty start.
- Keep set edit/delete, repeat (prepares a draft), set types, previous performance,
  equipment increments, plates, rest timer, elapsed time, resume, and hosted score
  routes. Clearing a saved RPE leaves other fields unchanged.
- **Default rest** is per session and set from session options.
- **Set groups** repeat generically. Rounds rest between rounds; AMRAP runs a clock
  and scores rounds plus sets, with no rest. Group classes are out of scope.
- Finish confirms leaving unfinished targets or drafts and counts only logged Sets;
  with none, it offers to delete the session. Then a recap shows what was done: the
  session saves at Gereed, "Terug naar sessie" reopens it, and closing the app there
  keeps it open behind the resume bar. Work volume excludes warm-ups. Cancel keeps
  logged Sets but is not a completed Activity. Both clear drafts and wait for pending
  set writes.
- Legacy history stays as recorded; never present prefilled targets as measured.

### Set editor

- A focused sheet with weight and reps, percentage chips, and set details (set type,
  optional RPE showing reps remaining, half values reachable) under Meer. There is no
  advanced mode: Meer only folds details, and it offers no other way to log.
- Percentage chips use the session's 1RM: Measured unless a newer manual 1RM is
  saved. Choosing one changes the weight; the sheet shows the 1RM this set would
  produce. Missing references are unknown and do not block logging. Never replace
  entered reps or RPE with predictions.
- Krachtprofiel is a destination in the same presentation sharing the draft:
  references and sources, percentages (custom too), rep-max tables, and a
  weight-plus-reps estimate. Selecting a result stages it; Apply copies weight and
  reps; Back keeps the original draft. Browsing never changes saved references.

### Set Drafts

- The session plan and each set's draft live on the device per account and session.
  They survive dismissal, restart, and sign-out while the session is active. Logging,
  discard, or session end clears a draft. Another account never sees them, and they
  do not sync between devices.
- Recording a Set needs a connection. Offline, the set is marked failed without being
  sent, rest still runs, and finishing is blocked until it is retried or removed. A
  stable operation identity prevents a duplicate after a lost acknowledgement; input
  stays after failure.

### Strength references

Logged Sets are authoritative ([ADR 0013](../adr/0013-sourced-strength-references-and-session-snapshots.md)).
Per account and exercise, store current references with source Set, date, value,
unit, and formula:

- **Measured:** heaviest eligible logged single.
- **Estimated:** highest Epley estimate from eligible multi-rep Sets; no unstated
  RPE correction; high-rep results labelled approximate.
- **Eligible:** explicitly logged positive load with ≥ 1 rep, any set type, in
  active, completed, or cancelled sessions. Excludes plans, drafts, zero-rep
  attempts, and unverified legacy sources. Units normalized.
- **Manual 1RM:** kept separate, labelled, selectable, never overwritten or shown
  as measured. Saved at finish or cancel with logged Sets, and used in place of
  Measured only when newer.
- **Warm-ups** are excluded from 1RM on the client: row, toast, recap, and work
  volume. Server references still count warm-up singles until eligibility changes.

Each session snapshots resolved references with provenance; later source changes
affect only later sessions. Percentages use the entered weight after equipment
rounding. Bodyweight exercises log added load (`+kg`, zero allowed); their
references, percentages, and predictions stay unavailable until a load convention
exists. Percentage and inverse calculations live beside `calculateOneRepMax` in
`@foundry/core`.

## States

Navigation stays available while routines load or fail. Distinguish no routines
from unavailable data; keep loaded rows during refresh or disconnection; offline
cold start assumes no cached list. New mutations need a connection and show
pending on the initiating action.

## Out of scope

EMOM flows and group classes; bodyweight load conventions; durable offline training;
routine search, duplication, or bulk selection.

## Acceptance

Web keeps working against the shared routine/session API. Design:
[session redesign](../../designs/app/session_redesign_final.md). Evidence:
[app redesign](../records/2026-10-07-app-redesign/README.md),
[exercise library](../records/2026-09-28-exercise-library/README.md).
Original spec: issue #94.
