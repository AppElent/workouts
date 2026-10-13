# Workouts design system

<!-- appelent-standards:start -->
## Shared guidance

For UI work, read [interaction rules](docs/guidelines/shared/general/design.md) and the affected platform:

| Platform | Read |
| --- | --- |
| Browser | [Web](docs/guidelines/shared/web/design.md) |
| Native | [Mobile](docs/guidelines/shared/mobile/design.md), plus [iOS](docs/guidelines/shared/ios/design.md) or [Android](docs/guidelines/shared/android/design.md) |

For number entry, editing presentations, or actionable lists, select the relevant
[design pattern](docs/guidelines/shared/patterns/README.md), or a `kind: pattern` standard in
`docs/standards/`. Project decisions below
bind these contracts to product components, identity, and justified exceptions.
<!-- appelent-standards:end -->

## Web

Dark theme with a green accent, defined in `src/styles.css`. Components are
Tailwind/CVA and Base UI in `src/components/`. `AppShell.tsx` owns the desktop
sidebar, narrow-screen bottom navigation, and the active-session resume affordance;
the root layout does not redirect to an active session.

Shared interaction contracts bind to the `Button` loading state, `useToast()`,
`useConfirm()`, `Skeleton`, `EmptyState`, and `RouteErrorFallback`.

## Native

Read [Foundry's mobile design system](apps/mobile/DESIGN_SYSTEM.md). Its identity
intentionally differs from the web until an explicit design migration.

## Both platforms

UI copy, accessible names, validation, and navigation ship in English and Dutch
through the i18n seam. For screen studies in `designs/`, follow
[design studies](docs/runbooks/design-studies.md).
