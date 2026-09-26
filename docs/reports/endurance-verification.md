# Running and cycling verification — 25 September 2026

Tested the development build of Foundry on **iPhone 18 Pro, iOS 27.0** (simulator `941BA398-B49E-45EA-9506-777215DD90CB`), using the development Convex deployment `colorless-sturgeon-704` and the configured test account. The app was served from the workouts workspace on a localhost-only Metro server. The initial unsigned simulator build could not initialize Clerk Keychain; an Xcode ad hoc signed build launched successfully. No production data was used.

## Live simulator results

| Flow | Result |
| --- | --- |
| Authenticated Home | Loaded after the activity-query render loop was fixed. Run and ride shortcuts opened their respective editors. |
| Run | Selected 24 September in the native Dutch date picker; saved 5.2 km in 30 minutes. Detail showed **5:46/km**. Edited the title to `QA run 2026-09-25`; the detail and Home recent row reflected the update. |
| Ride | Saved 20 km in one hour. Detail showed **20 km/h**. |
| Home and history | Home showed two weekly activities and 1:30:00 total duration. All history placed ride and run ahead of older strength sessions. Running and Cycling filters each showed only the matching QA activity. |
| Progress | Running showed one activity, 5.2 km, 30:00, 5:46/km; Cycling showed one activity, 20 km, 1:00:00, 20 km/h. Weekly distance and duration charts rendered for both. |
| Delete and cleanup | Deleted both QA activities through the confirmation dialog. After the translation fix, the Dutch cancel action read **Activiteit behouden**. History then showed only the preexisting strength records. |

Visual evidence is in `/private/tmp/workouts-endurance/`: `run-editor-date.png`, `run-detail-edited.png`, `ride-detail.png`, `home-with-activities.png`, `history-all.png`, `progress-running.png`, `progress-cycling.png`, and `history-after-cleanup.png`. These screenshots contain no sign-in credentials.

## Automated checks and limits

The main task's checks reported 451 passing mobile tests across 66 suites, passing repository and mobile typechecks, Biome, diff check, web build, and Android JavaScript/Hermes export. Root Vitest reported 356 passing tests and one existing `env.manifest` expectation mismatch (`/foundry` versus `/workouts`). Development Convex CRUD, idempotency, nutrition marker, and cleanup checks passed separately.

Device interaction was limited to the iPhone 18 Pro simulator in Dutch. An Android emulator and physical iPhone were unavailable; exhaustive light/dark appearance, Dynamic Type XL, and accessibility testing were not run. The native tab bar minimized to its selected icon after a downward scroll, matching the existing `minimizeBehavior="onScrollDown"` configuration.
