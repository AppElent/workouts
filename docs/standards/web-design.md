---
type: standard
kind: platform
description: Read before designing or changing browser UI.
version: 1.1.2
applies_to: [web]
---

# Web design

Browser UI is semantic, keyboard-accessible, responsive, and recoverable. Builds on [general design](general-design.md).

## Rules

- Use links for navigation and buttons for actions. Provide accessible names, keyboard access, visible focus, and sensible focus restoration after dialogs.
- Associate labels and errors with fields. Make feedback discoverable without relying only on color.
- Preserve normal browser scrolling and zoom.
- Preserve useful content during navigation/refresh and entered values on recoverable failures.
- Give each page a meaningful document title. Route failures show the shared error fallback with recovery; dialogs/popovers use the selected accessible primitives rather than browser confirmation dialogs.

## Verify

- Narrow layouts, zoom, long translations, and supported themes.

## Exceptions

Record in `DESIGN_SYSTEM.md`: rule, scope, replacement, reason.
