# Workouts coding standards

<!-- appelent-standards:start -->
## Shared guidance

Before code changes or review, read [coding rules](docs/guidelines/shared/general/coding.md).

| Task | Read |
| --- | --- |
| Browser code | [Web baseline](docs/features/web-baseline/FEATURE.md) |
| Native code | [Mobile architecture](docs/guidelines/shared/mobile/coding.md) and [mobile baseline](docs/features/mobile-baseline/FEATURE.md) |
| Verification | [Verification contract](docs/guidelines/shared/general/verification.md), then the project's check commands |
| Integration or repository tooling | The matching standard in `docs/standards/`, else the [feature index](docs/features/README.md) |
| Documentation or instruction changes | [Documentation standard](docs/standards/documentation.md) |

Project decisions below select implementations and explain deviations from shared defaults.
<!-- appelent-standards:end -->

## Workspaces

| Path | Owns |
| --- | --- |
| `src/` | TanStack Start web app; routes in `src/routes/`, navigation in `src/components/navItems.ts` |
| `convex/` | Shared backend |
| `apps/mobile/` | Expo app (Foundry); read [mobile standards](apps/mobile/CODING_STANDARDS.md) before native changes |
| `packages/core/` | Domain calculations and shipped catalogs; build its ESM output before dependent checks |

Web and backend stay at the root to preserve deployment wiring. Run the
[project checks](docs/runbooks/verification.md) for every affected target.

## Domain documentation

[GLOSSARY.md](GLOSSARY.md) is the single vocabulary for web, mobile, and core: use
its terms in code, hypotheses, and issue titles, and record newly resolved terms
there. Read the ADRs in `docs/adr/` for the affected boundary and name any conflict with
an accepted ADR before reopening it.

## Local bindings and exceptions

Workouts selects Convex, Clerk, English/Dutch localization, Cloudflare hosting,
and EAS distribution. These bindings deviate from or narrow the shared guidance:

| Capability | Binding |
| --- | --- |
| Auth | Web: `@appelent/auth` + `@clerk/clerk-react`; mobile: `@clerk/expo`. Personal operations enforce server-side ownership; shipped catalogs and explicit guest flows stay public. |
| Localization | `@appelent/i18n` owns the runtime seam; messages stay app-owned. |
| CLI | `cli/index.ts` wraps `@appelent/cli` and owns domain commands. Migrating generic login/config needs runtime verification. |
| Environments | `pnpm env:*` runs `scripts/env-legacy.mjs` (`@appelent/dev`), not the installed `scripts/env.mjs`. See [environment](docs/runbooks/environment.md). |
| Worktrees | `scripts/setup-worktree.mjs` owns the lifecycle, not `scripts/workspace.mjs`. See [worktree setup](docs/runbooks/worktree-setup.md). |
| Test login | Non-production builds embed public test-account variables; a legacy exception pending an auth migration. |
| Observability | Shared Sentry feature; [Sentry operations](docs/runbooks/sentry.md) owns surfaces, projects, and sampling. |
