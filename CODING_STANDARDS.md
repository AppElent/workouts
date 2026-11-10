# Foundry coding standards

<!-- appelent-standards:start -->
## Shared guidance

Read only what the task needs; never preload every standard.

1. **Every code change:** [general coding](docs/standards/general-coding.md), plus [mobile coding](docs/standards/mobile-coding.md) for native code.
2. **When the task matches a row:** the linked standard.

| Task | Read |
| --- | --- |
| Adding, moving, or naming native files | [Mobile structure](docs/standards/mobile-structure.md) |
| Repository, package manager, formatter, types, tests, CI, or toolkit sync | [Baseline](docs/standards/baseline.md) |
| Top-level folders, workspace packages, or shared code between web, Convex, and mobile | [Repository layout](docs/standards/repo-layout.md) |
| Dependabot or automated dependency PRs | [Dependency updates](docs/standards/dependency-updates.md) |
| Web app stack, UI states, or browser capabilities | [Web baseline](docs/standards/web-baseline.md) |
| Expo setup or native configuration | [Mobile baseline](docs/standards/mobile-baseline.md) |
| Native builds, getting one onto a phone, TestFlight, OTA updates, or releases | [Mobile distribution](docs/standards/mobile-distribution.md) |
| Reporting work as done, verified, or accepted | [Verification](docs/standards/verification.md), then the project's check commands |
| Environment variables, secrets, `env.manifest.ts`, or `env:*` scripts | [Environments](docs/standards/environments.md) |
| Creating, preparing, or cleaning a worktree | [Workspaces](docs/standards/workspaces.md) |
| Authentication | [Auth](docs/standards/auth.md) |
| Convex functions, schema, migrations, seeds, tests, or account deletion and export | [Convex backend](docs/standards/convex.md) |
| Convex query reads, subscription retention, or local read caches | [Convex query caching](docs/standards/convex-query-caching.md) |
| Localization | [i18n](docs/standards/i18n.md) |
| Error reporting and source maps | [Sentry monitoring](docs/standards/sentry-monitoring.md) |
| In-app problem reports | [Issue reporting](docs/standards/issue-reporting.md) |
| Pull-request previews | [Previews](docs/standards/previews.md) |
| Staging or production deploys, deploy workflows, or branch rules | [Deployments](docs/standards/deployments.md) |
| Web manifest, installability, or service worker | [PWA](docs/standards/pwa.md) |
| Application CLI or browser login for it | [App CLI](docs/standards/app-cli.md) |
| MCP server or tools | [MCP](docs/standards/mcp.md) |
| Documentation or instruction changes | [Documentation](docs/standards/documentation.md) |
| Loading an external skill (Expo, Vercel React Native, better-*) | [Specialist skills](docs/standards/specialist-skills.md) |

### Working with standards

- **Conform:** follow standards as written. Rules are required unless marked **Default**. Installed copies are never edited in the project.
- **Improve:** when a standard is wrong, unclear, or missing a rule other projects would share, propose the change upstream with the `developer-tools` skill: a pull request when concrete, an issue when not.
- **Differ:** when this project needs something else, discuss it with the user first; never deviate silently. Record the agreed exception below: rule, scope, replacement, reason.

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

Foundry selects Convex, Clerk, English/Dutch localization, Cloudflare hosting,
and EAS distribution. These bindings deviate from or narrow the shared guidance:

| Capability | Binding |
| --- | --- |
| Auth | Web: app-owned `src/lib/auth` + `@clerk/react`; mobile: `@clerk/expo` (both Clerk Core 3). Personal operations enforce server-side ownership; shipped catalogs and explicit guest flows stay public. |
| Localization | App-owned runtime in `src/lib/i18n/runtime` (mobile copies `core.ts`); messages stay app-owned. |
| CLI | `cli/index.ts` wraps the app-owned `cli/runtime` and owns domain commands. |
| Environments | `pnpm env:*` runs `scripts/env.mjs` with the shared routing; environments are `local`, `dev`, `preview`, `staging`, and `production`; `staging` is only the installed preview app (EAS `preview`), with no staging web. See [environment](docs/runbooks/environment.md). |
| Worktrees | The editor hook runs `node scripts/workspace.mjs prepare --editor <host>` with `backend.mode: "none"` in `appelent.json`. See [worktree setup](docs/runbooks/worktree-setup.md). |
| Test login | `local` and `dev` builds embed the public development-instance test-account variables; preview and production never receive them. |
| Convex query caching | Mobile: `retention` flavor in `apps/mobile/src/convex/query-cache.tsx`, 5 min expiration, 20 idle entries; no disk cache (`last-known` not adopted). Web: not adopted. |
| Dependency updates | Exception to the weekly npm default: Dependabot proposes grouped npm minor/patch updates monthly. Weekly groups overlapped hand upgrades and were closed unmerged (#145, #148, #149, #154). Security updates are unaffected. |
| Core package build | Exception to [repo layout](docs/standards/repo-layout.md)'s raw `.ts` exports: `packages/core` builds ESM to `dist/` with tsup, with a `react-native` condition pointing Metro at `src/`. Dependent typecheck, test, build and E2E steps run `pnpm build:packages` first. Reason: #43 found raw `.ts` subpath exports unverified against Convex's bundler, and the `nutrition` entry keeps the shipped-food JSON out of the web and Convex bundles. No failing import is recorded; switching to raw `.ts` is a separate change that verifies Convex deploy, the Worker build, Metro and the CLI. |
| Pre-commit | Optional lefthook hook runs `biome check --staged` ([verification](docs/runbooks/verification.md)). |
| Observability | Shared Sentry feature; [Sentry operations](docs/runbooks/sentry.md) owns surfaces, projects, and sampling. |
