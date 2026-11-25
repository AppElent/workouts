---
type: decision
description: Read before showing, changing, or reviving Hosted Workouts, or before removing their code, Convex functions, or tables.
version: 1.1.1
status: accepted
date: 2026-11-20
---

# Park Hosted Workouts behind one client switch and keep their code

Eric stopped Hosted Workouts on 20 Nov 2026 (APP-437): people can no longer host
or join them on the web or in the phone app. The feature may come back, and
installed phone builds older than the parking OTA still call its Convex
functions, so deleting it would break those builds and lose the design.

We park it instead. `HOSTED_WORKOUTS_ENABLED` in
[`packages/core/src/features.ts`](../../packages/core/src/features.ts) is
`false`. Both clients read it; there is no environment variable or remote flag.
While it is off:

- **Web:** the Host Workout nav item is gone. `/hosted-workouts`,
  `/hosted-workouts/new`, `/hosted-workouts/$id`, `/hosted-workouts/edit/$id`,
  and `/join/$token` render `HostedWorkoutsPaused`, a short paused state linking
  to the dashboard (signed in) or the landing page. A session that came from a
  Hosted Workout renders as a normal session: the hosted plan and hosted score
  form are skipped, and the normal WOD list shows.
- **Phone:** the Hosted workouts row is gone from Training. `hosted`,
  `hosted/[id]`, and `join/[token]` render `HostedPausedScreen`. Join links
  (universal links and the app scheme) still route to `join/[token]` through
  `+native-intent.tsx`, so they land on the paused screen; a join remembered
  across sign-in is dropped there. The strength session hides the hosted
  panel. Only JavaScript changed, so this ships as an OTA update; the
  associated domains and the `apple-app-site-association` file still claim
  `/join/*`.
- **Backend:** parking changes no Convex function or schema. Account deletion
  handles hosted data as `profile.md` describes (APP-408), finding a
  participant's scores through `hostedWorkoutSubmissions.by_participant`.
- **Data:** Eric chose on 20 Nov 2026 to wipe every existing Hosted Workout,
  Participant, and Submission (APP-452). The internal mutation
  `hostedWorkouts.wipeAll` does it in bounded, self-scheduling batches; a
  dry run (`{"dryRun": true}`) only counts. It ends participants' running
  sessions the way deleting a workout does, and everyone keeps their own
  sessions, WODs, and WOD Results. Wiped on production on: _pending, filled
  in after the run_; the counts before and after are on APP-452. This
  cannot be undone.
- **Code and tests:** all hosted components, screens, Convex functions, and
  their tests stay and keep running. The feature manifest still lists the
  hosted routes because the route files remain.

Evidence: [screenshots and checks](../records/2026-11-20-park-hosted-workouts/README.md).

## What Hosted Workouts are

A host builds a workout for a group (for example a class) and shares a link.
Ownership follows [ADR 0008](0008-hosted-workout-ownership.md): the Hosted
Workout is a host-owned shared event with a frozen prescription, participant
list, and leaderboard; each participant's training stays in their own history.

- **Roles.** The *host* creates, opens, closes, and deletes the workout and can
  remove leaderboard rows; they can also take part (`hostAndParticipate`). A
  *Participant* is signed in, joins, and gets their own Strength Session. A
  *guest* has no account and only adds leaderboard scores from a browser.
- **Lifecycle.** `draft` (editable, invisible to the link) → `open` (joinable,
  scorable) → `closed` (read-only leaderboard). Closing or deleting ends every
  participant session still running, so nobody stays locked out of a new one.
- **Template.** Strength blocks (an Exercise with prescribed sets) and WOD
  blocks. The template is frozen into the workout, so later edits to the
  Exercise or WOD never rewrite what was prescribed.
- **Levels.** Every WOD block has four scaling levels, `rx`, `l1`, `l2`, `l3`,
  each with an optional host label (`HOSTED_LEVEL_LABELS` and
  `hostedLevelLabel` in `packages/core/src/wodScore.ts`). Authoring all four is
  desk work, so building is web-only (feature `hosted-workout-authoring`).
- **Join token and link.** An 18-character random token from an alphabet
  without look-alike characters, unique per workout:
  `https://foundry.appelent.nl/join/<token>`. The web also shows it as a QR
  code. The phone accepts the link or the bare code (`join-link.ts`).
- **Scoring and leaderboard.** One Submission per participant per WOD block,
  and one per guest name per guest key per block; re-submitting corrects the
  score. A Participant's Submission also records a WOD Result in their own
  history. The public leaderboard (`getByJoinToken`) hides exercise and WOD ids
  and shows only opened workouts.
- **Guest claim.** A guest who later signs in on the same browser can claim the
  scores under one name: they join, and each score becomes their own
  Submission and WOD Result, dated at the original submit. The guest key never
  leaves the server (ADR 0008).
- **Deletion.** The host deleting a workout removes its Participants and
  Submissions; participants keep their own sessions and WOD Results. Removing a
  leaderboard row keeps the athlete's WOD Result. Deleting an account deletes
  every workout it hosts the same way, guests' scores included, and removes
  its participation and scores from other hosts' workouts; see
  [`profile.md`](../contracts/profile.md).

## Where the code lives

| Area | Files |
| --- | --- |
| Switch | `packages/core/src/features.ts` (`HOSTED_WORKOUTS_ENABLED`, features `hosted-workout-join`, `hosted-workout-hosting`, `hosted-workout-authoring`) |
| Shared logic | `packages/core/src/wodScore.ts` (levels, score formatting) |
| Web routes | `src/routes/_app/_authed/hosted-workouts/*`, `src/routes/_app/join/$token.tsx` |
| Web components | `src/components/hosted/*` (builder, dashboard, QR, join page, guest form, guest key, paused state), `src/components/session/HostedSessionPlan.tsx`, the hosted branch in `src/routes/_app/_authed/log/$sessionId.tsx` |
| Web nav and copy | `src/components/navItems.ts`, `src/lib/i18n/messages/{en,nl}/hosted.ts` |
| Phone routes | `apps/mobile/app/(app)/hosted.tsx`, `hosted/[id].tsx`, `join/[token].tsx`, `app/+native-intent.tsx`, the pending join in `app/(app)/_layout.tsx` and `app/(auth)/_layout.tsx` |
| Phone screens | `apps/mobile/src/features/training/hosted/*`, `apps/mobile/src/features/strength-session/components/hosted-session-panel.tsx`, the Training row in `features/training/train/training-screen.tsx` |
| Phone link claim | `apps/mobile/app.config.ts` (associated domains), `public/.well-known/apple-app-site-association` |
| Convex | `convex/hostedWorkouts.ts` (with the `wipeAll` wipe), `convex/hostedWorkoutParticipants.ts`, `convex/hostedWorkoutSubmissions.ts`, `convex/lib/hosted.ts`, tables in `convex/schema.ts`, account deletion in `convex/lib/hosted.ts` (`deleteHostedWorkoutData`) and `convex/account.ts` |
| Tests | `convex/hostedWorkouts.test.ts`, `convex/hostedWorkouts.wipe.test.ts`, `convex/hostedWorkoutSubmissions.test.ts`, `convex/account.hostedWorkouts.test.ts`, `src/lib/auth/__tests__/joinRedirect.test.tsx`, `apps/mobile/src/features/training/hosted/*.test.ts(x)`; the switch: `src/components/hosted/HostedWorkoutsPaused.test.tsx`, `apps/mobile/src/features/training/hosted/hosted-paused.test.tsx`, `apps/mobile/src/features/training/train/training-screen.test.tsx` |

## Turning it back on

The feature comes back with empty hosted tables: nothing from before the
APP-452 wipe returns.

1. Set `HOSTED_WORKOUTS_ENABLED` to `true` in `packages/core/src/features.ts`.
2. Update the switch tests to expect the feature (the three files in the
   Tests row above) and run `pnpm verify`.
3. Re-check universal links on an installed preview build: open
   `https://foundry.appelent.nl/join/<token>` from Notes or Messages and
   confirm it opens the join screen, and that the AASA file is still served.
4. Re-run the phone acceptance and Maestro flows (`pnpm --filter
   @foundry/mobile test:e2e`) and walk host, join, score, guest claim, close,
   and delete on the web and the phone.
5. Ship the web deploy and the daily OTA together; supersede this ADR.

## Consequences

- One constant flips the feature on both clients without a store build.
- The parked code keeps costing upkeep: its tests run, and dependency or schema
  changes must keep it compiling.
- Existing hosted rows are wiped (APP-452), so reviving the feature starts
  with empty tables. Rows that installed builds older than the parking OTA
  create after the wipe stay until another `wipeAll` run removes them, or
  until account deletion removes a host's workouts and a participant's rows.

## Rejected

- **Delete the code and tables:** breaks installed builds that still call the
  functions and loses the design.
- **Remote or environment flag:** more moving parts than a parked feature
  needs; a code change is an acceptable cost to bring it back.
- **Gate in Convex:** installed builds would show errors instead of a calm
  paused state, and account deletion still needs the functions.
