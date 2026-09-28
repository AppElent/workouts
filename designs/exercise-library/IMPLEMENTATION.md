# Native exercise library

## Screen contract

- **Library:** Find an exercise, open its detail, or add a personal movement. It is pushed from Train. The native back button returns to Train; Add and the visual layout picker are on the right. A native large title collapses with the virtualized list. List and Muscle groups share search, Personal scope, and filters; layout is remembered on this device.
- **Filters:** A dismissible sheet stages muscle-group and equipment multi-selection and movement category. OR within each selection, AND across categories/search/scope. Apply commits, Cancel/swipe dismissal discards, Reset changes only the draft. The apply button previews the result count.
- **Add:** A native form sheet uses the shared grouped form controls, with expandable muscle choices, optional additional muscle names, native equipment picker, weight-step validation, and plain-text Cancel/Save toolbar actions and a native grabber. It opens at 75% height and expands to full height for keyboard entry. The root scroll view delegates keyboard and sheet gestures to UIKit. Cancel returns without creating. A successful save returns to Personal with the created name searched so existing filters cannot hide it. Failure keeps the draft and surfaces an error toast.
- **Detail:** Overview, Progress, and History retain real queries, records, charts, and sets. Personal exercises have an Edit/Delete dots menu; Delete requires confirmation. Default exercises have Clone in their long-press menu and detail dots menu. Edit prefills the same sheet and patches the owned record in place; Clone prefills a new draft and preserves muscle order, settings, notes and instructions. The established swipe/context-menu component provides row actions as well.
- **States:** Bundled exercises remain available while personal data loads. Skeletons cover unresolved data, a clearable empty search state handles no matches, and route errors provide Retry. Names wrap; system text scaling is enabled. All new library/filter/add copy has English and Dutch translations.

## Verification — 2026-09-28

Verified in the local iOS 27 simulator at 402 × 874 points, using this worktree on Metro port 8083 and the installed Foundry development client:

- Train → library → detail → back; large → compact native header on scroll.
- Add and custom visual popover on the right; native Back on the left.
- Both layouts, including the saved layout after leaving/relaunching.
- Multiple muscle groups and equipment: Chest + Back and Barbell + Dumbbell yielded 148 results. Reset then Cancel retained the applied four selections and count.
- Search with no matches, clear action, and keyboard entry/dismissal.
- Overview, Progress, History using existing test-account records.
- Created “Library QA exercise”, returned to its Personal result, then deleted it through the confirmation flow. No test exercise remains.
- Dutch/light and English/dark presentation; XL Dynamic Type (one step above default), inspected after relaunch.
- Disabled empty-name save, keyboard-safe top Save action; automated tests cover pending/duplicate prevention, validation, error toast, draft retention and successful callback.

Evidence is in `verification/`. The recording covers native title collapse, layout switching, and multi-select application. Screenshots capture the final library/menu plus filter and keyboard states. Expo's floating development control is visible in some captures.

Checks: `pnpm check`, mobile TypeScript, mobile Jest (including filter composition and form mutation tests), and `git diff --check`.

Android could not be run: the local Android SDK is missing command-line tools. A physical iPhone was not available; simulator verification does not replace that release check. No dependencies, backend schema, or native build configuration changed. The owner-checked update mutation and optional instructions on create were pushed to the existing development deployment.


## Follow-up verification

- Search focus/dismissal preserves the expanded title: RN keyboard adjustment no longer clamps UIKit's negative large-title offset. Short-content tab switches keep their minimum content height; embedded SwiftUI hosts leave safe areas to their React Native parents.
- The compact sheet was scrolled through expanded muscle choices and back without dismissal. Keyboard focus expands the sheet and dismissal returns it to the smaller detent. Cancel/Save stay at the top.
- Personal and default rows share the same horizontal layout. Personal rows reveal Edit/Delete on swipe. Default rows consume horizontal drags without moving, activating the row, or playing swipe feedback; long-press opens Clone. Automated coverage checks iOS menu haptic dispatch and menu-only swipe feedback; tactile output still needs a physical device.
- Cloned Barbell Bench Press from its long-press action, verified copied instructions and empty history, edited its notes using the dots menu, saved with the keyboard open and verified the updated detail. Deleted only that QA copy using the confirmed Delete menu action; the user's personal exercise remains.
- Final checks: 462 mobile tests (70 suites), 8 backend exercise/migration tests, mobile/root TypeScript, Biome and diff whitespace check passed. Backend tests cover authentication, ownership, shipped/default immutability, optional-field clearing and retained set references.
- Updated screenshots are `verification/compact-sheet.png`, `verification/personal-row.png`, `verification/exercise-actions.png`. The follow-up motion recording is `verification/edit-clone.mp4`.
