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

- **Who sees it.** Only an account with no Nutrition Goals ever saved and no
  history: no Diary Entries, Strength Sessions, Activities, or WOD results.
  Accounts with goals or history never see it. The sheet lives at `/first-run`;
  the server check and the prompt that opens it follow in steps 2 and 3 of APP-5, so
  until then nothing opens it on its own.
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

The sheet has no loading or error state of its own: it reads no data. All copy
is in English and Dutch, scales with Dynamic Type, and uses theme tokens in
light and dark.

## Out of scope

- Web: it has no Nutrition Diary or goals editor.
- Profile setup, tours, sample data, or a server-side "seen" flag. A person who
  reinstalls with a still-empty account sees it once more.

## Acceptance

- Jest: from the sheet, saving goals reaches the diary, the workout choice
  reaches Train, and Skip leaves Home usable.
