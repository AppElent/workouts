# Hosted Workouts - Design

**Date:** 2026-06-30
**Status:** Approved (design); awaiting user review before implementation plan

## Problem

The app currently supports personal workout logging: a user creates a `workoutSession`, logs strength `sets`, and optionally logs WOD results. All of those records are owned by one `userId`.

In a gym setting, a coach or athlete also needs to host a shared workout: create the workout prescription once, share a QR/link, let others join or submit scores, and keep a group leaderboard. At the same time, signed-in participants should keep their own workout history and analytics. Guest participants should be able to submit to the group leaderboard without creating an account.

## Decisions

1. **Hosted workout as an event/template:** A hosted workout is a host-owned shared event, not a personal workout log.
2. **Participant logs stay personal:** Signed-in participants create normal `workoutSessions`, `sets`, and `wodResults` under their own `userId`.
3. **Host gets a group view:** The host sees submissions and leaderboard rows for the hosted workout, but other people's workouts are not copied into the host's personal history.
4. **Guests are allowed:** Guest submissions use a display name and live only on the hosted leaderboard.
5. **Host mode is explicit:** The host chooses `hostOnly` or `hostAndParticipate`.
6. **Status is host-controlled:** Hosted workouts move through `draft`, `open`, and `closed`. Closed workouts remain viewable but no longer accept new joins or submissions.
7. **Levels are snapshot-based:** Rx/L1/L2/L3 prescriptions live on the hosted workout's WOD snapshot. Base WOD definitions can provide defaults, but hosted events freeze the levels used that day.
8. **Leaderboard is combined:** Results are compared in one leaderboard by default, with each row badged as `Rx`, `L1`, `L2`, or `L3`.

## Non-goals

- Guest result claiming or account merging.
- Auto-calculating `% 1RM` target weights.
- Class rosters, attendance, recurring schedules, payments, or member management.
- Copying participant logs into the host's personal workout history.
- Rewriting historic hosted workouts when a reusable WOD definition changes.

## Data Model

### `hostedWorkouts`

Stores the shared event and frozen prescription.

```ts
hostedWorkouts:
  hostUserId: string
  title: string
  notes?: string
  scheduledAt?: number
  status: "draft" | "open" | "closed"
  joinToken: string
  hostParticipation: "hostOnly" | "hostAndParticipate"
  createdAt: number
  openedAt?: number
  closedAt?: number
  template: {
    strengthBlocks: Array<{
      blockId: string
      exerciseId?: Id<"exercises">
      exerciseName: string
      instructions?: string
      defaultSets?: number
      defaultReps?: number
      defaultWeight?: number
      unit?: "kg" | "lbs"
      percentageOfOneRepMax?: number
    }>
    wodBlocks: Array<{
      blockId: string
      wodId?: Id<"wods">
      name: string
      type: "forTime" | "amrap" | "emom" | "load"
      description?: string
      repScheme?: string
      timeCapSeconds?: number
      durationSeconds?: number
      levels: Array<{
        level: "rx" | "l1" | "l2" | "l3"
        label: string
        description?: string
        movements: Array<{
          name: string
          reps?: number
          weight?: number
          unit?: "kg" | "lbs"
          distance?: number
          distanceUnit?: "m" | "km" | "mi" | "cal"
          notes?: string
        }>
      }>
    }>
  }
```

Suggested indexes:

- `by_host` on `hostUserId`
- `by_status` on `status`
- `by_join_token` on `joinToken`

### `hostedWorkoutParticipants`

Links signed-in users to the hosted event and their personal session.

```ts
hostedWorkoutParticipants:
  hostedWorkoutId: Id<"hostedWorkouts">
  userId: string
  sessionId: Id<"workoutSessions">
  joinedAt: number
  displayName?: string
```

Suggested indexes:

- `by_hosted_workout` on `hostedWorkoutId`
- `by_user` on `userId`
- `by_hosted_workout_user` on `hostedWorkoutId`, `userId`
- `by_session` on `sessionId`

### `hostedWorkoutSubmissions`

Stores leaderboard rows for signed-in users and guests.

```ts
hostedWorkoutSubmissions:
  hostedWorkoutId: Id<"hostedWorkouts">
  participantId?: Id<"hostedWorkoutParticipants">
  guestName?: string
  wodBlockId: string
  level: "rx" | "l1" | "l2" | "l3"
  rxScaled?: "rx" | "scaled"
  timeSeconds?: number
  rounds?: number
  reps?: number
  timeCapped?: boolean
  load?: number
  loadUnit?: "kg" | "lbs"
  notes?: string
  submittedAt: number
```

Suggested indexes:

- `by_hosted_workout` on `hostedWorkoutId`
- `by_participant` on `participantId`
- `by_hosted_workout_wod` on `hostedWorkoutId`, `wodBlockId`

## Backend API

### `convex/hostedWorkouts.ts`

- `createDraft` - create a hosted workout from host-supplied template fields.
- `listMine` - list hosted workouts owned by the signed-in host.
- `getMine` - host-only detail query with participants and submissions.
- `getByJoinToken` - public join page query; only returns shareable prescription and status.
- `updateDraft` - edit draft content before opening.
- `open` - change `draft` to `open` and expose the QR/link.
- `close` - change `open` to `closed`.
- `remove` - host-only deletion; deletes participants and submissions for that hosted workout.

### `convex/hostedWorkoutParticipants.ts`

- `join` - signed-in user joins an open hosted workout by token. Creates a personal `workoutSession` and links it to the hosted workout.
- `getMyParticipant` - return the signed-in user's participant record for a hosted workout.
- `listForHost` - host-only participant list.

The `join` mutation should be idempotent for a signed-in user. If the user has already joined, it returns the existing `sessionId`.

The participant's personal `workoutSession` does not need to duplicate the hosted template. The session page can discover hosted context through `hostedWorkoutParticipants.by_session`, then render planned strength and WOD blocks from the immutable hosted workout template.

### `convex/hostedWorkoutSubmissions.ts`

- `submitForParticipant` - signed-in participant submits a hosted WOD result. It also creates the normal personal `wodResults` row linked to their session.
- `submitGuest` - guest submits a display name and result to the hosted leaderboard only.
- `listForHost` - host-only submissions.
- `listPublicLeaderboard` - public leaderboard for an open or closed hosted workout.
- `remove` - host-only moderation delete.

## Frontend UX

### Host Flow

1. Host chooses a new "Host Workout" action.
2. Host builds a workout from planned strength blocks and one or more WOD blocks.
3. Strength blocks can be instruction-only or include default sets/reps/weight or `% 1RM` guidance.
4. WOD blocks include frozen level prescriptions for `Rx`, `L1`, `L2`, and `L3`.
5. Host saves the workout as a draft.
6. Host opens the workout to enable the QR/link.
7. Host dashboard shows QR/link, status controls, prescription, participants, submissions, and leaderboard.
8. Host closes the workout after the event.

### Participant Flow

1. Participant scans QR and lands on `/join/$token`.
2. If the workout is open, they see the prescription and choose signed-in participation or guest submission.
3. Signed-in participants join the workout and get a personal `workoutSession` seeded from the template.
4. They log their own sets and WOD results normally.
5. Their hosted WOD submission appears on the shared leaderboard.
6. Guests enter a display name and submit WOD scores directly to the leaderboard.

### Closed State

Closed hosted workouts remain viewable through the host dashboard and public link, but joining and submitting are disabled. The UI should clearly say the workout is closed.

## Personal Session Seeding

When a signed-in user joins, the app creates a normal `workoutSession` named after the hosted workout.

For strength blocks:

- If the block is instruction-only, the participant session shows the exercise section as planned work with no completed sets.
- If the block includes default sets/reps/weight, the participant session shows planned rows from the hosted template. The app does not insert `sets` records until the participant confirms, edits, or explicitly logs a row.
- `% 1RM` is displayed as prescription guidance. It is not converted into an automatic load in v1.

For WOD blocks:

- The hosted event keeps the frozen level prescriptions.
- When a signed-in participant logs a WOD result, the app creates their normal `wodResults` row and a hosted leaderboard submission.

## Scoring and Leaderboard

Use the existing WOD score fields and comparison semantics where possible:

- For Time: faster finished scores rank higher than capped scores; capped scores can use reps as a tiebreaker.
- AMRAP: more rounds/reps is better.
- EMOM: more completed reps is better.
- Load: heavier normalized load is better.

The hosted leaderboard shows one combined list. Each row displays the participant name, level badge, score, and submitted time. The level badge does not split the default ranking in v1.

## Access Rules

- Only the host can edit, open, close, or delete a hosted workout.
- `getByJoinToken` exposes only shareable workout data, status, and public leaderboard data.
- Signed-in participants can only create or access their own linked personal session.
- Guest submissions require an open hosted workout and a non-empty display name.
- Closed hosted workouts reject new joins and submissions.
- Signed-in hosted submissions must belong to the authenticated participant.

## Routes and Components

Routes:

- `/hosted-workouts` - host list.
- `/hosted-workouts/new` - create draft.
- `/hosted-workouts/$id` - host dashboard.
- `/join/$token` - public QR join page.

Components:

- `HostedWorkoutBuilder`
- `StrengthBlockEditor`
- `HostedWodBlockEditor`
- `LevelPrescriptionEditor`
- `HostedWorkoutQr`
- `HostedWorkoutDashboard`
- `HostedLeaderboard`
- `JoinHostedWorkout`
- `GuestSubmissionForm`

## Testing

- Pure tests for hosted WOD score formatting/ranking helpers.
- Pure tests for converting a hosted workout template into participant session seed data.
- Backend tests for access rules:
  - host can manage their workout
  - non-host cannot manage it
  - signed-in user can join an open workout
  - duplicate join returns the same session
  - closed workout rejects joins and submissions
  - guest submission creates no personal session/result
  - signed-in submission creates both a personal WOD result and hosted submission
- UI smoke tests for open, closed, signed-in, and guest join states where practical.

## Implementation Choices

- Planned strength work is rendered from the hosted workout template by looking up the participant record for the current `sessionId`. Planned rows are visual prompts, not `sets` records.
- QR generation should use a small client-side React dependency such as `qrcode.react`, with the raw share URL shown next to it for copy/paste fallback.
- Public guest submission should validate display name length, score ranges, WOD block ids, and level ids. Host-side moderation delete is included in v1; stronger rate limiting can be added later if abuse appears.

