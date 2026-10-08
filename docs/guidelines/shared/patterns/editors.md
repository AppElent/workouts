---
version: 1.0.0
description: Choose fullscreen, sheet, or keyboard-anchored editing and preserve drafts.
---

# Editing presentations

Choose by attention, space, and navigation needs rather than field count.

| Task | Presentation |
| --- | --- |
| Sustained, multi-section work or navigation among related details | Pushed/fullscreen editor |
| Focused self-contained edit with useful underlying context | Native bottom/form sheet |
| Small contextual capture or adjustment | Keyboard-anchored popup/composer |

A popup augments the current task; expanding it to a fuller editor preserves the
same draft. A small field count alone does not justify an overlay when validation
or nested navigation needs more space. Web uses its corresponding accessible
page/dialog/popover controls; platform styling is not part of the shared contract.

## State and actions

Saved data changes only on commit. Scope a draft to its account and item/context.
A clean editor dismisses immediately; a dirty editor preserves its draft or asks
before losing meaningful changes. Explicit Discard abandons it. Apply the same
policy to close, Back, swipe dismissal, and presentation changes.

Save reflects clean, changed, invalid/conflicting, pending, and failed states.
Block duplicate commits; failure preserves the draft and offers recovery. Choose
screen-level native toolbar actions for full editors and sheets; keep a composer's
submit action beside its input. Give icon actions accessible names.

One owner coordinates scroll, keyboard, safe-area insets, and dismissal. The
focused input and required actions stay visible. Avoid layering platform hosts
inside keyboard windows unless the installed runtime supports that composition.

## Acceptance and examples

Exercise open/focus, next field, nested popup, expansion, dismissal by each route,
reopen, invalid input, failed commit, large text, and keyboard motion. Confirm that
closed auxiliary controls leave the parent tappable.

The developer-tools mobile lab provides native input demonstrations. Workouts'
Diary Entry and goals studies supply product bindings and dated evidence. The
Workouts InputAccessoryView/SwiftUI crash workaround is runtime-specific; it is
not a universal ban on keyboard-anchored editors.
