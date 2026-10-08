# Workouts design system

## Identity and component bindings

The web retains the dark theme and green accent in `src/styles.css`.
Tailwind/CVA and Base UI components live in `src/components/`.
`AppShell.tsx` owns desktop sidebar and narrow-screen bottom navigation spacing.
Resume active sessions through its session affordance; the root layout does not
force an active-session redirect.

Use the existing `Button` loading state, `useToast()`, `useConfirm()`, `Skeleton`,
`EmptyState`, and `RouteErrorFallback` for shared interaction contracts.

For native UI, read [Foundry's mobile design system](apps/mobile/DESIGN_SYSTEM.md).
Its identity intentionally differs from the web until an explicit design migration.
UI copy, accessible names, validation, and navigation support English and Dutch
through the existing i18n seam.

## Design studies

Studies live in `designs/<area>/`: `<screen>_round<n>.html` records iterations;
`<screen>_final.html` records the approved design and implementation notes.
Use the [design study workflow](docs/runbooks/design-studies.md). Mobile studies
use runtime tokens and Dutch example copy by default. Final studies establish
intended behavior; implementation acceptance belongs in verification evidence.


<!-- appelent-standards:start -->
## Shared guidance

For UI work, read [interaction rules](docs/guidelines/shared/general/design.md) and the affected platform:

| Platform | Read |
| --- | --- |
| Browser | [Web](docs/guidelines/shared/web/design.md) |
| Native | [Mobile](docs/guidelines/shared/mobile/design.md), plus [iOS](docs/guidelines/shared/ios/design.md) or [Android](docs/guidelines/shared/android/design.md) |

For number entry, editing presentations, or actionable lists, select the relevant
[design pattern](docs/guidelines/shared/patterns/README.md). Project decisions below
bind these contracts to product components, identity, and justified exceptions.
<!-- appelent-standards:end -->
