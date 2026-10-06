---
version: 1.2.0
description: "UI states, input preservation, and dismissal."
---

# Interaction

- Before changing a screen, identify the user's immediate job, primary action, entry/exit navigation, presentation, and Back/Cancel behavior. Design populated, initial-loading, empty, error, pending, refresh, long-text, and keyboard states together.
- Use a layout-matched skeleton when content shape is predictable; otherwise use appropriate progress feedback. Keep existing content during refresh.
- Show pending state on the action that initiated work and prevent duplicate submissions. Keep input after failure and surface an actionable error through the app's canonical feedback. Use success notifications only when the result is not already visible. Empty states explain what is absent and offer a useful next action.
- Confirm destructive actions that would lose meaningful data through the app's accessible confirmation mechanism. Name the action in the confirmation button; cancel leaves data unchanged.
- Preserve unsent composer and long-form drafts on dismissal. Draft storage must not publish or apply edits. Scope drafts to account and item/context.
- Canceling an edit leaves saved data unchanged. Confirm dismissal only when meaningful changes would otherwise be lost; dismiss untouched forms immediately. Make discarding a draft explicit.
- Use the project's canonical components and semantic tokens. Respect text scaling, reduced motion, accessible names, and supported locales/themes.
- Verify delayed, empty, and failed responses as well as success. A screenshot does not establish interaction behavior.
