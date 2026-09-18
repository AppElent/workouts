repo: AppElent/workouts
branch: main
path: apps/mobile

## Last sync

date: 2026-09-17T07:35:00Z

### Updated in this project

- Built the token layer from `apps/mobile/src/theme/tokens.ts` (lime-on-warm-black, dark only).
- Authored 35 components mirroring `apps/mobile/src/ui/*` and the `form.tsx` seam.
- Recreated seven phone screens as the Foundry iOS UI kit.
- Imported the muscle-group illustrations from `public/muscle-icons/`.

## Screen map

| Project screen | Repo files |
| --- | --- |
| ui_kits/foundry-ios/App.jsx | apps/mobile/app/(app)/_layout.tsx, apps/mobile/app/(app)/(coach)/_layout.tsx, apps/mobile/src/ui/coach-tab-stack.tsx, apps/mobile/src/ui/active-session-bar.tsx |
| ui_kits/foundry-ios/HomeScreen.jsx | apps/mobile/src/screens/home.tsx |
| ui_kits/foundry-ios/TrainScreen.jsx | apps/mobile/src/screens/train.tsx |
| ui_kits/foundry-ios/SessionScreen.jsx | apps/mobile/src/screens/strength-session.tsx, apps/mobile/src/ui/set-editor-content.tsx, apps/mobile/src/ui/plate-sheet-content.tsx, apps/mobile/src/ui/rest-timer.tsx |
| ui_kits/foundry-ios/NutritionScreen.jsx | apps/mobile/src/screens/nutrition-day.tsx, apps/mobile/src/ui/nutrition-calendar.tsx, apps/mobile/src/ui/date-stepper.tsx |
| ui_kits/foundry-ios/ProgressScreen.jsx | apps/mobile/src/screens/progress.tsx, apps/mobile/src/ui/chart.tsx |
| ui_kits/foundry-ios/ProfileScreen.jsx | apps/mobile/src/screens/profile.tsx |
| ui_kits/foundry-ios/PushedScreens.jsx | apps/mobile/src/screens/exercises-list.tsx, apps/mobile/src/screens/start-activity.tsx, apps/mobile/src/screens/language.tsx, apps/mobile/src/screens/summary.tsx |
| components/* | apps/mobile/src/ui/*.tsx, apps/mobile/src/theme/tokens.ts |
| tokens/* | apps/mobile/src/theme/tokens.ts, apps/mobile/DESIGN_SYSTEM.md |
