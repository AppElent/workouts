# App redesign implementation contract

Status: agreed on 7 October 2026 after the implementation interview. All product
questions in this iteration are resolved or explicitly deferred. The implementation
and automated verification are complete; native coverage and remaining acceptance
are recorded in the [implementation report](../verification/app-redesign/README.md).

Published implementation spec: [issue #94](https://github.com/AppElent/workouts/issues/94),
labeled `ready-for-agent`. It expands this contract into user stories,
implementation decisions and verification scope.

## Scope and references

Implement Profile/settings, Training, Start activity, and the basic Strength
Session overview with the selected set editor and Strength Profile. Target iOS
first, preserve Android functionality through shared adapters, and keep the
existing five-tab shell. Shared backend changes require compatible web behavior;
a web visual redesign is outside this iteration.

| Area | Selected reference | Delivery boundary |
| --- | --- | --- |
| Profile/settings | [Profile final](../../designs/app/profile_final.html) | Selected layout, real identity/existing settings, clearly marked placeholders for new capabilities |
| Training | [Training final](../../designs/app/training_final.html) | Compact routines, independent row actions, existing destinations and active-session recovery |
| Start activity | [Start activity final](../../designs/app/start-activity_final.html) | Select-then-start sheet, retained draft, nested destinations and recovery |
| Strength Session | Overview A in [round one](../../designs/app/session_round1.html); [final editor and Strength Profile](../../designs/app/session_final.html) | Basic overview and final editor/profile; full Superset, AMRAP, EMOM and repeated-round flows deferred |

The final Session study supersedes earlier editor/profile alternatives: both
measured and estimated references remain visible, with a separate Strength Profile
destination and no advanced toggle or source selector in the basic editor.
HTML sketches and demo constants are illustrative. Apply the selected behavior
through current production owners and native controls.

Deferred work:

- [Enhancement #93](https://github.com/AppElent/workouts/issues/93): working
  Profile account editing, export, deletion, lifetime totals and distance
  breakdown. Their counting rules, complete export/deletion contracts and
  persistent summary caches belong to that follow-up.
- Full offline personal training and synchronization. The revised
  [issue #89](https://github.com/AppElent/workouts/issues/89) now specifies
  account-owned data and online-first saves and also defers full offline training.
  Coordinate shared ownership and save semantics with that current contract.
  This redesign preserves unfinished Set Drafts on the device but requires
  connectivity to record sets; it does not promise restart-safe unsent edits
  throughout the app.
- Full session block flows and bodyweight load conventions. Do not introduce
  either as an implicit consequence of the visual redesign.

## Profile and settings

Use the real account identity and keep existing functional settings/actions.
Appearance, language, nutrition destinations, Feedback, Labs and sign-out remain
reachable when the extra Settings level is removed. Group Preferences and
Nutrition directly on Profile using the selected settings-row treatment.

The user explicitly authorized placeholders as an exception to the final study's
no-placeholder rule. Show dashes for unavailable totals and clearly mark deferred
actions as coming soon. Do not display invented personal statistics or simulate
successful export/deletion. Working existing destinations stay functional.

Sign-out always asks for confirmation. Explain actual pending/local state rather
than copying the study's incorrect claim that all pending edits are lost.
Retain unfinished Set Drafts on the device, isolated to their account. Returning
to the same account restores a draft if its session is still active; another
account must never see or submit it. Clearly distinguish device-local unfinished
input from synchronized account data.

## Training and Start activity

Training keeps Start activity above compact routines, New beside the routine
section, and a single header menu preserving existing history shortcuts. Keep
Exercises, WODs, Hosted Workouts and History reachable. Tap a routine name to edit;
its independent play action starts it directly. Visible menu and long press expose
the same actions. Swipe reveals Edit/Delete and never commits on full swipe.
Confirm routine deletion, retain historical sessions, and keep the row after a
failed deletion. No routine search, duplication or bulk-selection feature is added.

The Start activity sheet defaults to an empty Strength Session. Selecting a
Routine does not start it; Start does. Show the optional name only for an empty
session, retain it across selection/sport changes, and use a Routine's name when
starting from it. The keyboard submit action uses the same guarded handler.

Running/cycling record completed activities, and WOD opens its existing library.
These choices use Continue and remain in the sheet's navigation flow. Back
restores selection, name and scroll position. Destination screens retain their
own editing and unsaved-change behavior.

Closing the picker confirms only when typed name input would be lost. Selection
alone requires no discard prompt. Preserve input after a failed start; pending
submission blocks editing, duplicate starts and dismissal. Successful start or
resume dismisses the picker and opens the session.

Keep the active-session accessory and offer Resume when another Strength Session
already exists. Unknown query state is not proof that no session exists; preserve
server-side race protection. Recording a run/ride remains reachable. Distinguish
empty routines from loading/error/unavailable data, retain loaded rows during
refresh or disconnection, and keep navigation available. New mutations require
connectivity; no persistent routine cache is promised here.

## Planned work, logged performance and history

Follow [ADR 0012](../adr/0012-separate-planned-sets-from-performance.md): starting a
Routine creates Planned Sets and zero performed sets. Only explicit logging
records performance. Plans and drafts never count toward performed totals or
performance-derived references. Persist exercise membership/order independently
of logged sets so an exercise with only planned work survives recovery.

Keep existing history as recorded and apply the new distinction to new sessions.
Legacy timestamps cannot reliably distinguish performed sets from prefilled
targets; do not guess or present unverified historical values as measured.
Preserve existing manual values, hosted-session entry and historical access.

Retain set editing, deletion, repeat/duplicate entry, set types, previous
performance, equipment-specific increments, plates assistance, rest timer,
session elapsed time, resume and hosted score routes. Repeat prepares a draft for
explicit logging. Preserve saved-set discard protection and explicitly support
clearing a previously saved RPE without changing unrelated fields.

Finishing confirms leaving unfinished targets or draft input and counts only
logged sets. With no logged sets, offer to discard the empty session. Cancelling
preserves already logged sets but does not count the session as a completed
Activity. Both clear unfinished drafts and coordinate with pending set writes;
finish/cancel must not race a still-saving set.

## Editor, drafts and recovery

The focused editor contains weight, reps, set type and optional RPE, including
half values. The comparison uses both available 1RM references and distinguishes
entered reps, reported effort and theoretical maximum reps. Missing references
remain unknown and do not prevent logging. Do not infer reported RPE or introduce
an unstated RPE correction into Epley calculations.

Strength Profile is a destination within the same presentation and uses the same
draft owner. Choosing a percentage/table result stages a candidate; Apply copies
weight/reps into the draft. Back before applying preserves the original input
and RPE. Only explicit Log/Save persists a set. Browsing and draft calculations
never overwrite saved references.

Keep one new-set draft per account/session/exercise on the device. It survives
sheet dismissal, exercise changes, app restart and sign-out while the session
remains active. Logging, explicit discard or session end clears the unfinished
draft. Validate session/account ownership before a recovered draft can write;
unavailable status must not cause silent loss of retained input.

Offline draft editing is not offline performed-set acceptance. Use a stable
operation identity and acknowledgement/recovery behavior so a server commit
followed by a lost response cannot produce a duplicate after restart. Keep input
after failure and block duplicate submissions; coordinate logging and end actions
through one owner. Full durable training-operation replay remains deferred and
is also outside the revised scope of issue #89.

## Strength references

Follow [ADR 0013](../adr/0013-sourced-strength-references-and-session-snapshots.md).
Parallel account-owned-data work also refers to ADR 0012; reconcile the companion
ADR numbering during integration, using the decision titles to identify the
intended contracts.
Logged Sets are authoritative. Store independent current measured and estimated
references per account/exercise in Convex, with their source Set, performance date,
value, unit and formula where applicable. Keep Manual One-rep Max entries separate,
explicitly labeled and available to choose candidate weights; never overwrite
them automatically or present them as measured evidence.

For exercises with an established load convention:

- Measured: the all-time heaviest eligible logged single.
- Estimated: the highest Epley estimate from eligible multi-rep performance.
- Eligible: explicitly logged positive load with at least one completed rep.
  Warm-up, working, drop and failure classifications can all qualify. Logged
  performance remains eligible in active, completed or cancelled sessions.
- Exclude Planned Sets, drafts, zero-rep attempts and unverified legacy sources.
  Normalize units for comparisons and use the actual source performance date.

Store a copy of resolved references and their provenance for each session/exercise.
They remain fixed throughout the session and after restart. Logging, correcting
or deleting a source updates current references for later sessions; existing
session snapshots retain their values even if a source changes or disappears.

Use equipment-specific increments rather than the mockup's universal 2.5 kg
example. Display percentages from the entered weight after rounding, and keep
theoretical rep counts visibly approximate. Bodyweight exercises continue to log
added weight (`+kg`), including zero. Their automatic load-reference calculations,
percentages and predicted reps remain unavailable until a total-versus-added-load
convention is defined. Preserve existing reference data; do not infer body mass.

## Implementation ownership and baseline

Build on the recent redesigns and the
[mobile folder contract](../guidelines/project/mobile-folder-structure.md): thin
routes own parameters/navigation/presentation; feature subjects own screens and
state; supporting UI stays in subject-local `components/`; app-wide controls and
platform adapters stay in `src/ui/`. Reuse canonical data services and core domain
calculations. Keep one owner each for draft state, scrolling, keyboard geometry,
safe areas and dismissal.

At investigation time, this branch and local main/origin/main shared `c59d8fb`,
including the recent nutrition migration and native-control work. The completed
Session final, rounds four/five and associated design guidance were copied
unchanged from uncommitted main-checkout work. That source checkout was not edited.
Recheck current source when implementing; these are dated observations:

- `InsetRow.trailing` already exists on both platforms. Verify independent hit
  targets/accessibility before extending it. The iOS SwiftUI adapter still exists.
- Shared swipe supports opt-in full swipe; leave it unset for Training.
- Current routed nutrition sheets demonstrate native headers, one draft owner
  and `FormScreen.nativeSheet`. Keep nutrition-specific components with their
  domain unless another feature demonstrates the same reusable contract.
- `DisclosureRow` still needs the selected icon/badge capability; `FormChoiceRow`
  needs radio/secondary-text/disabled support without breaking checkbox callers.
- Mobile translations live under `src/i18n/messages/`, not the HTML sketch's path.

Web and mobile share routine/session APIs. Web currently reconstructs routine
exercises from logged sets, so the target/performance change requires a functional
web update while retaining its visual design. Preserve hosted entry and read
consumers. Keep legacy compatibility and migration additive; do not rewrite
historical performances to fit the new schema.

## Delivery and acceptance

Implement the shared domain/API boundaries and compatibility first, then extend
current controls and feature owners, then connect the four live screen flows.
Profile's independent placeholder work can proceed without waiting for the
deferred enhancements. Production routes use the redesign; this is not Labs-only.

Use the [project verification procedure](../../.claude/skills/verify/SKILL.md).
Acceptance covers public behavior and native fidelity:

- Zero logged sets at routine start; explicit logging; legacy preservation; shared
  client compatibility; persisted exercise membership with no logged sets.
- Separate sourced measured/estimated/manual references, unit conversion,
  eligibility across set/session types, stable snapshots, source correction/deletion,
  missing references and bodyweight calculations remaining unavailable.
- Draft recovery across dismissal, exercise changes, restart, account changes,
  sign-out, failed saves and lost acknowledgements without duplicate performance.
- Saved-set edit/discard, RPE clearing, repeat/log, pending-write coordination,
  incomplete/empty completion and cancellation.
- Routine action parity and deletion failures; active/unknown session guards,
  server races, double starts, picker Back/keyboard/dismissal and downstream routes.
- Loading, empty, error and offline states, including cold starts and retained
  loaded data; clearly unavailable Profile placeholders and preserved working actions.
- iOS native sheets/headers, real keyboard transitions, larger text, VoiceOver,
  safe areas, independent row actions, light/dark and Dutch/English. Preserve
  Android adapters and report their actual coverage separately.

Run the required affected-target checks and record screenshots/recordings against
the applicable states in each selected reference. Include build/backend context,
file ownership, reused components, agreed deviations and remaining gaps in the
implementation report. Automated tests do not establish native design fidelity.

This thread verified documentation links/ownership and whitespace, inspected
source and the rendered final studies, and created enhancement #93. No application
tests, implementation completion or native acceptance are claimed by this contract.
