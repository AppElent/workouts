---
type: contract
description: Read when changing Profile, settings, account actions, or sign-out.
version: 2.1.0
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
  - *Export.* An online JSON file of every personal table, shared through the
    system share sheet. Receipts and counters are omitted; Food photo files are
    not included.
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
    empty account. Device preferences remain. Blocked offline, during a running
    Activity, and with Hosted Workout involvement, like test-data reset.
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
  - *Apple after deletion.* The confirmation after Delete account (phone
    sign-in screen, web start) says whether Foundry still uses Sign in with
    Apple: stopped, or, when revoking failed or was impossible (Android, an
    origin Apple doesn't know), how to stop it at account.apple.com.
  - *Login deleted elsewhere.* When the AppElent login is deleted from another
    app or the Clerk dashboard, Clerk's signed `user.deleted` webhook
    (`POST /clerk/webhook`) runs the same purge on the server, in batches,
    without the running-Activity blocker; Hosted Workout involvement still
    keeps the data and is logged.
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
period menu, each figure linking to its source view. Deleting accounts with Hosted
Workout involvement needs a separate shared-event cleanup design. Never show
invented figures or simulated success.

## Acceptance

Evidence: [app redesign](../records/2026-10-07-app-redesign/README.md).
