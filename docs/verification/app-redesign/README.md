# App redesign implementation

Implementation of [#94](https://github.com/AppElent/workouts/issues/94), based on
`c59d8fb124096b685781c7eb93566e8271464734` on `t3code/app-page-redesigns`.
Fetched main matched that starting revision. The accepted
[product contract](../../product/app-redesign.md), designs and ADRs accompany the
implementation.

## Current status

Implemented and verified on 7 October 2026. Automated checks pass. iOS simulator
and authenticated web journeys were exercised; complete native acceptance is
**not** claimed. Android, physical-device and spoken VoiceOver checks remain
unverified. The native state coverage and observed limitations below are the
remaining acceptance work.

Profile, Training, Start activity and Strength Session now have feature-owned
screens with thin routes. Existing native stacks, form sheets, menus, grouped
rows and the five-tab shell are retained. Planned targets are separate from
logged performance, new-set drafts survive local dismissal/restart, and Log
receipts support safe recovery from an uncertain acknowledgement. Measured,
estimated and manual strength references retain distinct provenance and each
session freezes its reference values. Web and hosted-session consumers use the
same backend contracts. Profile placeholders remain explicitly deferred to
[#93](https://github.com/AppElent/workouts/issues/93).

## Automated verification

The user approved existing routed mobile journeys and authenticated public Convex
APIs as the primary boundaries, with existing core numeric tests for calculations.
No new test framework was introduced.

| Gate | Final result |
| --- | --- |
| `pnpm check` | Pass: formatting and mobile architecture; one existing unused `router` warning in nutrition's `log-food-amount-sheet.tsx` |
| `pnpm typecheck` | Pass |
| `pnpm --filter @workouts/mobile typecheck` | Pass |
| `pnpm test` | 58 files, 434 tests pass |
| `pnpm --filter @workouts/mobile test --runInBand` | 90 suites, 592 tests pass |
| `pnpm build` | Pass |
| `pnpm exec convex dev --once --typecheck=enable` | Pass; final development upload at 21:43 CEST |
| `git diff --check` | Pass |

The root suite covers ownership, active-session guards, prescriptions without
performance, finish/cancel/hosted behavior, sourced records and frozen snapshots,
unit conversion, optional/cleared effort, idempotent receipts, previous-session
performance and deleted-exercise rejection. The latter regression was observed
failing before converting the known rejection to `ConvexError`, then passing.

Mobile journeys cover retained drafts, account isolation, storage failure,
offline/unverified state, pending/double actions, uncertain acknowledgement,
repeat versus Log, saved-set discard and RPE clearing, source candidate Apply
versus Back, ended sessions, native Start selection and active-session guards,
Training's independent controls, and Profile identity/placeholders/sign-out.

Full suites were rerun after review fixes and native layout corrections. A
nutrition test's ambiguous Dinner text selector also failed against the clean
starting revision; it now selects the existing checkbox by role. Independent
trailing controls exposed missing disabled accessibility metadata on a nutrition
switch; that metadata is restored without changing its actual disabled behavior.

## Runtime identity

- iOS: dedicated **Workouts Redesign 4d4bd924**, iPhone 18 Pro simulator,
  iOS 27.0, UDID `ADE31FC3-D9AE-4727-ABA7-3E39E1AB89D6`; 402 × 874 logical points.
- Client: `com.appelent.foundry`, development runtime
  `3720fa5dde1b2d8bf1948b572edf25e2bb1f2f41`; Expo 57.0.25,
  React Native 0.86.3, `@expo/ui` 57.0.20. Metro port 8094 served this worktree.
- Observed application revision: the working-tree implementation included in this
  report's commit, based on `c59d8fb`. Layout evidence follows the relevant edits;
  earlier evidence is explicitly identified below.
- Backend: isolated development deployment **proper-guineapig-890**,
  `eric-jansen:workout-tracker:dev/ericjansen-t3code/4d4bd924`.
  The user explicitly approved uploading schema/API code to this destination.
- Account: the documented development test account. Verification created test
  sessions and one routine only on this isolated deployment.
- Appearance/language: Dutch/light and English/dark; standard `large` and
  `accessibility-large` Dynamic Type. Text size was restored to `large`.
- Web: collaborative browser, localhost:5185, same isolated backend/test account.

## Reference comparison and iOS evidence

Native equivalents follow the current Foundry design system rather than copying
HTML browser chrome. The accepted placeholders and basic-session-only scope are
intentional deviations; Supersets/AMRAP/EMOM workflows remain outside #94.

| Reference and state | Observation / evidence |
| --- | --- |
| [Profile final](../../../designs/app/profile_final.html): identity, grouped preferences/nutrition, unavailable totals | Pass: real test-account identity, dash placeholders with truthful explanation, colored icon tiles and inset separators. [Dutch/light](evidence/ios-profile-nl-light.png), [English/dark](evidence/ios-profile-en-dark.png). Appearance/language routes remain reachable. |
| Profile account/export/delete placeholders and sign-out | Implemented and covered by routed tests. Account placeholder details, sign-out retention and offline appearance still need a complete native acceptance pass. |
| [Training final](../../../designs/app/training_final.html): populated/empty list, compact row and independent actions | Empty state observed before creating the routine. Populated row, library links and separate Play/ellipsis targets verified. [Final populated screen](evidence/ios-training-en-dark.png). Name/Edit opens the routine editor; Play offers Resume when another session is active and starts a session once none is active. |
| Training menu | Native ellipsis exposes Start/Edit/Delete; Edit verified. [Menu](evidence/ios-training-menu-en-dark.png). This earlier capture predates singular-count copy correction only. Native long-press, swipe/delete confirmation and all History filters still need device acceptance. Delete failure/row retention and independent targets are automated. |
| Training larger text | Fresh launch at `accessibility-large` preserves readable row contents and independent controls. [Capture](evidence/ios-training-accessibility-large.png), predating singular-count copy correction only. Existing shell accessory limitation below. |
| [Start activity final](../../../designs/app/start-activity_final.html): default selection and routines | Pass: empty Strength selected initially; routine is a selection, with counts; name field shown for empty Strength. [English/dark](evidence/ios-start-activity-en-dark.png). |
| Start keyboard, dirty dismissal and nested navigation | Entered an optional name in Dutch, cancelled dismissal to keep editing, then discarded and reopened a clean sheet. Running changes Start to Continue and opens the existing endurance form in the same sheet, even with active strength work. Back retains Running; Close returns to tappable Training. [Nested flow recording](evidence/ios-start-nested-back.mp4). WOD nested completion and Cycling completion remain unverified on-device. |
| [Session overview A](../../../designs/app/session_round1.html): planned versus performed rows | Pass: routine opens three muted targets, zero logged sets/volume, previous-session values and no false checkmarks. [Planned session](evidence/ios-planned-session-en-dark.png). A performed set produces a checkmark/count/volume. [Earlier Dutch capture](evidence/ios-logged-session-nl.png) predates the short reps header and singular set correction. |
| Session larger text | Native inspection prompted stacked rows instead of narrow columns at larger font scales. [Final stacked targets](evidence/ios-session-accessibility-large.png); previous values and target actions remain available. |
| [Session final](../../../designs/app/session_final.html): editor input and local draft | Pass: type weight 60, switch to reps 5, close and reopen with values retained; optional RPE 7.5 entered and retained. Missing measured/estimated references show dashes. [Dutch draft](evidence/ios-set-draft-nl.png). Larger quantities stack full-width: [final larger-text editor](evidence/ios-editor-accessibility-large.png). |
| Editor nested plate presentation and explicit Log | Opened/closed plate calculator, then logged 60 kg × 5 at RPE 7.5; returned to one logged set, 300 kg working volume and running rest timer. [Recording](evidence/ios-plates-log.mp4). No stuck overlay. Native saved-set correction opens with Save disabled until dirty; Close asks to discard; discarding retains original logged values. |
| Strength Profile sources and Apply | Pass: measured 70 kg from 70 kg × 1; estimated 70 kg from 60 kg × 5; distinct dates/source labels and frozen-session explanation. [Sources](evidence/ios-strength-sources-en-dark.png). 80% rounds to 55 kg and displays actual 78.6%; Apply changes draft to 55 × 8 while logged count remains zero. [Apply recording](evidence/ios-strength-profile-apply.mp4), [result](evidence/ios-applied-set-en-dark.png). Back from the missing-reference view preserved input and Apply was disabled. Manual persistence and rep-max calculations are automated; manual/rep-table candidate selection still needs journey and native coverage. |
| Finish | Performed session Finish confirmation creates the expected summary/activity. Web also verifies unfinished-target confirmation. Native empty-session discard, cancellation, hosted score entry and failure/retry remain acceptance gaps; public API/mobile journeys cover their domain behavior. |

## Web compatibility

Authenticated with the documented test shortcut. Created a routine with three
planned squat sets; Start opened zero logged rows with three remaining targets.
Logged a 70 kg single, opened Edit and chose Repeat: the next input became 70 × 1
while the table stayed at one row. Explicit Log created the second row. Finish required
acknowledging the one unperformed target and completed successfully. The native
client reflected these writes and retained the original session's frozen
reference values. [Completed routine](evidence/web-completed-routine.png).

## Standards

Independent review found and resolved the web invalid-input recovery lock and
Repeat reseeding/identity problems. Follow-up found the known deleted-exercise
rejection could leave a frozen draft: the backend now returns a typed rejection,
with a public-API regression test proving no Set or receipt is created. Uncertain
transport failures and mismatched receipt payloads still preserve the original
operation identity. The final accessibility layout delta had no blocking findings.
The integration switch accessibility regression was also corrected.

## Spec

Independent review found and resolved four issues: kg steps incorrectly used as
lbs steps; unavailable references shown as missing history; legacy unverified
records exposed as current evidence; and above-1RM predictions rendered as zero
reps. Source qualification is now consistent in current APIs/web displays and
translated in mobile history. The final code delta had no new findings. Runtime
acceptance gaps remain distinct from automated/code-review results.

Review totals: Standards 3 primary findings resolved; Spec 4 findings resolved.

## Remaining native acceptance and observed limitations

- **Live Dynamic Type:** changing text size while RN screens remain mounted can
  clip their existing text layout; relaunching restores correct measurement.
  Training and the new Session/editor layouts were checked after relaunch. This
  runtime behavior is not fixed or accepted as complete in this change.
- **Existing tab accessory:** the active-workout accessory above the tab bar clips
  at `accessibility-large`, including after relaunch. Its shell is outside the
  redesigned feature owners. See the larger-text Training evidence.
- **Accessibility:** semantic snapshots checked names/values and independent
  actions, but spoken VoiceOver reading order and gestures were not verified.
  Screenshots do not establish spoken accessibility acceptance.
- **Keyboard:** input switching, sheet expansion, close/reopen and parent recovery
  were exercised. The fixed editor footer sits behind the numeric keyboard while
  focused; a complete keyboard-dismiss/submit gesture pass remains to be done.
- **Android:** T3 successfully opened Pixel 9 Pro XL / Android 17.0. No Foundry
  client/APK was installed or found, and Java was unavailable for a local build.
  Android adapter behavior, Back/keyboard and edge-to-edge layout are unverified.
- **Physical device:** unavailable; haptics and final device feel are unverified.
- Remaining state-specific native checks are named in the comparison table;
  automated tests must not be interpreted as visual acceptance for those states.

Expo's floating development gear is visible in some evidence and overlaps part of
the native Finish/History area. Its expanded hit region also caused accidental
Dev Menu openings during automation; this is client chrome, not a production app
control. The iOS automation snapshot often labels visible sheet contents as
covered, so screenshot-observed coordinates were used where its references could
not be activated. No application workaround was added for either tool/client
limitation.
