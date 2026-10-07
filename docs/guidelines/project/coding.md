# Workouts coding decisions

This project follows the shared, web, and mobile baselines routed through
[root coding standards](../../../CODING_STANDARDS.md). These
notes identify its actual integrations and exceptions; configuration files own
versions, scripts, and formatter settings.

## Boundaries

- `src/` is the TanStack Start web target; `convex/` is the shared backend.
  Both stay at the repository root. `apps/mobile/` is the Expo target.
- `packages/core/` (`@workouts/core`) owns shared domain calculations and shipped
  catalogs. Its tsup-built ESM output lets Convex resolve workspace imports;
  build it before checking dependent targets. Avoid separate web/backend/native
  implementations of the same calculation.
- `CONTEXT.md` owns domain vocabulary; `docs/adr/` owns durable trade-offs.
  Schema and API details come from `convex/schema.ts` and implementation source,
  not copied table/route inventories in agent instructions.
- Root aliases `#/*` and `@/*` resolve to `src/`; `@convex/*` to `convex/`.
  Other targets use their own configuration.

## Tech stack: project integrations and platform choices

The shared baselines own the common tool choices. Workouts uses these additional
integrations and platform-specific implementations; package files own versions.

| Layer | Workouts implementation |
| --- | --- |
| Backend | Convex, shared by web and mobile |
| Auth | Clerk; web uses `@appelent/auth` with `@clerk/clerk-react`, mobile uses `@clerk/expo` |
| Web charts | Recharts, following the web baseline |
| Web date utilities | date-fns, following the web baseline |
| Mobile charts | Swift Charts through `@expo/ui/swift-ui` on iOS; `react-native-gifted-charts` on Android, behind `apps/mobile/src/ui/chart` |
| Mobile device tooling | Expo Device Hub, following the mobile baseline; installed in the Expo target as a devDependency |
| Localization | Existing `@appelent/i18n` integration with English/Dutch app-owned messages |
| Application CLI | Existing `@appelent/cli` wrapper in `cli/index.ts` |

## Integrations and migration boundaries

- Clerk owns session/navigation state; Convex owns backend readiness and resource
  authorization. Personal operations enforce identity/ownership server-side.
  Shipped catalogs and explicitly public/guest flows have different access rules;
  do not assume every query requires a signed-in user. See the auth feature guide.
- The web still uses `@appelent/auth` and `@clerk/clerk-react`; mobile uses
  `@clerk/expo`. Inspect each installed SDK's adapter, not an old Core-generation
  label. Route guards follow loaded Clerk state; protected requests follow Convex
  readiness. Installing guidance has not migrated these implementations.
- `@appelent/i18n` and `@appelent/cli` remain runtime dependencies. The Workouts
  CLI in `cli/index.ts` wraps the latter; keep domain commands here and avoid
  forking its generic auth/config behavior before a deliberate app-owned migration.
- `pnpm env:*` still calls `scripts/env-legacy.mjs` / `@appelent/dev/env`.
  The new standalone `scripts/env.mjs` is installed but is not those aliases'
  runtime. Preserve the manifest, generated-file ownership, and source ordering
  described in [the environment contract](../../runbooks/environment.md).
- Worktrees still use `scripts/setup-worktree.mjs`; the distributed workspace
  script is not a replacement until this app's configuration and lifecycle are
  verified. See [worktree setup](../../runbooks/worktree-setup.md).
- Private `@appelent` dependencies still require registry authentication. Follow
  README setup; never commit credentials. Test-login credentials currently use
  public client variables in non-production placements; this legacy exception
  needs a separate authentication migration, not promotion to a shared standard.

## Verification and operations

Use [README commands](../../../README.md#commands) and the project's verification skill.
CI checks both targets: root Biome/types/Vitest/build and mobile types/Jest.
Generated routes, Convex bindings, and catalogs are outputs; use their generators.
Biome scope/exclusions and dependency supply-chain controls live in `biome.json`
and `pnpm-workspace.yaml`; do not maintain a prose copy of their options.

Development requires both Vite and a continuously running/pushing Convex process
(`pnpm dev:watch`). `pnpm dev` starts only Vite; `pnpm dev:all` pushes once.
`pnpm preview` builds development mode and runs Wrangler, not Vite preview.
Provider identities, environment names, release channels, and migrations are
project-specific runbooks linked from [the docs index](../../README.md).

## Mobile ownership review


For mobile changes, follow [the folder contract](mobile-folder-structure.md).
Reviewers assess responsibility boundaries: routes own presentation, one draft owner
owns the editing session, and shared components move only when actual callers need
the same contract. Check that keyboard geometry, scrolling, and dismissal each have
one coordinating owner. The contract documents automated checks for mechanical
boundaries; review focuses on semantic ownership and cross-file consistency.
