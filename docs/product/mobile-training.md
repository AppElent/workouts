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
- **Implementation seam.** Extend the existing InsetRow platform interface for
  the visible play/menu controls; it does not currently expose trailing action
  slots. Preserve native swipe/context behavior and independent accessible hit
  targets. The final study documents the remaining connection/retry integration
  and verification requirements.

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
