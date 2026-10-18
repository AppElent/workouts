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
| Web app stack, UI states, or browser capabilities | [Web baseline](docs/standards/web-baseline.md) |
| Expo setup, native configuration, builds, or releases | [Mobile baseline](docs/standards/mobile-baseline.md) |
| Verification | [Verification](docs/standards/verification.md), then the project's check commands |
| Environment variables and secrets | [Environments](docs/standards/environments.md) |
| Worktrees and isolated backends | [Workspaces](docs/standards/workspaces.md) |
| Authentication | [Auth](docs/standards/auth.md) |
| Localization | [i18n](docs/standards/i18n.md) |
| Error reporting and source maps | [Sentry monitoring](docs/standards/sentry-monitoring.md) |
| In-app problem reports | [Issue reporting](docs/standards/issue-reporting.md) |
| Pull-request previews | [Previews](docs/standards/previews.md) |
| Web manifest, installability, or service worker | [PWA](docs/standards/pwa.md) |
| Application CLI or browser login for it | [App CLI](docs/standards/app-cli.md) |
| MCP server or tools | [MCP](docs/standards/mcp.md) |
| Documentation or instruction changes | [Documentation](docs/standards/documentation.md) |
| Specialist tasks | [Specialist skills](docs/standards/specialist-skills.md) |

### Working with standards

- **Conform:** follow standards as written. Installed copies are never edited in the project.
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
| Environments | `pnpm env:*` runs `scripts/env.mjs`. See [environment](docs/runbooks/environment.md). |
| Worktrees | `scripts/setup-worktree.mjs` owns the lifecycle, not `scripts/workspace.mjs`. See [worktree setup](docs/runbooks/worktree-setup.md). Exception to per-worktree isolated resources: worktrees share the dev Convex deployment `colorless-sturgeon-704` by default, so a worktree is usable without provisioning and seeding its own backend; runtime writes are visible to every worktree, so use throwaway accounts for destructive checks. `pnpm setup:worktree -- --convex=cloud` provisions an isolated deployment when asked. |
| Test login | Non-production builds embed public test-account variables; a legacy exception pending an auth migration. |
| Convex query caching | Mobile: `retention` flavor in `apps/mobile/src/convex/query-cache.tsx`, 5 min expiration, 20 idle entries; no disk cache (`last-known` not adopted). Web: not adopted. Standard pending in [developer-tools#17](https://github.com/AppElent/developer-tools/pull/17). |
| Observability | Shared Sentry feature; [Sentry operations](docs/runbooks/sentry.md) owns surfaces, projects, and sampling. |
