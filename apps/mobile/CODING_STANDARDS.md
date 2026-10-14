# Workouts mobile coding standards

Apply the shared [mobile coding](../../docs/standards/mobile-coding.md) and
[mobile structure](../../docs/standards/mobile-structure.md) standards.

## Bindings and migration scope

- Structure bindings: shared nutrition UI lives in `src/features/nutrition/components/`;
  cross-subject nutrition hooks live at the nutrition root.
- `src/data/` owns nutrition persistence; `@workouts/core` owns shared calculations
  and catalogs. Preserve these owners when restructuring screens.
- Feature ownership is adopted by live Nutrition Diary and Diary Entry. New work
  follows it; migrate legacy screens when changing their behavior. Labs routes
  may be compatibility aliases, not the exclusive redesigned destinations.
- Charts use Swift Charts through Expo UI on iOS and react-native-gifted-charts
  on Android behind `src/ui/chart`, preserving the tested platform bindings.
- Sentry's dependency-validation exception is documented in [Sentry operations](../../docs/runbooks/sentry.md#mobile-compatibility).

## Review and enforcement

Screen tests render through `src/test-support/render-screen.tsx` (app-wide
providers, iOS alerts as buttons); tests that navigate use `render-app.tsx`.

Selected mobile reads use the app-owned hooks in `src/convex/query-cache.tsx`.
Opt in deliberately: this preserves live subscriptions across short navigation
gaps, while ordinary Convex hooks retain their existing lifecycle. The cache sits
below the authenticated session gate. Its helper cleanup patch is required for
account/background disposal; reverify that behaviour when upgrading the helper.
Keep retained feature state where it still supports refresh errors or reads after
subscription expiry. The [pilot evidence](../../docs/records/2026-10-08-query-subscription-cache/README.md)
records adoption and usage limits.

`pnpm check:mobile-architecture` runs in `pnpm check`. It is this project's copy of
the structure standard's check: UI-to-feature imports, feature filenames,
literal feature font sizes, `*-copy.ts` dictionaries outside `src/i18n/`,
`locale === …` branches that choose text, and literal UI text in JSX children,
readable props (labels, titles, placeholders) and toast/confirm messages outside
tests and the catalog (UI text belongs in the
[message catalog](../../docs/standards/i18n.md); locale-specific formatting goes
through `localizeDecimal` and `dateLocale` in `src/i18n`). It does not establish
semantic ownership, indirect dependencies, or whole-app adoption. Review draft,
keyboard, scroll, and dismissal ownership together.
