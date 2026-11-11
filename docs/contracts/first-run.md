---
type: contract
description: Read when changing the First Run, the new-account start, or what counts as an empty account.
version: 1.0.0
status: current
---

# First Run

A person with a new account sets Nutrition Goals and reaches a first log without
explanation. Mobile only, like the Nutrition Diary. Issue:
[#186](https://github.com/AppElent/workouts/issues/186).

## Behavior

- **Who sees it.** An account with no Nutrition Goals ever saved and no history:
  no Diary Entries, Strength Sessions, Activities, or WOD results.
  `account.firstRun` decides on the server with one indexed read per table.
  Accounts with goals or history never see it.
- **Once per device.** The app offers it once per account on a device, when the
  tab shell opens. Offered counts as done, whatever the person chooses next, so
  it never returns on that device. A new device, or this one after the
  account's data is reset here, offers it again only while the account is
  still empty. The mark is account-scoped local data (`first-run-offered:v1`).
- **Presentation.** A sheet over Home: what Foundry does, two steps (set goals,
  log a first meal), one primary action, and Skip at the top right.
- **Set nutrition goals** opens the existing [goals editor](nutrition-diary.md#goals-editor)
  over the sheet. Saving goes to the Nutrition Diary for today, where the first
  Diary Entry is one tap away. Closing the editor without saving returns to the
  sheet.
- **Start with a workout instead** closes the sheet and opens Train.
- **Skip**, or swiping the sheet down, leaves the app as it was. Nothing is
  blocked; goals stay one tap deep in [Profile](profile.md).

## States

The prompt waits for the server answer; while loading, offline, or on failure it
does not appear and nothing else waits for it. All copy is in English and Dutch,
scales with Dynamic Type, and uses theme tokens in light and dark.

## Out of scope

- Web: it has no Nutrition Diary or goals editor.
- Profile setup, tours, sample data, or a server-side "seen" flag. A person who
  reinstalls with a still-empty account sees it once more.

## Acceptance

- Jest, sheet: saving goals reaches the diary, the workout choice reaches Train,
  and Skip leaves Home usable.
- Jest, prompt: a new account gets the sheet when the tab shell opens; an account
  with goals or history, or a failed query, gets nothing; after Skip it is not
  offered again on the device.
- Convex: `account.firstRun` is empty only without goals and without history.
- Maestro `first-run` smoke flow walks the sheet as a new user.
