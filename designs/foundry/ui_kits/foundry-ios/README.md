# Foundry iOS — UI kit

A click-through recreation of the Foundry phone app (`apps/mobile` in
`AppElent/workouts`), built from the real screen source rather than
screenshots. Everything visual comes from this design system's tokens and
components; only the data is fake.

## What is in it

| File | Source it recreates |
| --- | --- |
| `App.jsx` | `app/(app)/_layout.tsx` + `app/(app)/(coach)/_layout.tsx` — native tabs, pushed stack, rest-timer and confirm providers |
| `HomeScreen.jsx` | `src/screens/home.tsx` |
| `TrainScreen.jsx` | `src/screens/train.tsx` |
| `SessionScreen.jsx` | `src/screens/strength-session.tsx` (+ set-edit and plate sheets) |
| `NutritionScreen.jsx` | `src/screens/nutrition-day.tsx` |
| `ProgressScreen.jsx` | `src/screens/progress.tsx` |
| `ProfileScreen.jsx` | `src/screens/profile.tsx` |
| `PushedScreens.jsx` | `exercises-list.tsx`, `start-activity.tsx`, `language.tsx`, `summary.tsx` |
| `data.js` | Fake routines, exercises, sets and a day's diary |

## Themes

The shell follows `prefers-color-scheme` like the app. The pill top-left forces
light or dark, and Profile → Appearance has the same switch as a System /
Light / Dark segmented control.

## Interactions that work

- Five tabs; each tab root gets a large-title glass header.
- Home → Start activity → Strength → a running session; Home then shows the
  in-progress card and the tab bar grows the resume accessory.
- Session: pick a set type, step weight/reps, **Log set** appends a row and
  starts the rest timer (a warmup does not). Tap a logged row for the set-edit
  sheet; the "Plates" chip opens the plate calculator. **Cancel workout** and
  **Finish** both go through the real destinations.
- Train: routine rows reveal Edit/Delete on tap (standing in for the swipe);
  Delete asks first.
- Nutrition: the date control opens the month calendar; meal rows reveal their
  actions; goal card shows the energy remainder and macro rows.
- Exercises: search and filter chips compose; a user-created exercise can be
  deleted (and the confirm shows the failure toast for a default one).
- The small pill top-right toggles the offline banner; top-left switches theme.
- Home, Train's library and Profile use the `InsetList` grouped-list pattern
  and the 16:9 `HeroCard` photo slot (currently rendering its no-image state).

## Deliberately absent

Hosted workouts, WOD library/editor, body metrics, barcode scanner, combos,
cooking/assistance and the food browser exist in the app but are not recreated
here — they are listed in the repo's screen inventory and would each need their
own read. Nothing here invents a screen the app does not have.
