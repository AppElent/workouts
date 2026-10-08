# Workouts coding standards

## Ownership

`src/` is the TanStack Start web app, `convex/` the shared backend, and
`apps/mobile/` the Expo app. `packages/core/` owns domain calculations and shipped
catalogs shared by all three; build its ESM output before dependent checks.
The backend and web stay at the root to preserve existing deployment wiring.

For native changes, read [mobile standards](apps/mobile/CODING_STANDARDS.md).
For verification, use [project checks](docs/runbooks/verification.md); for upgrades,
use [dependency upgrades](docs/runbooks/dependency-upgrades.md).

## Adopted capabilities and exceptions

Workouts selects Convex and Clerk, English/Dutch localization, Cloudflare hosting,
and EAS mobile distribution. Shared capability guides own reusable behavior;
these are the remaining local integration boundaries:

| Capability | Current binding and reason to retain it |
| --- | --- |
| Auth | Web uses `@appelent/auth` and `@clerk/clerk-react`; mobile uses `@clerk/expo`. Retain these adapters until a deliberate migration. Personal operations enforce server-side ownership; shipped catalogs and explicit guest flows remain public. |
| Localization | `@appelent/i18n` owns the existing runtime seam; messages remain app-owned. A guidance update does not replace it. |
| CLI | `cli/index.ts` wraps `@appelent/cli`. Keep domain commands here; migrate generic login/config behavior only with runtime verification. |
| Environments | `pnpm env:*` still uses `scripts/env-legacy.mjs` / `@appelent/dev`, not installed `scripts/env.mjs`. Follow the [environment contract](docs/runbooks/environment.md). |
| Worktrees | `scripts/setup-worktree.mjs` owns the current lifecycle; use [worktree setup](docs/runbooks/worktree-setup.md) until the standalone workspace script is verified for this app. |
| Test login | Non-production builds retain public test-account variables. This legacy exception needs an auth migration; [verification](docs/runbooks/verification.md) constrains their use. |
| Observability | Adopt the shared Sentry feature; [Sentry operations](docs/runbooks/sentry.md) owns enabled surfaces, project bindings, sampling, and outstanding acceptance. |

Private `@appelent` runtime packages still need registry access; setup is in README.
Provider/deployment identities belong in runbooks, not shared defaults.


<!-- appelent-standards:start -->
## Shared guidance

Before code changes or review, read [coding rules](docs/guidelines/shared/general/coding.md).

| Task | Read |
| --- | --- |
| Browser code | [Web baseline](docs/features/web-baseline/FEATURE.md) |
| Native code | [Mobile architecture](docs/guidelines/shared/mobile/coding.md) and [mobile baseline](docs/features/mobile-baseline/FEATURE.md) |
| Verification | [Verification contract](docs/guidelines/shared/general/verification.md), then the project's check commands |
| Integration or repository tooling | Select the capability in the [feature index](docs/features/README.md) |
| Documentation or instruction changes | [Documentation ownership](docs/guidelines/shared/general/documentation.md) |

Project decisions below select implementations and explain deviations from shared defaults.
<!-- appelent-standards:end -->
