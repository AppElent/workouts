# Training and start activity interactions

Approved product behavior extracted from the mobile design studies. These choices
remain local because they define Workouts tasks, actions, and domain consequences.
They do not establish implementation completion. Consult [verification evidence](../verification/README.md)
and the current component API before implementing a study.
Reusable interactions come from the shared [patterns](../guidelines/shared/patterns/README.md);
[mobile design](../../apps/mobile/DESIGN_SYSTEM.md) owns brand and component bindings.

Settled in the [Training study](../../designs/app/training_final.html).
These are approved design decisions; implementation and device acceptance are
tracked separately.

- **Training hierarchy.** Use a compact routine list above the library rows
  (Exercises, WODs, Hosted workouts, History). Keep the labeled Start activity
  action above routines and New beside the routine section. The header has one
  menu; do not duplicate New with a header +. Preserve the existing history
  shortcuts for all activities, strength, running, and cycling in that menu.
- **Routine actions.** Tap the name to edit; a separate play button starts the
  routine. A visible row menu and long press expose Start, Edit, and Delete.
  Swipe reveals Edit and Delete and never commits. All routes share callbacks
  and pending/connection guards. Confirm deletion and explain that previous
  sessions are retained; a failed deletion keeps the routine visible.
- **Active training.** Keep the existing ActiveSessionBar in the shell accessory
  or its fallback. Starting another strength session first offers to resume the
  active one. Keep recording a run or ride reachable. An unresolved active
  query is not evidence of no session; preserve the server race fallback.
- **Training states.** Keep navigation available while routines load or fail.
  Distinguish no routines from unavailable data. Retain loaded rows during
  refresh or a lost connection; offline cold start has no assumed cached list.
  Guard new mutations while offline, show pending on the initiating action,
  and preserve data after errors. Use the existing confirmation and toast seams.
- **Implementation seam.** Reuse InsetRow's existing `trailing` slot for play
  and menu controls. Preserve native swipe/context behavior and verify independent
  accessible hit targets on both platforms. The study's older claim that slots
  must be added is superseded by the component.

Settled in the [Start activity study](../../designs/app/start-activity_final.html).
These decisions describe the approved design, not completed implementation.

- **Start activity sheet.** Present one sheet with a compact fixed title, close
  on the left, and a labeled Start action on the right. Default to an empty
  strength session. A routine row selects only; Start creates the session.
  Keep routine preview and editing out of this picker.
- **Activity routes.** Keep strength, running, cycling, and WOD reachable.
  Running/cycling record completed activities; WOD opens the library. Their
  action is Continue (Verder), not Start. Follow-up pages stay in the sheet's
  navigation stack; Back restores the picker and its selection, name, and
  scroll position. Reuse the existing destination screens and their own
  unsaved-change protection.
- **Session name.** Show the optional name only for an empty strength session.
  Starting a routine uses its existing name without changing the routine.
  Switching selection or sport preserves the free-session name in the sheet.
  Keep the field visible above the keyboard; its return key invokes the same
  guarded start handler as the toolbar.
- **Picker dismissal.** Close and swipe dismissal confirm only when a typed
  name would be lost. Keep editing preserves it; explicit discard clears it
  and closes without creating a session. A routine selection alone needs no
  confirmation. Starting disables edits, duplicate submission, and dismissal.
- **Start recovery.** Preserve input after failure and retry through Start.
  Known active sessions offer Resume; preserve the server-conflict fallback
  for races. Routine loading and empty states remain distinct. Guard new
  session mutations offline, without assuming persisted routine data, and
  keep the other activity destinations reachable.
- **Implementation seam.** Extend FormChoiceRow with radio semantics,
  secondary text, and disabled behavior while preserving existing checkbox
  callers. Sheet nesting, keyboard behavior, focus, and native dismissal still
  require implementation and device verification; the final study records
  the actual component owners and installed versions.

Settled in the [strength set editor study](../../designs/app/session_final.html),
following approval of round 5. This selects the editor and strength data sheet;
it is not native implementation acceptance or approval of the entire workout flow.

The [app redesign contract](app-redesign.md) records the agreed
delivery scope, planned/performed boundary, sourced references, session snapshots,
bodyweight limitation and durable Set Draft behavior. Full block flows are deferred.

- **Set editor.** A focused bottom sheet holds weight, reps, set type and optional
  RPE. RPE choices show reps remaining; half values remain reachable. Avoid an
  advanced mode or source selector in this basic editor.
- **Two references at once.** Under the inputs, show measured and estimated 1RM,
  the entered weight as a percentage of each, and total theoretical reps at RPE
  10 for each. Both rep counts are estimates. Do not replace entered reps or
  reported RPE with predictions. Missing references stay unknown and do not
  prevent logging.
- **Separate strength data sheet.** Krachtprofiel contains both reference values
  and sources, percentages including custom input, rep-max tables and the 1RM
  estimate from weight plus reps. Use the same draft owner across destinations.
- **Choose, apply, log.** Selecting a percentage/table result stages a candidate.
  Apply copies weight/reps into the draft; Back keeps the original draft and RPE.
  Only an explicit log/save action mutates sets. Browsing and draft calculations
  never overwrite profile references. Preserve a new-set draft on close/reopen;
  retain existing saved-set discard protection and duplicate/delete actions.
- **Calculation ownership.** Extend `calculateOneRepMax`'s owner in
  `@workouts/core` for percentage/inverse calculations. Calculate displayed
  percentages from the entered weight after equipment-specific rounding. Label
  high-rep results as approximate, use the single-rep boundary, and do not apply
  an unstated RPE correction to the weight-plus-reps estimate.
- **Implementation.** The editor and strength-data sheet now live under
  `apps/mobile/src/features/strength-session/`, sharing the Set Draft owner.
  The [app contract](app-redesign.md) owns sourced-reference behavior; the
  [implementation report](../verification/app-redesign/README.md) records
  verified transitions and remaining device acceptance.
