---
version: 1.0.0
description: Feature ownership and editing-state boundaries in native applications.
---

# Mobile architecture

Routes own parameter validation, navigation, and presentation. Feature modules own
screens, state, and domain-aware supporting UI. App-wide UI owns domain-independent
controls and platform adapters; it must not import features. Shared domain
calculations belong in a workspace module when web/backend/native callers need them.

Keep supporting UI within the smallest feature/subject that uses its contract.
Move it outward when another subject needs that contract. Keep state hooks beside
their owner, paired tests beside the component, and scenario tests in the subject's
`__tests__/`. Use kebab-case filenames with subject/task/role names and matching
PascalCase component exports; retain complete basenames for platform/test variants.

A view reads saved data. An editor owns a draft, validation, and commit. A page or
sheet is a presentation of that task. Reuse content and state when only the
presentation changes; separate wrappers when navigation or composition differs.
Instantiate draft state once per editing session. Two calls to the same hook do
not share a draft.

Routed sheets represent navigable tasks; local sheets/popups support the current
task. Give keyboard geometry, scrolling, safe areas, and dismissal a coordinating
owner. Apply the same unsaved-change policy to close, swipe dismissal, and Android
Back. Read [editor presentations](../patterns/editors.md) when choosing the UI.

Project standards identify actual directories and gradual migration boundaries;
mechanical checks enforce only the boundaries they can observe. Review semantic
ownership and cross-file consistency separately.
