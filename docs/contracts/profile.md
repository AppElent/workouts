---
type: contract
description: Read when changing Profile, settings, account actions, or sign-out.
version: 2.3.0
status: current
---

# Profile

A person sees their identity and all-time totals and reaches every setting in one
tap. Study: [profile](../../designs/app/profile_final.html).

## Behavior

- **Settings one tap deep.** Preferences and Nutrition are `FormSection`s on
  Profile; no pushed screen with a single row. Appearance, language, nutrition
  destinations, Feedback, and sign-out stay reachable; development builds add
  the SQLite browser.
- **Icon tiles.** On iOS, a settings row may carry a 30-pt continuous-corner tile
  with a white SF Symbol on an iOS system tint, via `DisclosureRow`'s `icon`. Each
  tint uses the system colour for the current scheme (`tile*` tokens), so dark
  mode gets the dark variant. On Android the same row shows the plain Material
  symbol in `textMuted` with no tile, following Material settings lists. The only
  exception to the single lime accent.
- **Account.** The account row (Clerk name, email, photo) opens Account with
  sign-in details, export, and deletion. Deletion names what is removed and points
  to export first.
  - *Details.* First and last name and the photo are edited through Clerk; email
    addresses and sign-in methods are read-only.
  - *Change password.* A row for accounts with a password only, opening its own
    screen: the read-only email as the username, then current and new password,
    the shape iOS AutoFill needs. Clerk changes it and signs out the account's
    other sessions; its error shows on the field it concerns. Accounts that sign
    in only with a social provider or an emailed code see no row.
  - *Manage your AppElent account.* A row (web: a link in a new tab;
    phone: the in-app browser) opens the AppElent account
    portal at `ACCOUNT_PORTAL_URL` (`packages/core`) for sign-in methods,
    devices, two-step verification, and each app's data. Every account screen
    here stays ([APP-666](https://linear.app/appelent/issue/APP-666)).
  - *Export.* An online JSON file of every personal table, shared through the
    system share sheet. Receipts and counters are omitted; Food photo files are
    not included.
  - *Account portal.* `convex/accountPortal.ts` serves the AppElent account
    portal (developer-home `standards/account-portal.md`, contract 1):
    `summary` counts each exported table (capped at 1,000), `deletionBlocker`
    wraps the one above, and `exportPage` pages the same export. Foundry
    tracks no latest write, so `lastActiveAt` is `null`. `deleteAppData`
    follows [APP-392](https://linear.app/appelent/issue/APP-392).
  - *Shared login.* Gather, Foundry, Fairway and Arcade Club share one
    AppElent (Clerk) login, so deletion offers two choices, Foundry data only
    first ([APP-392](https://linear.app/appelent/issue/APP-392)).
  - *Delete Foundry data only.* After one destructive confirmation, deletes all
    personal training and nutrition records, goal preferences, and uploaded Food
    photos in resumable server batches, clears this device's account state, and
    signs out this device. The AppElent login stays: no Clerk deletion and no
    Apple revocation. On iOS the sign-in screen then confirms the deletion and
    says the login still works in the other apps; a signed-in toast would
    unmount with the session. Foundry keeps no profile row, so signing in again starts with an
    empty account. Device preferences remain. Blocked offline and during a
    running Activity.
  - *Hosted Workouts.* Deletion takes them along instead of blocking
    ([APP-408](https://linear.app/appelent/issue/APP-408)). A Hosted Workout
    the account hosts is deleted whole: its participants and every
    submission, guests' included, leave with it, and participants' running
    sessions end as when the host removes it. In other hosts' events the
    account's participation and its scores are deleted, so it leaves their
    leaderboards. Its scores are found through the participant
    (`hostedWorkoutSubmissions.by_participant`); every signed-in submission
    carries the participant together with the account's WOD and WOD result.
    Other athletes keep their own sessions, WODs and WOD results; a session
    whose event is gone opens as an ordinary session. The deletion
    copy names both. `deletionBlocker` no longer returns `hostedWorkout`; the
    code stays in the validator for installed apps. Test-data reset still
    refuses Hosted Workout involvement.
  - *Delete my whole AppElent account.* Names the other apps whose data goes
    too. The same deletion, then Clerk's self-deletion, which signs out; on
    iOS the sign-in screen confirms that the login is gone. Unavailable when the Clerk instance disables self-deletion.
    Before anything is deleted, the phone checks that the sign-in is younger
    than half of Clerk's reverification window (5 of 10 minutes), again after
    Apple's sheet. Clerk's verify dialog is web-only, so an old sign-in stops
    there with **Sign in again**, which signs out; the sign-in screen then says
    to come back and delete again. If Clerk still refuses after the data is
    gone, the person is told to sign in again and repeat
    ([APP-243](https://linear.app/appelent/issue/APP-243)).
  - *Second factor and the sign-in check.* The phone and the web ask Clerk's
    own check (`checkAuthorization`, level `second_factor`, 5 minutes) about
    the live session's factor ages (minutes since the first and the second
    factor; -1 when the session verified none). A session that verified no
    second factor is judged by its first factor, also when the account has a
    second factor; a Google or Apple sign-in that Clerk lets through without
    one would look like that (expected, not tested: no throwaway Google or
    Apple identity). On dev Clerk (21 Nov 2026, Frontend API calls as
    clerk-js 6.42.1 sends them, API 2026-08-20, two-step by authenticator
    app), `user.delete()` succeeded at `[0, -1]` and also at `[11, 11]`,
    past Clerk's 10-minute window: dev refused nothing. So on dev the check
    before the data goes is the stricter side. Production and the native
    client were not tested, so the "sign in again to finish" handling stays.
    Data first, account last still leaves the data gone and the account in
    place when `user.delete()` fails for another reason (offline, a Clerk
    error); whether to change that order is open
    ([APP-528](https://linear.app/appelent/issue/APP-528)).
  - *Apple after deletion.* The confirmation after Delete account (phone
    sign-in screen, web start) says whether Foundry still uses Sign in with
    Apple: stopped, or, when revoking failed or was impossible (Android, an
    origin Apple doesn't know), how to stop it at account.apple.com.
  - *Login deleted elsewhere.* When the AppElent login is deleted from another
    app or the Clerk dashboard, Clerk's signed `user.deleted` webhook
    (`POST /clerk/webhook`) runs the same purge on the server, in batches,
    without the running-Activity blocker, Hosted Workouts included.
  - *Web.* The web Profile page offers both deletions with the same
    confirmations and blockers. Web keeps no account data outside Convex
    queries, so neither deletion needs a local reset. Delete Foundry data only
    leaves the signed-in pages, signs out the confirming session, and confirms
    on the signed-out start; Delete my whole AppElent account ends on the
    signed-out start with a full page load. Before Delete account deletes
    anything, Clerk asks the person to confirm their sign-in when it is older
    than half of Clerk's reverification window (5 of 10 minutes), so a stale
    session does not delete the data and keep the account, and the window
    does not lapse while the data is deleted. If Clerk still refuses the
    account after the data is gone, the person is asked to choose Delete
    account again and confirm their sign-in, which resumes safely. Apple's
    grant is revoked before the data is deleted, so if deleting then fails,
    the account stays without it and a retry asks for Apple's popup again.
    The sign-in is checked again after Apple's step, because that step can
    outlast the window.
- **Summary.** None until lifetime totals exist. Profile shows no placeholder
  figures, dashes, or "coming soon" row in its place.
- **Sign out.** A red row in its own bottom section, always confirmed. The
  confirmation states the real pending and device-local state, with a count and
  "Toch uitloggen" when changes are waiting. Set Drafts stay on the device for the
  same account only.

## States

Settings work in every state. Offline is one line above the account row.

## Out of scope

Lifetime totals and distance breakdown are not built yet. Linear
[APP-57](https://linear.app/appelent/issue/APP-57) (closed with the approved
[design study](../../designs/app/profile-totals_final.md), not the feature)
tracks them; once they exist they become the Summary: all-time totals, no
period menu, each figure linking to its source view. Never show
invented figures or simulated success.

## Acceptance

Evidence: [app redesign](../records/2026-10-07-app-redesign/README.md);
Hosted Workout deletion: [APP-408](../records/2026-11-20-delete-hosted-workouts/README.md).
