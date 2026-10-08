# Workouts mobile coding standards

Apply the shared [mobile architecture](../../docs/guidelines/shared/mobile/coding.md).

## Bindings and migration scope

- `app/` owns routes; `src/features/<feature>/<subject>/` owns screens and state.
  Shared nutrition UI lives in `src/features/nutrition/components/`; cross-subject
  hooks live at the nutrition root. `src/ui/` owns domain-independent adapters.
- `src/data/` owns nutrition persistence; `@workouts/core` owns shared calculations
  and catalogs. Preserve these owners when restructuring screens.
- Feature ownership is adopted by live Nutrition Diary and Diary Entry. New work
  follows it; migrate legacy screens when changing their behavior. Labs routes
  may be compatibility aliases, not the exclusive redesigned destinations.
- Charts use Swift Charts through Expo UI on iOS and react-native-gifted-charts
  on Android behind `src/ui/chart`, preserving the tested platform bindings.
- Sentry's dependency-validation exception is documented in [Sentry operations](../../docs/runbooks/sentry.md#mobile-compatibility).

## Review and enforcement

`pnpm check:mobile-architecture` runs in `pnpm check`. It checks UI-to-feature
imports, feature filenames, and literal feature font sizes. It does not establish
semantic ownership, indirect dependencies, or whole-app adoption. Review draft,
keyboard, scroll, and dismissal ownership together; keep exceptions narrow.
Use [project verification](../../docs/runbooks/verification.md) for target checks.
