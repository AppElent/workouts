---
type: contract
description: Read when changing Training, Start activity, Strength Sessions, the set editor, Set Drafts, or strength references.
version: 2.3.0
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
  library rows follow (Exercises, WODs, History). Hosted Workouts are parked and
  have no row ([ADR 0018](../adr/0018-park-hosted-workouts.md)). One header menu
  holds the history shortcuts (all, strength, running, cycling); no header +.
- Tap a routine name to edit; a separate play button starts it. Row menu and long
  press expose Start, Edit, Delete. Swipe reveals Edit/Delete and never commits.
- A Routine requires a non-empty name (stored trimmed, up to 200 characters) and
  at least one Exercise. Each Exercise may appear at most once (by resolved
  exercise id), up to 50 Exercises and 500 total Planned Sets, keeping session
  start well under Convex document limits.
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
- The session follows the round-2 canvas
  ([companion](../../designs/app/session_redesign_final.md)): done exercises
  collapse, the current one shows its sets, upcoming ones wait below, and a Now
  card names the next set and logs it in one tap (rest counts down there). Each
  row logs by its check; tap opens the editor; swipe and long press offer the
  same set actions. An empty session starts from quick-start tiles; an ad hoc
  exercise offers steppers and last time's set.
- Set counts and the progress strip count working sets. Planned sets are working
  sets: a logged warm-up never uses one up when the plan is rebuilt.
- A set logged elsewhere (MCP or another device) fills the exercise's first open
  set, alone or in a group; with none left it is added. It never fills a set that
  holds changes made here, a failed log, or a log still being sent, and a warm-up
  and a working set never fill each other.
- A session finished elsewhere says it ended, even when the device's plan is
  already gone.
- Keep set edit/delete, repeat (prepares a draft), set types, previous performance,
  equipment increments, plates, rest timer, elapsed time, resume, and hosted score
  routes (hidden while Hosted Workouts are parked). Clearing a saved RPE leaves
  other fields unchanged.
- **Default rest** is per session and set from session options; a new session
  starts from the account's last choice on this device. A running rest timer
  belongs to the session it began in: another session, including a new one, never
  shows it, and it is cleared when the session ends anywhere. It survives an app
  restart in its own session.
- **Set groups** repeat generically. Rounds rest between rounds; AMRAP runs a clock
  and scores rounds plus sets, with no rest. Group classes are out of scope.
- Finish confirms leaving unfinished targets or drafts and counts only logged Sets;
  with none, it offers to delete the session. Then a recap shows what was done: the
  session saves at Gereed, "Terug naar sessie" reopens it, and closing the app there
  keeps it open behind the resume bar. Work volume excludes warm-ups. Cancel keeps
  logged Sets but is not a completed Activity. Both clear drafts and wait for pending
  set writes.
- Legacy history stays as recorded; never present prefilled targets as measured.

### Train now

- The phone's exercise page offers **Train now** under its header (not in the
  session's exercise sheet), and the exercise library's row menu offers the
  same action (APP-871). Mobile only, like the Krachtprofiel outside a session
  ([ADR 0017](../adr/0017-mobile-leads-web-shares.md)).
- With no active session it starts a Strength Session for that exercise in one
  write (`workoutSessions.create` with `exerciseId`): named after the exercise,
  its references snapshotted, and last time's working Sets of the exercise
  (every set but warm-ups, from the latest session that logged one, in set
  order) as its Planned Sets. Without
  history it starts as an ad hoc exercise. It then opens the session, so the
  session, set editor, percentages, Krachtprofiel and recap are the ones above.
- With a session active it offers to add the exercise there and opens it; an
  exercise already in that session opens it without asking. Cancel writes
  nothing. Offline it still opens an active session that holds the exercise;
  adding or starting refuses, as does an unresolved active session.

### Connected-app setup

An agent can prepare a training through the [MCP](../runbooks/mcp.md) so the
person only confirms numbers, or log one afterwards. It uses the same records as
the app; there is no separate data.

- **Personal Exercises:** `create_exercise` reuses the in-app create path and
  returns the caller's existing Personal Exercise with the same name (ignoring
  case) instead of a duplicate. It takes the measure, reps unless given.
- **Routines:** `create_routine` uses the in-app create path, with its set, rep,
  and load limits and exercise ownership checks. Like the editors, it requires a
  name and at least one exercise and takes each exercise once. A retry with the
  same key and input returns the first result, even after the Routine was edited
  or deleted in the app, and never makes a second one.
- **Planned Sets:** `add_exercise_to_session` with `plannedSets` replaces that
  exercise's Planned Sets in an active session. A target is a load or a
  percentage of the session's 1RM (Measured unless a newer Manual), rounded to
  the exercise's step (5 lb in pounds). When the session has no 1RM for the
  exercise and nothing is logged for it, its references are snapshotted again
  first, so a 1RM saved after the exercise was added counts. No 1RM refuses the
  percentage. Both apps show
  the targets as they show a Routine's; an app that already shows the exercise
  keeps its own plan.
- **Logged afterwards:** a session's start (`date` and `startTime`), each Set's
  `loggedAt`, and the finish time can be given. Activities, history, volume,
  and references then see the given times. Times more than five minutes in the
  future, and Set or finish times more than five minutes before the session's
  start, are refused; the five minutes absorb clock skew between devices. A
  past start that matches a session already logged (active or finished, not
  cancelled) returns that session, so a retry never makes a second one. The
  MCP asks for Set and finish times once a session started over six hours ago,
  and refuses a past start while another session is active.
- **Repeated plans:** planning an exercise again replaces its targets.
  Percentages resolve against the session's 1RM, the one its percentage chips
  use, so repeating the same plan gives the same loads even after a newer 1RM
  is saved.

### Set editor

- A focused sheet with weight and reps value cards, four set-type segments, and
  last time's matching set (same type and position, with RPE and date) as its
  subtitle. Without advanced details it shows last time's sets, never an empty
  middle. Advanced adds percentage chips and optional RPE showing reps remaining
  (half values reachable), and the set's note. The 1RM source (measured, manual, estimated) is named
  wherever it is used. Simple or advanced is a choice in the editor menu,
  remembered on the device; advanced only shows more and offers no other way to
  log. Simple shows the note field only when the set has a note.
- **Note:** a logged Set can hold one note (`sets.notes`), stored trimmed, at most
  500 characters; an empty note is removed. A correction that leaves the note out
  keeps it, so an older app never wipes one, and an empty string clears it. The
  session's set rows, the phone's exercise history, and the session summary show
  it under the set (two lines at most), and the web and the MCP return it. The JSON
  export carries it and the sets CSV has a `notes` column. New, repeated, and
  swapped-in sets start without one; swapping back restores the original's.
- **Spoken set:** each set row in the phone's exercise history and the session
  summary is one accessible element with one spoken label: set number, load and
  reps in words ("20 kilograms, 5 reps"), set type or, for a working set, its
  RPE ("RPE 8"), estimated 1RM, then the note, each only when the row has it.
  A session set row speaks its RPE when it shows it. Every spoken phrase, the
  RPE included, comes from the en/nl message catalog.
  Placeholders such as "—" are never read.
  The session summary's visible chip and its "Best" line name the set's unit
  (`80 kg × 8`, `135 lbs × 5`); a bodyweight set shows none.
  "Best" is the heaviest set, compared in kg and shown in its own unit; total
  volume is in kg.
- Percentage chips use the session's 1RM: Measured unless a newer manual 1RM is
  saved. Choosing one changes the weight; the sheet shows the 1RM this set would
  produce. Missing references are unknown and do not block logging. Never replace
  entered reps or RPE with predictions.
- Krachtprofiel is a destination in the same presentation sharing the draft:
  references and sources, percentages (custom too), rep-max tables, and a
  weight-plus-reps estimate. Selecting a result stages it; Apply copies weight and
  reps; Back keeps the original draft. Browsing never changes saved references.
- In a session it opens from the set editor menu, the exercise menu, and a direct
  Krachtprofiel action on the current exercise card, beside Add set (hidden for
  bodyweight exercises).

### Holds

- A Personal Exercise is measured in reps or seconds, chosen when it is created
  (phone and web) and changeable when it is edited (phone). Quick create inside a session makes a
  reps exercise. Absent means reps, so
  every earlier exercise keeps counting reps; an edit that leaves the measure out
  keeps it, so an older app never clears one. Shipped holds are fixed by id.
- A hold reads and logs seconds everywhere, stepped in fives from 30. Its load is
  optional added weight on any equipment, and its Sets never feed One-rep Max
  references, rep maxes, percentages, or work volume.
- Sets carry no measure of their own: switching an exercise re-reads the Sets
  already logged, which the phone's form says, and drops or restores their
  set-derived references. Manual 1RMs and the logged numbers stay.

### Krachtprofiel outside a session

- The exercise page shows a Krachtprofiel row under the 1RM card for loaded
  exercises; bodyweight and timed exercises have none. It opens the profile with
  no active session (`/strength-profile`), read-only: the account's current
  references and their dates, percentages (custom too) and rep-max tables from
  the same 1RM a new session would use. Nothing is selectable and there is no
  Apply or Enter 1RM.
- Mobile only. The web has no Krachtprofiel; the feature is mobile-exclusive in
  `packages/core/src/features.ts`
  ([ADR 0017](../adr/0017-mobile-leads-web-shares.md)).

### Set Drafts

- The session plan and each set's draft live on the device per account and session.
  They survive dismissal, restart, and sign-out while the session is active. Logging,
  discard, or session end clears a draft. Another account never sees them, and they
  do not sync between devices. A draft carries the note like reps and weight, and a
  note typed here counts as a change made here; a draft whose note was not touched
  never overwrites the stored one. Drafts from builds before account scoping are not
  carried over.
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
