# In-app test data

Status: agreed product design, implemented 2026-10-10. See the
[verification record](../verification/in-app-test-data.md) for checked targets
and remaining platform acceptance.

## Agreed direction

- Manage test data from inside the app in test environments.
- Start with simple load and reset actions.
- Generate synthetic data.
- Provide controls on mobile and web in local, preview, and dev environments.
  Hide them in production and reject the operations on the production server.
- Affect only the signed-in account.
- **Load test data** replaces personal data with the synthetic baseline,
  including records manually created during testing. Repeating a load produces
  no duplicates.
- **Clear test data** removes personal test data, including manually created
  records, leaving an empty account. Shipped Foods and Shipped Exercises remain
  available after either operation.
- Use one combined training and nutrition dataset with a few weeks of history
  ending today: Routines, completed Strength Sessions, Runs, Rides, Body Metrics,
  Personal Foods, Combos, Nutrition Goals, and Diary Entries.
- Include data covering different testcases, not just ordinary populated screens.

## Testcase coverage

Use one comprehensive dataset rather than separate selectable scenarios. Clear
covers empty screens; Load covers populated screens and compatible edge cases:

- Training history gaps, Personal Exercises, different Set types, and measured,
  estimated, and manual One-rep Maxes.
- Foods with different Servings, approximate or missing nutrition values,
  Forks, and Combos.
- Historical Diary Entries whose source Food changed or became unavailable;
  their snapshots retain their recorded values.
- Capture Drafts, effective-dated Nutrition Goal changes, and days with partial
  or no intake.

Loading failures and offline behavior require runtime testing; synthetic data
alone does not reproduce them.

## Reset boundaries and interaction

- Preserve login, account identity, and preferences such as units and theme.
- Remove personal training and nutrition records, including saved Capture
  Drafts. Clear related caches, remembered food selections, and Food photos on
  the current device. This does not promise removal of device-local files on
  other devices.
- Exclude Hosted Workouts from the initial dataset. Block Load and Clear when
  shared-event involvement would make reset unsafe. Neither operation may
  change another account's data or use shared-event deletion as a shortcut.
  Hosted Workout support requires a separate cleanup design.
- Block both actions while an Activity is running.
- Otherwise show one confirmation explaining that existing personal data,
  including saved drafts, will be replaced or removed.

## Acceptance

- Mobile and web expose both actions in eligible environments; production
  rejects them at the server boundary as well as hiding the controls.
- Loading twice leaves one baseline with the specified testcase coverage and
  recent dates, without duplicate records.
- Clearing after loading and manually adding records leaves personal training
  and nutrition empty while preserving identity, preferences, and shipped data.
- Operations remain limited to the signed-in account, honor the active-Activity
  and shared-event blockers, and clear the specified current-device state.

## Existing constraint

The current training seed's deletion scope is incomplete for an account reset.
Implementation must satisfy the scope above before reusing that operation. See
[the seed implementation](../../convex/seed.ts) and the
[account-data ownership decision](../adr/0014-online-first-account-data.md).
