# AGENTS.md

Read `CLAUDE.md` for all project conventions (pnpm always, Biome, commands, testing).

## Upgrading dependencies

Follow the steps in `.claude/commands/upgrade-deps.md` (readable as plain markdown).
Never weaken or skip tests to make an upgrade pass; stop and report instead.

<!-- appelent-managed:start -->
## Appelent Managed Project

This is an Appelent-managed app. Opted-in features and their options are
recorded in `appelent.json`. Feature definitions live in the `appelent`
plugin (locally installed) or https://github.com/AppElent/appelent-packages
(`skills/<feature>/FEATURE.md`).

Before adding functionality that could apply to multiple apps, check the
feature catalog first. To add or update a feature, use `/appelent`.

### UI hygiene

- Async views render a skeleton (`ui/skeleton.tsx`) matching the final
  layout — never a blank page or a spinner-only screen.
- Destructive actions go through `useConfirm()` (`ui/confirm-dialog.tsx`) —
  never `window.confirm`. Confirm buttons use verb-specific labels
  ("Delete workout", not "OK").
- Mutations: the trigger button shows a pending state (`Button loading`);
  errors always surface an error toast (`useToast().error`); success toasts
  only when the result isn't already visible on screen. Forms keep the
  user's input on failure.
- List/dashboard views define an `EmptyState` (`ui/empty-state.tsx`) —
  never an unexplained blank region.
- Every route defines a document title (route `head`); route errors render
  the shared error fallback with retry, not a white screen.
- Icon-only buttons get an `aria-label`. Dialogs/popovers use Base UI
  primitives only.
<!-- appelent-managed:end -->
