---
version: 1.1.0
description: Managed reading routes for all shared design files.
---

# Design system

<!-- appelent-standards:start -->
## Shared guidance

Read only files relevant to the target platform. Project-specific design decisions outside this block take precedence over shared defaults. Preserve the project's components and visual identity.

| File | When to read it |
| --- | --- |
| [general/design.md](docs/guidelines/shared/general/design.md) | All UI work: hierarchy, states, accessibility, and interaction. |
| [web/design.md](docs/guidelines/shared/web/design.md) | Browser UI: responsive layout, keyboard/focus, and browser behavior. |
| [mobile/design.md](docs/guidelines/shared/mobile/design.md) | Native UI: navigation, touch, safe areas, and system controls. |
| [ios/design.md](docs/guidelines/shared/ios/design.md) | iOS UI, together with general and mobile design. |
| [android/design.md](docs/guidelines/shared/android/design.md) | Android UI, together with general and mobile design. |
| [general/specialist-skills.md](docs/guidelines/shared/general/specialist-skills.md) | When design or platform expertise calls for an upstream skill. |
| [shared/README.md](docs/guidelines/shared/README.md) | To locate shared guidance by platform. |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Implementation standards and the complete feature/script reading map. |

Feature guides and their examples live under `docs/features/`; use the relevant guide listed in CODING_STANDARDS.md for feature-specific UI behavior. Research and experiments in the toolkit source are not installed project standards.
<!-- appelent-standards:end -->


## Workouts project decisions

The web uses the existing dark theme and green accent from `src/styles.css`, with
Tailwind/CVA and Base UI components in `src/components/`. `AppShell.tsx` owns the
desktop sidebar and narrow-screen bottom navigation. Reuse its navigation spacing
rather than introducing another shell. Active sessions are resumed through the
existing session affordance; the root layout does not force an active-session redirect.

Use `Button`'s `loading` prop, `useToast()`, `useConfirm()`, `Skeleton`, and
`EmptyState` from the existing component owners. The router uses
`RouteErrorFallback`. Apply shared state/feedback rules through these interfaces;
never introduce a parallel toast, confirmation, or modal system.

Mobile has its own Foundry visual identity and native component interfaces. Read
[the mobile design system](apps/mobile/DESIGN_SYSTEM.md) for its tokens, forms,
platform adapters, and acceptance requirements. [Foundry design assets](designs/foundry/readme.md)
are supporting references; runtime tokens and the mobile design system own shipped
implementation choices. Preserve the current web/mobile visual difference until
an explicit design migration.

Application UI copy supports English and Dutch. Translate accessible names,
validation, empty/error states, and navigation labels with the existing i18n seam.
