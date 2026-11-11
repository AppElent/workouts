---
type: decision
description: Read before deciding which platform a feature ships on, adding or moving a web or mobile route, or changing shared links.
version: 1.0.0
status: accepted
date: 2026-11-11
---

# Lead with mobile for training and use the web for sharing and integration

Foundry runs on two clients: the Expo app (`apps/mobile/`) and the TanStack Start
web app (`src/`). Until now nothing stated which features belong where. Each
platform grew its own set, and gaps in sign-in, deletion, and shared links went
unnoticed. This record applies the platform-parity standard
([developer-tools#63](https://github.com/AppElent/developer-tools/pull/63)) to
Foundry. `packages/core/src/features.ts` lists every feature, and a Vitest test
fails when a route is not listed there.

**Mobile leads.** The phone is where you train and track: strength sessions,
runs and rides, WODs, nutrition, Personal Measures, body metrics, and progress.
New features land on mobile by default.

**The web is for sharing and integration.** It hosts Hosted Workouts (create,
edit, run, and the join link), the MCP server and its OAuth discovery, and the
sign-in floor. The training screens the web already has (dashboard, logging,
routines, WODs, exercises, progress) stay, but they are not where new training
features land.

**Floor.** Both platforms must have sign-in, sign-up, and password reset; account
and profile editing; account deletion; data export; language; theme; the privacy
page; and links that open on either platform. Export and deletion cover every
personal table on both platforms, including nutrition and Personal Measures,
even though the web does not show them. Foundry does not reduce the floor. The
gaps open today are `pending-port` entries with follow-up issues:

- Web account deletion: #200.
- Mobile password reset and password change: #201.
- Web theme choice (the web is dark only): #205. Closing it as "dark only"
  means reducing the floor in this record first.

**Share target.** The Hosted Workout join link `https://foundry.appelent.nl/join/<token>`
is the share target. People who receive it often do not have the app and open it
in their phone's browser. So the web join page must be fully usable at phone
width, including joining and logging the workout, as a guest or after sign-in.
Two web bugs break that today: the token is lost through sign-in (#203), and
guests with the same name overwrite each other's scores (#204).

**Exclusive by design.** The following stay on one platform:

- **Mobile:** nutrition (Diary, Goals, food library, Combos, photos, AI
  assistance), Personal Measures, runs and rides, first-run setup, and the local
  database tools. They follow from the phone goal.
- **Web:** Hosted Workout authoring, because every WOD needs four scaling levels,
  which is desk work before a class. Also the MCP server, which follows from the
  integration goal, and the public landing page.

Editing and deleting WODs, WOD Results, and exercises is mobile-only today. The
web keeps the create forms it already has.

**Web layout.** Every web page is `responsive`. No page is declared
`large-screen`.

**One web client.** Expo web is removed: `react-native-web`, the `web` script,
and the app config's `web` block. To reuse a web component in the app, use Expo
DOM components.

**Universal links: not yet.** The app has no screen that takes a join token from
a route. The Hosted screen's code box keeps the token in local state. A
`+native-intent.tsx` rewrite would land on nothing, and a claimed path that opens
the not-found screen is worse than the browser. So Foundry ships no
`apple-app-site-association`, no `associatedDomains`, and no Android
`intentFilters` for now. The plan is in #202: add a mobile join route, rewrite
`/join/<token>` to it, then publish the AASA file (`/join/*` for
`<TEAMID>.com.appelent.foundry`) and `assetlinks.json` on `foundry.appelent.nl`,
and ship a new native build. Workers static assets are served before the
`/.well-known/$` route that serves the MCP OAuth metadata, so the files in
`public/.well-known/` take precedence.

## Consequences

- Every new route needs a `features.ts` entry, or CI fails. The issue for a new
  feature states its platforms.
- A new mobile training or nutrition feature does not need a web port. A floor
  or share-target change needs both platforms or a `pending-port` issue.
- Hosted Workout create and edit stay web-only, as the hosted-list screen already
  documents. Signed-in participants record personal history per
  [ADR 0008](0008-hosted-workout-ownership.md). That does not change.
- `pnpm --filter @foundry/mobile web` no longer exists.

## Rejected

- **Web parity for every training screen:** doubles every training change for a
  platform that is not where people train.
- **Claiming `/join/*` now:** the app cannot open it yet; see #202.

## Reopen when

- The web becomes a place where people train, for example a coach or class view.
- Universal links ship (#202): update the scope above.
- A floor gap is closed as "won't do" (for example #205): record the reduced floor
  here.
