---
version: 1.1.0
description: "Native iOS toolbar actions, gestures, and input presentation."
---

# iOS

- Prefer native navigation, controls, sheets, menus, and their built-in behavior. Keep screen-level actions top-right: one or two toolbar items or a menu; do not replace them by default with large content buttons.
- Implement and verify expected swipe actions, swipe-back, and long-press context menus where appropriate to the iOS pattern.
- Use a keyboard-attached composer for very small inputs, a native sheet for short focused forms, and a pushed screen for larger edits. Choose by complexity and attention, not a rigid field count.
- Keep a composer's submit action beside its input. It should track keyboard movement, support longer input, and preserve values when expanding to a fuller editor.
- Use native dismissal behavior while preserving drafts or confirming otherwise-lost edits as defined in the shared interaction rules.
