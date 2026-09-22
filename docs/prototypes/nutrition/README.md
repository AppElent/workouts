# Nutrition and appearance prototype

See the [September 22 merge selection](MERGE-SELECTION.md) for the retained scope
and the two presentation changes removed at the user's request.

Start with the [emulator report and iPhone checklist](REVIEW.md) for current
results, screenshots, launch instructions and remaining limitations.

Working implementation: `apps/mobile`. Scope is every Nutrition view and flow,
plus appearance support throughout the mobile app. Existing persistence,
snapshot semantics, integrations, and Android adapters remain authoritative.

## Screen contract and coverage

Inventory from `app/(app)`, `src/screens/nutrition-*`, personal-food editors,
personal measures, and their shared UI. Each row records its device review and specific gaps. Remaining **pending**
states are not visually accepted; existing tests alone are not visual evidence.
The report distinguishes Android review from physical iOS acceptance.

| Surface / entry | Immediate job / primary action | Native pattern; return behavior | Additional states | Review |
| --- | --- | --- | --- | --- |
| Nutrition tab / diary | Review intake; add food to a Meal Slot | Native tab and stack; retain selected date | Empty day, no goals, populated meals, training marker | Android light/dark empty, populated, loading and partial-offline diary reviewed; training-marker stress states remain |
| Date stepper / calendar | Select a diary date | Calendar disclosure; dismiss returns to diary | Today, historical/future dates | Android light/dark calendar and selected-day return passed |
| Data sources disclosure | Understand food provenance and missing values | Inline disclosure from More nutrition tools | NEVO version, derived salt, incomplete totals | Android light/dark reviewed |
| Goal summary | Read nutrient progress | Grouped summary with expandable detail | Unknown/trace values, no goals, minimum/maximum | Android light/dark expanded, incomplete, trace/unknown and loading/offline presentation reviewed |
| Goal ordering / menus | Choose summary order | Context menu and reorder controls; Done returns to summary | Pending/error, Reduce Motion | Android light/dark handles, drag, save, reopen, restore and Cancel passed after gesture fix; iOS motion pending |
| Diary entry / Logged Combo rows | Edit, copy, move, delete | Swipe/context actions; cancel preserves entries | Unavailable Food, snapshots, estimated values | Android edit/copy/move/delete and Combo expansion reviewed; unavailable-source device state not forced |
| Diary selection | Select entries for a Combo or transfer | Inline selection; Cancel exits selection | None/one/many selected | Android selection and Combo creation passed; storage-failure behavior covered by tests only |
| nutrition-food / Food Library search | Find a Food; select it | Pushed searchable list; Back returns to caller | All, recent, favorites, Personal Foods, Recipes, Combos, no matches, pagination | Android light/dark search, no matches, recent, Recipes and saved Combo journeys reviewed; exhaustive pagination not checked |
| Food details / Serving selection | Choose amount; log food | Form sheet; Cancel returns to results | Grams/ml, Servings, Personal Measures, validation, provenance | User passed iPhone amount/serving form, keyboard, safe areas and dismissal; stress states pending |
| Personal Food editor | Create/edit a Food or Recipe; save | Native editor sheet; Cancel preserves parent | Nutrients, trace/unknown, Servings, classification, dirty form | Android light/dark Recipe create/reopen/Cancel/delete passed; per-serving estimate, trace, unknown and icon persisted |
| Food Visual editor | Choose icon/photo | Progressive disclosure and system picker; cancel keeps old visual | Permission denied, unavailable photo, remove visual | Android icon and imported-photo crop/save passed; picker Cancel and camera denial preserved draft; real camera pending |
| Shipped Food correction | Fork a Shipped Food; save | Food editor; dismiss returns to search | Shadowing and restored original after fork deletion | Android light/dark editor/custom servings reviewed; fork save/delete restored original search result |
| Online search / Food Import review | Review external figures; save/log | Search results then review sheet; cancel discards proposal | Offline, no results, failure/retry, duplicate import | Android live search/review/crop/save and Cancel passed; 35 ml measure correctly calculated 21 kcal; provider failures test-only |
| Barcode scanner / manual barcode | Find a product | Camera modal; Close returns to browser | Permission denied, unknown code, lookup pending/error | Android light/dark denied camera and Close passed; physical scan pending. Manual Food entry is available, not a typed-barcode form |
| One-off Entry | Log figures without a reusable Food | Browser entry mode and form | Unknown/trace nutrients, estimate, validation | Android both-theme keyboard, zero validation and direct diary save passed |
| nutrition-entry | Edit a Diary Entry; save | Native form sheet; Cancel leaves snapshot intact | Unavailable source, amount, Meal Slot, validation | Android light/dark normal text reviewed; user passed iPhone log/edit/save/back in both themes; stress states pending |
| Entry transfer | Copy/move selected entries | Date/Meal Slot sheet; Cancel preserves selection | Same destination, pending, storage failure | Android light/dark move sheet, same-destination disabled, move/cancel reviewed; other states and iPhone pending |
| nutrition-copy | Copy a meal from another date | Pushed form; Back returns to diary | Empty source, inclusion selection, pending/error | Android empty light/dark, selection, copy and direct-link return passed; error states pending |
| nutrition-combos | Select/edit/log a Combo | Pushed list and focused detail; Back returns to caller | Empty, scale, excluded parts, unavailable Food, delete | Android light/dark saved Combo scale/Meal Slot/log passed; unavailable part and every edit/delete state not device-forced |
| nutrition-combo-new | Save selected entries as a Combo | Focused builder; Cancel returns to diary | Name validation, empty selection, pending/error | Android light/dark populated + save reviewed; remaining states pending |
| nutrition-goals | Set effective-dated Nutrition Goals; save | Grouped form; Back returns to diary | Nutrient/unit, min/max, date, dirty state, validation | Android Dutch compact enlarged text: validation/save and both-theme keyboard reviewed; user passed iPhone layout/save/back in both themes |
| nutrition-cooking | Log a One-off Entry | Focused capture form; Back returns to diary | Hub and One-off Entry form; invalid numbers, pending/error | Android One-off Entry validation and return-to-target diary passed; rare storage failure test-only |
| Capture Draft editor | Review saved note; convert to intake | Sheet; Cancel retains draft | Edit/delete, empty input, conversion, pending/error | Android light/dark Dutch compact enlarged text: create/edit/convert passed; other states and iPhone pending |
| nutrition-assistance | Review proposed nutrition; accept | Progressively disclosed form/review | Batch, label, estimate, unsupported/failed assistance, review before save | Android both-theme text match/review/Cancel, label parse/save/log and estimate review/Cancel passed; error/retry tests passed |
| nutrition-weekly-review | Review a week; open a day | Pushed summary/list; Back returns to diary | No intake, gaps, missing figures, historical goals, training markers | Android both-theme history, empty days, missing values and navigation reviewed; user passed iPhone layout/back in both themes |
| nutrition-library | Manage library and sync | Pushed grouped management view | Imports, refresh, conflicts, pending/offline/error | Android both-theme backup-off/no-import states reviewed; cross-device/conflict/provider-failure behavior test-only |
| personal-measures | Manage named exact amounts; save | Grouped list with focused editor; Back returns to caller | g/ml, edit/delete, duplicate/invalid input, pending/error | Android light/dark editor + keyboard; invalid/create/delete exercised; duplicate/offline and iPhone pending |
| Sync status / offline banner | Understand pending changes; retry | Inline status and recovery action | Pending, conflict, failed storage/network, reconnect | Android light/dark uncached/partial diary, local pending entry and reconnect passed; conflict/storage-full UI not forced |
| Profile → Appearance | Choose System, Light, Dark | Pushed grouped selection; Back returns to Profile | Saved override, live system change, restart, persistence failure | Android modes, live System and cold-restart override persistence passed; user passed iPhone modes; native launch splash pending |
| Remaining app / authentication | Retain existing jobs in both themes | Existing navigation and controls | Tabs, charts, dialogs, sheets, keyboard, startup | Android Home/Train/Progress/Profile/sign-in light/dark reviewed; sign-out/in passed; every secondary non-Nutrition view not device-reviewed |

For every applicable surface also exercise loading skeleton, empty action,
error/retry, pending/disabled, English/Dutch, long text, Dynamic Type XL,
keyboard open/dismissed, compact/large phone, safe areas, and Reduce Motion.
An unsupported action must explain its limitation rather than silently do nothing.

## Design direction

Use the repository's native navigation and form seam: system typography,
grouped opaque surfaces, separator rows, one lime identity, and focused editing.
System chrome owns material and transitions; content does not simulate glass.
Light mode needs a darker interactive lime/olive ink for contrast, independently
of the bright lime used on filled primary actions. Destructive and status colors
remain semantic. Screen titles belong to the navigator when it is visible.

## Verification log

- Initial state: clean worktree. Theme was a static dark palette; app config,
  navigation, status bar, and SwiftUI hosts forced dark appearance.
- Catalog checked: installed Appelent features cover web baseline/auth/i18n,
  CLI and MCP. No mobile appearance module is supplied; extend the existing
  mobile theme and synchronous local preference store.
- Theme implementation: persisted System/Light/Dark selection; reactive palettes
  and styles throughout the app; native appearance, navigation, SwiftUI hosts,
  status bar and window background; localized Profile entry and selection page.
- Automated baseline: all 52 existing mobile suites / 363 tests passed after
  migration. Mobile typecheck passed after building `@workouts/core` (this
  checkout initially lacked its generated declarations).
- Additional checks passed: 9 appearance tests (live System changes, override,
  first frame, remount persistence, retained draft, Dutch copy, storage failure),
  10 palette contrast tests, 2 native picker contract tests.
- Android review evidence was collected on the isolated Nutrition_Review AVD:
  Android 17, Pixel 9 Pro profile, 1280 x 2856, 480 dpi, font scale 1.0,
  Expo Go SDK 57. Screenshots below are actual device captures.
- Root checks passed: Biome, TypeScript, 38 Vitest suites / 327 tests, production
  build. Final mobile checks passed: TypeScript, Biome (232 files), and all
  57 suites / 391 tests. Copy/One-off navigation, goal-loading, assistance and
  authoring regressions are included. Original flow/data assertions are retained.
  A real Android drag check caught the goal responder bug missed by simulated
  accessibility actions; it passed after preserving the responder across moves.
- The iOS production JS/Hermes export passed after the form changes. This is
  bundle validation, not native iPhone acceptance.
- Native configuration resolves automatic appearance and has light/dark splash
  colors. Rebuild the client to review the native launch screen. Expo Go cannot
  validate that screen; a saved override differing from the system may still
  transition from the system splash to the app preference before first content.
- Android live refresh exposed a `NativeDatabase.prepareSync` /
  `java.lang.NullPointerException` failure. An isolated native wrapper-release
  probe subsequently reproduced it; independent repository connections passed
  that probe. All Nutrition openers now use the same connection helper. See
  [the diagnosis](SQLITE-REVIEW.md) and [final review](REVIEW.md) for the native
  evidence and app reload results. This does not control every GC timing case.
- Physical iPhone acceptance: the user passed appearance selection and the food
  amount/serving form checks below. The remaining journeys and stress states
  still require review; Android evidence cannot establish native iOS behavior.

## Reference study

Inspected ten official Apple screenshots before the screen-polish pass:

- [Health profile, checklist, and highlights](https://support.apple.com/en-us/104997):
  three screens; grouped fields, clear section headings, summaries as objects.
- [Reminders creation, tags, contextual menu, and selection actions](https://support.apple.com/en-us/119953):
  four screens; native task sheet, grouped rows, anchored menus, explicit selection.
- [Health data entry and source ordering](https://support.apple.com/en-us/108779):
  two screens; focused numeric entry with keyboard and reorderable grouped rows.
- [Sleep score](https://support.apple.com/en-us/108906): one screen; a primary
  metric followed by explanatory rows and progressively disclosed history.

Apply these patterns to Nutrition forms, search/library lists, diary summaries,
context menus, selection/transfer and review. Adopt the interaction and grouping
patterns, retain Foundry's lime identity. iOS 26/27 reference screenshots are
visual references; OS-owned chrome follows the actual installed iOS version.
Native segmented selection follows the installed SDK 57 Picker API, with a
menu at large text sizes or when the row cannot fit its options.

## Launch and acceptance journeys

Use the mobile package scripts and `.claude/skills/verify/SKILL.md`. Start Metro
from this worktree on an unused port, connect the development client/Expo Go
compatible with the installed SDK, and use the configured development test user.
Never use a production account for prototype fixtures. Native configuration
changes require rebuilding an existing development client.

Required recorded journeys in both themes: log food → edit entry; create Combo
→ log scaled Combo; capture note → review/convert; change Nutrition Goals →
review historical day; weekly review → diary; Profile → Appearance → other tabs
→ restart. Record device/OS, locale, font scale, theme, and actual outcome.

## Device evidence collected so far

The initial evidence below uses normal English text size. Compact Dutch
checks are recorded separately below. These partial reviews do not certify all
remaining states, iOS Dynamic Type XL, or native iOS behavior.
The Expo developer tools button appears in some earlier captures; it has since
been hidden. Evidence from an earlier layout is identified below.

| Journey / surface | Result | Evidence |
| --- | --- | --- |
| Profile -> Appearance | System default, immediate Dark/Light override; explicit Light survives dark system toggle; System reacts dark -> light live | [Dark](android-appearance-dark.png), [System/light](android-appearance-system-light-return.png), [recording](android-appearance.mp4) |
| Diary | Empty and populated reachable, readable in both palettes | [Empty light](android-diary-empty-light.png), [Populated light](android-diary-populated-light.png), [Populated dark](android-diary-populated-dark.png) |
| Search -> serving -> log -> edit | Searched Apple, chose one apple (130 g / 73 kcal), logged to Breakfast, edited quantity to 2 (146 kcal), returned to updated diary | [Search + keyboard](android-food-search-keyboard-light.png), [recording](android-log-food-light.mp4); recording predates compact serving/entry form polish |
| Entry form polish | Shared grouped form, full serving labels, fixed Save action; palette switch retains quantity | [Light](android-entry-light.png), [Dark](android-entry-dark.png) |
| Create Combo | Selected the Apple diary entry, named and saved Prototype Apple Combo, returned to collapsed Logged Combo | [Light](android-combo-builder-light.png), [Dark](android-combo-builder-dark.png) |
| Log Combo | Opened saved Combo, scaled to 0.5, selected Lunch, previewed 130 g and logged; Lunch shows 73 kcal | [Light](android-combo-log-light.png), [Dark](android-combo-log-dark.png) |

Review fixtures use the configured development test account on 2026-09-20.
The Apple entries (including one converted note) and Prototype Apple Combo are intentionally retained for
continued testing. No production data was used.

Weekly review was also exercised in both palettes, and selecting Monday returned
to the correct historical diary day. Its screenshots precede removal of the
redundant content title. The goal date now opens from a disclosure row, keeping
the calendar available without putting it ahead of the user's targets.

## Physical iPhone review

From the same Wi-Fi network, open `exp://192.168.68.50:8083` in a client
compatible with SDK 57. Metro must be running from this worktree:

```powershell
pnpm --filter @workouts/mobile exec expo start --port 8083 --go
```

User-confirmed review device: **iPhone 17 Pro Max, iOS 27**.
The user confirmed that the preview opens successfully, then reported both of
these flows look and work correctly: Profile → Appearance (Light, Dark, System),
and Nutrition → + → food → amount/serving form. Their review covered colors,
native controls, keyboard, safe areas, and swipe-to-dismiss on those flows.
This is user-reported physical-device acceptance; no iPhone recording was supplied.
The user subsequently passed food logging/editing, Nutrition Goals, and Week
overview in both themes, including saving, back navigation, and layout.

**Review order updated by the user:** finish all emulator checks and deliver the
report first. The user will perform the remaining iOS checks against that report
afterward. Do not block emulator completion or request more interim iPhone checks.
Record client type/build, language, and text size.
Use the development test account. Run these in Light and Dark:

1. Profile -> Appearance: choose each mode, visit all tabs, close/reopen the
   app, and change the iPhone's system appearance while System is selected.
2. Nutrition -> +: search for a food, open serving options, change amount,
   log it, reopen its diary entry, edit and save. Check the native picker,
   sheet grabber, keyboard, dismissal, safe areas, and return destination.
3. More nutrition tools -> Create Combo: select diary entries, name and save.
   Log Combo: change scale and meal; confirm diary totals and preserved template.
4. Save a search as a note, reopen its Capture Draft, edit it and convert it
   through review. Confirm the draft is not counted as intake before conversion.
5. Edit goals, validate a bad amount, save a valid change; open Week overview
   and navigate back to its diary day.
6. Repeat representative forms in Dutch and at Dynamic Type XL. Enable Reduce
   Motion; check that navigation and sheet dismissal remain usable.

Capture both-theme screenshots and short recordings of sheets and keyboard
interaction. Report the route/action, expected result, and observed issue.
The emulator report is available in REVIEW.md. Final physical iPhone acceptance
and the explicitly listed gaps remain open, as requested by the user.

## Compact Dutch review update

Android review at 320 dp width (960 x 2100, density 480), font scale 1.3:

- Diary totals and the long Combo name wrap without losing the controls:
  [light diary](android-diary-nl-compact-xl.png).
- Goals reject a negative amount, keep the draft, and accept a corrected 2000
  kcal maximum. Saving returns to the diary. The test saved the same targets
  with effective date 2026-09-20; no target amount remains changed.
- Goal fields now use shared grouped numerical rows with units and a fixed Save
  action. The date remains available through disclosure. Goal focus respects
  Reduce Motion. The shared form now accounts for the native stack header when avoiding
  the keyboard; Save is visible above it in both palettes:
  [light](android-goals-light-nl-compact-xl-keyboard.png),
  [dark](android-goals-dark-nl-compact-xl-keyboard.png).
  TypeScript and all 13 affected form/goal/draft tests pass after this fix.
- Capture Draft creation leaves the total at 218 kcal. Editing and saving the
  note succeeds at enlarged text, including with the keyboard visible. Changing
  System appearance updates the modal and keyboard while preserving the draft:
  [light](android-draft-editor-light-nl-compact-xl.png),
  [dark](android-draft-editor-dark-nl-compact-xl.png).
- Resolving the draft opens search; choosing Appel and logging one apple removes
  the note and increases total intake to 291 kcal:
  [serving sheet](android-serving-dark-nl-compact-xl.png),
  [conversion recording](android-draft-conversion-dark.mp4).
- Fixed translucent toast backgrounds discovered during validation; toasts now
  use an opaque semantic surface and announce errors to accessibility services.
- The native iPhone review remains pending. Android font scale 1.3 is a stress
  check, not evidence for iOS Dynamic Type XL.

Some intermediate captures are retained under ignored `docs/.generated/nutrition-diagnostics/` as diagnostic evidence only:
`android-language-nl-compact-xl.png` shows the launch screen,
`android-home-nl-compact-xl.png` includes a development overlay, and
`android-goals-keyboard-height-check.png` includes a Gboard settings notice.
They are not accepted screen evidence. The earlier goal validation capture
predates the opaque toast fix.

## Library, measures, copy, and transfer review

English, Android 17, 1280 x 2856 at 480 dpi and font scale 1.0:

- Library backup is clearly off, and refresh is disabled when there are no
  imports: [light](android-library-light.png), [dark](android-library-dark.png).
  Backup was not enabled during this review.
- Personal Measure creation rejected an incomplete amount. A temporary
  `Prototype bowl` (150 g) was saved and deleted; the pre-existing `Test maar`
  measure was preserved. The editor keeps Save above the keyboard:
  [light](android-measure-editor-light.png), [dark](android-measure-editor-dark.png).
- Copy meal explains an empty source and disables submission:
  [light](android-copy-empty-light.png), [dark](android-copy-empty-dark.png).
  Selecting today's Breakfast correctly blocks copying back into itself.
  Copying one Apple to Dinner increased the day from 291 to 364 kcal.
- Directly opening Copy meal had no back-stack entry: saving succeeded but the
  screen stayed on "Copying...". A real-router regression reproduced the unhandled
  `GO_BACK` action. The fix returns to the target diary date when there is no
  previous screen. Single-food copy wording and Select all / Deselect all labels
  now reflect the selection. The original diagnostic recording is not accepted
  navigation evidence. Device retest passed: copying one item to September 21
  Lunch returned to that date's diary. The temporary copied entry was deleted.
  [Selection](android-copy-populated-light.png),
  [destination diary](android-copy-return-diary-light.png),
  [retest recording](android-copy-direct-return.mp4).
- Moving the copied Apple from Dinner to Snacks retained 73 kcal and emptied
  Dinner. Same-destination submission was disabled, and Cancel returned to the
  diary: [dark](android-transfer-dark.png), [light](android-transfer-light.png),
  [reopened same-destination state](android-transfer-light-reopened.png),
  [recording](android-move-entry.mp4). Sampled frames confirm the disabled
  destination, new selection, and resulting diary. Full motion review remains.
- Delete confirmation identifies the entry, meal and date, with readable
  destructive button text: [light](android-delete-entry-light.png),
  [dark](android-delete-entry-dark.png). Confirming deletion of the temporary
  copied entry restored 291 kcal. The earlier `android-delete-measure-*` captures
  predate the destructive contrast fix.
- Assisted text logging parsed `130 g apple`, required explicit selection among
  matches, and reviewed `130 g · Apple` before any write. No assisted batch was
  logged. The candidate list now uses the shared choice control to show the
  selected match, verified in [light](android-assistance-selection-light.png)
  and [dark](android-assistance-selection-dark.png). Review remains explicit:
  [light](android-assistance-review-light.png), [dark](android-assistance-review-dark.png).
  Back returned to the diary with its total unchanged at 291 kcal.

The final iOS bundle export passed after the emulator fixes (8.5 MB Hermes
bundle). See REVIEW.md for final checks and device coverage. Physical iPhone
connection and the flows listed above are user-confirmed on iPhone 17 Pro Max,
iOS 27; the remaining checklist follows the report.
