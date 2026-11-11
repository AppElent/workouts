# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Foundry is a training and nutrition tracker: web (`src/`), Convex backend
(`convex/`), Expo phone app (`apps/mobile/`), shared `@foundry/core`
(`packages/core/`). pnpm, always.

Before the task, read the matching project doc:

| When you are… | Read |
| --- | --- |
| Changing native code in `apps/mobile/` | [Mobile coding standards](apps/mobile/CODING_STANDARDS.md), and [its design system](apps/mobile/DESIGN_SYSTEM.md) for UI |
| Changing data ownership, saving, caching, Convex usage, or local-data migration | [Account data](docs/contracts/account-data.md) |
| Changing Training, Start activity, Strength Sessions, the set editor, Set Drafts, or strength references | [Training](docs/contracts/training.md) |
| Changing Run or Ride logging, Activity history, or endurance progress | [Endurance](docs/contracts/endurance.md) |
| Changing Log food, the Diary Entry editor, Servings, or One-off Entries | [Nutrition logging](docs/contracts/nutrition-logging.md) |
| Changing the Nutrition Diary, weekly review, Nutrition Goals, Capture Drafts, or diary corrections | [Nutrition diary](docs/contracts/nutrition-diary.md) |
| Changing the food library, Personal Foods, Recipes, Nutrition Estimates, Combos, or Personal Measures | [Nutrition foods](docs/contracts/nutrition-foods.md) |
| Changing Profile, settings, account actions, or sign-out | [Profile](docs/contracts/profile.md) |
| Changing in-app Load or Clear test data | [Test data](docs/contracts/test-data.md) |
| Running checks, dev servers, or test login, or verifying a change | [Verification](docs/runbooks/verification.md), or the `verify` skill |
| Accepting a mobile change on an iPhone or simulator | [iOS acceptance](docs/runbooks/ios-acceptance.md) |
| Building a development client, shipping to TestFlight, or publishing an OTA update | [Mobile releases](docs/runbooks/mobile-releases.md) |
| Adding or changing an environment variable or secret | [Environment](docs/runbooks/environment.md) |
| Creating a worktree or its isolated Convex deployment | [Worktree setup](docs/runbooks/worktree-setup.md) |
| Deploying staging or production, or changing `deploy.yml`, the deploy scripts, or `wrangler.jsonc` | [Deploy](docs/runbooks/deploy.md) |
| Changing error reporting, source maps, or the `*_SENTRY_*` variables | [Sentry](docs/runbooks/sentry.md) |
| Configuring Apple, Google, or Microsoft sign-in | [Social sign-in](docs/runbooks/social-sign-in.md) |
| Using or changing the Foundry MCP server | [MCP](docs/runbooks/mcp.md) |
| Running a data migration | [Exercise IDs](docs/runbooks/exercise-migration.md), [nutrition account storage](docs/runbooks/nutrition-account-migration.md) |
| Creating or adopting a design study | [Design studies](docs/runbooks/design-studies.md) |
| Upgrading dependencies | The `upgrade-dependencies` skill, with [Foundry's upgrade facts](docs/runbooks/dependency-upgrades.md); never weaken or skip a test to make an upgrade pass — stop and report |
| Taking a pull request through review and CI | The `babysit-pr` skill |
| Reviewing the app, or capturing a review the user leads | The `review-app` skill |

Domain terms: [GLOSSARY.md](GLOSSARY.md). Decisions: [`docs/adr/`](docs/adr/).
Adding, moving, or finding docs: [docs map](docs/README.md). Issues are GitHub
Issues on `AppElent/workouts`; engineering skills read [docs/agents/](docs/agents/issue-tracker.md).

## Factory workflow

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth. Work is a Linear issue with an app label and a blast radius.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <bot or fallback>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one). Do not merge the PR yourself.

End your report with a **Leftover work** heading listing everything found but left out of scope, without fixing it.

Blast radius (`low` / `med` / `high`, also `blast-radius:low|med|high` on the PR):

- low: UI, copy, tests, refactors within one module, docs.
- med: data model changes with migration and rollback, new dependencies, CI/workflows, shared behaviour across several screens.
- high: auth, payments, production config, secrets, deleting data, permissions, anything affecting other users without a way back.

Agents never merge med or high PRs. Never read or change production secrets, and never approve production deployments.
