# Workouts design system

<!-- appelent-standards:start -->
## Shared guidance

For UI work, read [general design](docs/standards/general-design.md) and the affected platform:

| Platform | Read |
| --- | --- |
| Browser | [Web design](docs/standards/web-design.md) |
| Native | [Mobile design](docs/standards/mobile-design.md), plus [iOS](docs/standards/ios-design.md) or [Android](docs/standards/android-design.md) |

Read a pattern only when building that interaction: [number fields](docs/standards/number-fields.md), [editors](docs/standards/editors.md),
[actionable lists](docs/standards/lists.md), and [design studies](docs/standards/design-studies.md). Project
decisions below bind these standards to product components, identity, and justified exceptions.
Conform, improve, or differ as described in [working with standards](CODING_STANDARDS.md#working-with-standards).
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
