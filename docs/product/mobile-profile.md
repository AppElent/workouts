# Profile and account interactions

Approved product behavior extracted from the mobile design studies. These choices
remain local because they define Workouts tasks, actions, and domain consequences.
They do not establish implementation completion. Consult [verification evidence](../verification/README.md)
and the current component API before implementing a study.
Reusable interactions come from the shared [patterns](../guidelines/shared/patterns/README.md);
[mobile design](../../apps/mobile/DESIGN_SYSTEM.md) owns brand and component bindings.

Settled in the profile study ([approved study](../../designs/app/profile_final.html)).

The [app redesign contract](app-redesign.md#profile-and-settings) defines the
scoped delivery exception: new Profile capabilities use clearly marked placeholders
until enhancement #93, while real identity and working settings stay available.
That contract also owns truthful sign-out and draft-retention behavior.

- **Settings rows carry a colored icon tile.** A row that leads to a setting may
  have a 30-point continuous-corner tile with a white SF Symbol on a fixed tint.
  This is the only exception to the single lime accent. Use the `icon` prop on
  `DisclosureRow`; do not draw tiles per screen. The tint stays the same in dark
  mode.
- **Settings one tap deep.** Group settings in `FormSection`s on the screen that
  owns them (Profile: Voorkeuren, Voeding). Do not add a pushed screen with a
  single row.
- **Account.** The account row (Clerk name, email, photo) opens Account with
  sign-in details, data export, and account deletion. Deletion names what is
  removed and points to export first.
- **Summary figures link to sources.** Profile totals cover all time, without a
  period menu (periods belong to Activity). Each figure is a button to its
  source view; the summary contract above applies.
- **Sign out.** Sign out is a red row in its own section at the bottom, always
  confirmed. When changes are waiting to sync, the confirmation gives the count
  and the verb becomes "Toch uitloggen".
- **Profile states.** Settings rows work in every state. Only the summary
  loads, fails, or shows an empty state; offline is one line above the account
  row.
