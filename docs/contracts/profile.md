---
type: contract
description: Read when changing Profile, settings, account actions, or sign-out.
version: 1.2.0
status: current
---

# Profile

A person sees their identity and all-time totals and reaches every setting in one
tap. Study: [profile](../../designs/app/profile_final.html).

## Behavior

- **Settings one tap deep.** Preferences and Nutrition are `FormSection`s on
  Profile; no pushed screen with a single row. Appearance, language, nutrition
  destinations, Feedback, Labs, and sign-out stay reachable.
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
  - *Export.* An online JSON file of every personal table, shared through the
    system share sheet. Receipts and counters are omitted; Food photo files are
    not included.
  - *Delete my data.* After one destructive confirmation, deletes all personal
    training and nutrition records, goal preferences, and uploaded Food photos in
    resumable server batches, then clears this device's account state. The
    account and device preferences remain. Blocked offline, during a running
    Activity, and with Hosted Workout involvement, like test-data reset.
  - *Delete account.* The same deletion, then Clerk's self-deletion, which signs
    out. Unavailable when the Clerk instance disables self-deletion.
- **Summary.** All-time totals, no period menu. Each figure links to its source view.
- **Sign out.** A red row in its own bottom section, always confirmed. The
  confirmation states the real pending and device-local state, with a count and
  "Toch uitloggen" when changes are waiting. Set Drafts stay on the device for the
  same account only.

## States

Settings work in every state. Only the summary loads, fails, or is empty. Offline
is one line above the account row.

## Out of scope

Until [#93](https://github.com/AppElent/workouts/issues/93): lifetime totals and
distance breakdown. Deleting accounts with Hosted Workout involvement needs a
separate shared-event cleanup design. They show dashes or a
"coming soon" mark; never invented figures or simulated success.

## Acceptance

Evidence: [app redesign](../records/2026-10-07-app-redesign/README.md).
