# Nutrition prototype: emulator review and iPhone checklist

**September 22 selection:** items 4 (simplified Food editor) and 5 (assistance
presentation) were removed before local main integration. See the
[merge selection](MERGE-SELECTION.md). The evidence below records the earlier
September 20 prototype and is not a fresh acceptance pass of the merged version.

The Nutrition prototype and app-wide System / Light / Dark appearance are ready
for the next iPhone review. The Android journeys below passed; this is not a
claim that every failure condition or native iOS behavior has been accepted.
Unverified cases and the SQLite regression evidence are listed explicitly below.

## What changed

- Added Profile → Appearance with immediate, persisted System, Light and Dark
  choices. System is the default. Navigation, forms, sheets, dialogs, charts,
  authentication, keyboard configuration and the other tabs use semantic colors.
- Reworked Nutrition around grouped forms, compact rows, progressive disclosure,
  focused editors and platform controls. iOS uses the existing native adapters.
- Fixed Android goal icons and touch dragging. The gesture now keeps its state
  when rows move; save/reopen and restoring the original order passed.
- Kept Save available above the keyboard, including compact Dutch forms.
  Improved selected, destructive, disabled and error presentation.
- Fixed Copy meal and One-off Entry completion so they reach the correct diary
  when opened directly. One-off Entry rejects zero/invalid amounts without
  losing the draft.
- Fixed misleading goal and meal states while loading or offline. Uncached
  goals no longer flash “No goals”; partially cached meals no longer claim
  “Nothing logged yet.” Locally accepted entries remain usable while reconnecting.
- Moved Personal Food naming ahead of its optional visual editor. Icon/photo
  controls expand on demand; saved nutrition, Recipe classification, estimates,
  trace values, servings and import provenance remain intact.
- Gave Nutrition repositories independent SQLite connections after reproducing
  an Android native-handle release failure. Database files and data are preserved.
  [Diagnosis and native regression check](SQLITE-REVIEW.md).

## Environment and checks

Android 17 / API 37.1, isolated `Nutrition_Review` emulator, Expo Go SDK 57.
Normal review: Pixel 9 Pro profile, 1280 × 2856, 480 dpi, English, font scale 1.0.
Additional review: 320 dp width, Dutch, font scale 1.3. Android enlarged text is
not a substitute for iOS Dynamic Type XL.

| Check | Result |
| --- | --- |
| Mobile Jest | **57 suites, 391 tests passed** in the final full run |
| Mobile TypeScript | Passed |
| Biome, mobile | 232 files checked; passed |
| Whitespace / patch validation | `git diff --check` passed |
| iOS JS/Hermes export | Passed; 8.5 MB bundle, `dist/goal-review-ios-final` |
| Android SQLite regression | Native release probe passed; **10/10 consecutive device reloads** rendered the diary successfully |
| Root regression checks from the implementation pass | TypeScript, Biome, 327 tests and production build passed; root application code has not changed since |

The export validates bundling. It does not run SwiftUI or establish iOS visual
acceptance. Development exports remain ignored local artifacts.

## Emulator coverage

“Reviewed” means the named screen or journey was exercised on Android and its
appearance inspected. It does not mean every state in the original inventory
was reproduced. The [full screen contract](README.md#screen-contract-and-coverage)
retains the specific gaps.

| Area | Confirmed result | Visual evidence |
| --- | --- | --- |
| Appearance | Immediate overrides, live System changes, draft retention; explicit Dark survived force-stop/reopen with the system set to Light | [Restart](android-appearance-restart-dark.png), [appearance recording](android-appearance.mp4) |
| Diary, date and goals | Empty/populated days, date selection, expanded nutrients, source disclosure, reorder, save/reopen, restore and Cancel reviewed in both themes | [Calendar light](android-calendar-light.png), [dark](android-calendar-dark.png), [goal ordering light](android-goal-order-light.png), [dark](android-goal-order-dark.png) |
| Food search → log → edit | Search, servings, quantities, save and resulting intake exercised; quantity retained across appearance changes | [Entry light](android-entry-light.png), [dark](android-entry-dark.png), [initial journey](android-log-food-light.mp4) |
| Combo | Selected diary food, saved Prototype Apple Combo, logged scale 0.5 to Lunch; resulting 73 kcal confirmed | [Builder light](android-combo-builder-light.png), [dark](android-combo-builder-dark.png), [log light](android-combo-log-light.png), [dark](android-combo-log-dark.png) |
| Capture Draft | Save search as note, edit and convert; note did not count as intake before conversion. Dutch, compact enlarged text and both themes exercised | [Light](android-draft-editor-light-nl-compact-xl.png), [dark](android-draft-editor-dark-nl-compact-xl.png), [conversion](android-draft-conversion-dark.mp4) |
| Copy / move / delete | Empty source and same-destination safeguards, selection, copy, move, Cancel and confirmed deletion; direct-link copy returns to target diary | [Copy return](android-copy-return-diary-light.png), [move light](android-transfer-light.png), [dark](android-transfer-dark.png), [delete light](android-delete-entry-light.png), [dark](android-delete-entry-dark.png) |
| Nutrition Goals | Invalid negative value retained for correction; corrected save returns to diary. Dutch compact keyboard layout reviewed in both themes | [Light](android-goals-light-nl-compact-xl-keyboard.png), [dark](android-goals-dark-nl-compact-xl-keyboard.png) |
| One-off Entry | Zero rejected; 1 serving / 120 kcal saved directly to target Dinner. Estimated energy and unknown protein shown distinctly | [Light keyboard](android-one-off-keyboard-light.png), [dark](android-one-off-keyboard-dark.png), [final save/return](android-one-off-return-diary.mp4) |
| Personal Food / Recipe | Created Recipe with 250 kcal per Bowl, estimated figures, trace protein and Prepared meal icon; Recipes filter and reopened editor preserved it; Cancel and deletion worked | [Editor light](android-recipe-editor-light.png), [dark](android-recipe-editor-dark.png), [serving light](android-recipe-serving-light.png), [dark](android-recipe-serving-dark.png) |
| Food Visual | Icon selection, system photo-picker cancellation and camera denial preserved the draft. Imported photo crop choice saved with the product | [Denied camera](android-photo-permission-dark.png), [photo controls](android-import-photo-dark.png) |
| Shipped Food correction / custom servings | Opened Apple correction and serving editor; saved a personal fork, then deleted it and confirmed the original Apple returned to search | [Correction light](android-correction-light.png), [dark](android-correction-dark.png), [serving keyboard light](android-custom-serving-light.png), [dark](android-custom-serving-dark.png) |
| Online import | Live Open Food Facts search, review, photo crop and save succeeded; 100 ml showed 60 kcal, existing 35 ml Personal Measure showed 21 kcal. Cancel also returned to search | [Review light](android-import-review-light.png), [dark](android-import-review-dark.png), [measure calculation](android-import-serving-dark.png) |
| Barcode | Denied camera screen explained the limitation; Close returned to usable food search | [Light](android-barcode-denied-light.png), [dark](android-barcode-denied-dark.png) |
| Personal Measures | Invalid amount rejected; created and deleted temporary 150 g measure; existing measure preserved | [Light](android-measure-editor-light.png), [dark](android-measure-editor-dark.png) |
| Text assistance | Parsed `130 g apple`, required an explicit match, reviewed before write; Back preserved diary total | [Selection light](android-assistance-selection-light.png), [dark](android-assistance-selection-dark.png), [review light](android-assistance-review-light.png), [dark](android-assistance-review-dark.png) |
| Pasted label | Parsed 250 kJ as 59.8 kcal per 100 g, left absent nutrients blank; saved food and logged 100 g to Dinner, displayed as 60 kcal | [Nutrients light](android-label-nutrients-light.png), [dark](android-label-nutrients-dark.png), [result](android-label-diary-dark.png) |
| Estimate assistance | Entered 300 kcal estimate, opened editable review; Cancel retained inputs and did not log anything. Unsupported photo assistance is explained in the screen | [Review light](android-estimate-review-light.png), [dark](android-estimate-review-dark.png) |
| Weekly review | Populated history, empty days, missing values and absent historical goals readable; previous week and day navigation worked | [Light](android-week-final-light.png), [dark](android-week-final-dark.png) |
| Offline diary / reconnect | Logged Apple on an uncached date; pending entry, missing-goal notice and unknown meal contents were accurate in both themes. Reconnect synchronized entry and goals | [Light](android-offline-partial-diary-light.png), [dark](android-offline-partial-diary-dark.png), [recording](android-offline-log-reviewed.mp4) |
| Library settings | Backup-off and no-import states readable; unavailable refresh disabled | [Light](android-library-light.png), [dark](android-library-dark.png) |
| Other tabs / authentication | Home, Train, Progress, Profile and sign-in visually reviewed in both themes; sign-out/sign-in succeeded | [Home light](android-home-final-light.png), [dark](android-home-final-dark.png), [Train light](android-train-final-light.png), [dark](android-train-final-dark.png), [Progress light](android-progress-final-light.png), [dark](android-progress-final-dark.png), [Profile light](android-profile-final-light.png), [dark](android-profile-final-dark.png), [sign-in light](android-auth-light.png), [dark](android-auth-dark.png) |

The repeatable [Android goal-drag check](check-goal-drag.ps1) failed before the
fix and passed afterward. Run it from the repo root with English Nutrition
Reorder goals open on emulator-5556. It changes the draft order; use Cancel to
discard it. The native gesture is the regression seam; Jest accessibility-action
coverage alone did not catch this bug. [Verified recording](android-goal-reorder-verified.mp4).

Recordings were inspected through sampled frames for form, sheet, navigation and
result states. They are not a frame-rate or continuous animation certification.
The initial log-food clip predates the final compact serving/entry forms; the
current form screenshots are authoritative. The older copy clip contains the
subsequently fixed goal-loading flash. Do not use diagnostic clips as final UI
acceptance evidence.

Temporary Recipe, imported product, label food, correction fork, and September
21–24 test entries were removed. The September 20 Apple/Combo review fixtures
were retained. Existing user/test-account history and Personal Measures were
preserved. Emulator network is restored; appearance is System.

## Verification limits

- **Android SQLite:** the isolated native release check failed with default
  cached connections and passed with the repository connection helper. The
  app then passed 10 consecutive device-only reloads with the diary visible.
  The exact GC timing of earlier refresh failures was not controlled; see the
  [diagnosis and regression evidence](SQLITE-REVIEW.md). Native iOS lifecycle
  behavior still belongs in the iPhone review.
- Camera permission denial and navigation were checked. Optical barcode
  recognition and taking a real product photo need a physical camera. “Enter
  manually” refers to manual Food entry; there is no separate typed-barcode form.
- Cloud backup conflict dialogs, cross-device restore, provider rate limiting,
  storage-full failures and every retry branch were not visually forced in the
  live emulator. Existing library/offline/import/operation tests cover many of
  these behaviors; that is automated coverage, not device acceptance. Backup was
  left off.
- English and Dutch compact forms were sampled, not every screen × language ×
  font-size combination. Native iOS Dynamic Type XL, VoiceOver, Reduce Motion,
  sheet gestures, SwiftUI controls and continuous transition smoothness still
  need the iPhone pass.
- Expo Go cannot validate the app's own native splash. The configuration now
  follows system appearance with light/dark splash colors; rebuild a compatible
  development client to review it. A stored override differing from the system
  can transition from the system splash to the app's saved preference.

## iPhone review

Device already confirmed: **iPhone 17 Pro Max, iOS 27**. You already passed preview
connection, Appearance choices, food amount/serving controls, log/edit/save/back,
Nutrition Goals and Week overview in both themes. Those are user-reported passes;
no iPhone recording was supplied.

Open `exp://192.168.68.50:8083` on the same Wi-Fi. If Metro has stopped:

```powershell
pnpm --filter @workouts/mobile exec expo start --port 8083 --go
```

Use the configured development account. Complete this checklist in **Light and
Dark**, then repeat the indicated stress checks. Record the client/build used.

- [ ] Create a Combo from diary entries, log it at a different scale and Meal
  Slot, edit it, and test Cancel/Back. Check resulting intake and template values.
- [ ] Save a food search as a note, edit its Capture Draft and convert it. Confirm
  the note contributes no intake until conversion and disappears afterward.
- [ ] Create/edit a Personal Food and a Recipe; enter trace/unknown nutrients,
  add a serving, choose an icon/photo and cancel the photo picker once.
- [ ] Import an online product, inspect provenance, save and log an amount.
  Scan an actual barcode; test denied camera permission and return to search.
- [ ] Log a One-off Entry, copy and move an entry, and cancel then confirm a
  deletion. Confirm the target date/meal and totals after each action.
- [ ] Parse text and a pasted label, review matches/figures, and cancel an
  estimate before saving. Nothing should be written before explicit acceptance.
- [ ] Check goal ordering, calendar selection, expanded nutrients, and a
  historical week with empty days or incomplete figures.
- [ ] With a cached app, disconnect the network, log a food, then reconnect.
  Pending changes should remain visible and synchronize once connectivity returns.
- [ ] Choose explicit Dark with a Light system setting, restart, and verify the
  choice persists. Select System and change the system appearance live. Visit
  all tabs, a chart, sign-in, a dialog and a keyboard.
- [ ] Repeat a long form, diary and Capture Draft in Dutch at Dynamic Type XL.
  Check safe areas, scrolling, keyboard dismissal and visible Save controls.
  Enable Reduce Motion and check native sheet/back gestures and goal ordering.

For an issue, report **screen/action, theme, language/text size, expected result,
observed result**, and preferably a screenshot or short recording. Final native
iOS acceptance remains open until that review. Nothing has been deployed or merged.
