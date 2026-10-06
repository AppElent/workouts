---
version: 1.1.0
description: Managed reading routes for coding, feature guides, and toolkit scripts.
---

# Coding standards

<!-- appelent-standards:start -->
## Shared guidance

Read only files relevant to the task. Project-specific decisions outside this block take precedence over shared defaults.

| File | When to read it |
| --- | --- |
| [general/coding.md](docs/guidelines/shared/general/coding.md) | Before implementing or reviewing code: ownership, credentials, and verification. |
| [general/specialist-skills.md](docs/guidelines/shared/general/specialist-skills.md) | When specialist expertise is needed; routes to upstream skills. |
| [shared/README.md](docs/guidelines/shared/README.md) | To locate shared platform guidance. |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | For UI work; includes every shared design file and its reading trigger. |
| [features/README.md](docs/features/README.md) | For feature implementation or repository tooling; indexes the following guides. |
| [toolkit/FEATURE.md](docs/features/toolkit/FEATURE.md) | Toolkit updates, ownership, conflicts, recovery, and separate skill installation. |
| [baseline/FEATURE.md](docs/features/baseline/FEATURE.md) | Shared pnpm, TypeScript, Biome, dependency policy, and verification standard/setup. |
| [web-baseline/FEATURE.md](docs/features/web-baseline/FEATURE.md) | Web stack standard (TanStack Start, styling, primitives, forms, tests) and setup. |
| [mobile-baseline/FEATURE.md](docs/features/mobile-baseline/FEATURE.md) | Mobile stack standard (Expo, Router, native UI, tests), setup, and release boundaries. |
| [auth/FEATURE.md](docs/features/auth/FEATURE.md) | Clerk/Convex authentication and existing-app migrations. |
| [i18n/FEATURE.md](docs/features/i18n/FEATURE.md) | Web/native localization, locale persistence, and message parity. |
| [app-cli/FEATURE.md](docs/features/app-cli/FEATURE.md) | Application commands and browser login. |
| [environments/FEATURE.md](docs/features/environments/FEATURE.md) | Environment manifests, value routing, providers, and generated-file ownership. |
| [workspaces/FEATURE.md](docs/features/workspaces/FEATURE.md) | Isolated worktrees, backend resources, and safe cleanup. |
| [previews/FEATURE.md](docs/features/previews/FEATURE.md) | PR backend/Worker deployment workflows. |
| [pwa/FEATURE.md](docs/features/pwa/FEATURE.md) | Browser installability and service workers. |
| [issue-reporter/FEATURE.md](docs/features/issue-reporter/FEATURE.md) | Authenticated in-app GitHub feedback. |
| [mcp/FEATURE.md](docs/features/mcp/FEATURE.md) | Local/remote protocol tools and authentication. |

Each feature guide owns its adjacent examples/templates; read those only when implementing that feature. Files copied into application code become project-owned.

Scripts: `sync-devtools.mjs` updates toolkit files; `baseline.mjs`, `baseline-web.mjs`, and `baseline-mobile.mjs` preview setup; `env.mjs` routes environment values; `workspace.mjs` manages isolated resources; `check-project.mjs` checks prerequisites. Read the owning guide before execution. `scripts/lib/` contains their implementation helpers; inspect it when changing or debugging scripts, not during routine application work.

Skills are installed separately with `npx skills`; toolkit sync does not install or update them. `.appelent/devtools.json` records installed files and managed blocks for conflict detection. Read it when diagnosing toolkit drift. Do not edit managed guidance or erase receipts to bypass conflicts.
<!-- appelent-standards:end -->

## Workouts project decisions

Read [Workouts coding decisions](docs/guidelines/project/coding.md) before implementing or reviewing code.
