# AGENTS.md

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
<!-- appelent-guidelines:end -->

Foundry is a training and nutrition tracker (web, Convex, Expo phone app, shared `packages/core`). pnpm, always.

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
| Merging a pull request that changes `convex/` or `packages/core/` | [Shared dev deployment](docs/runbooks/deploy.md#shared-dev-deployment): run `pnpm convex:push-dev` from the new `origin/main` |
| Changing error reporting, source maps, or the `*_SENTRY_*` variables | [Sentry](docs/runbooks/sentry.md) |
| Configuring Apple, Google, or Microsoft sign-in | [Social sign-in](docs/runbooks/social-sign-in.md) |
| Using or changing the Foundry MCP server | [MCP](docs/runbooks/mcp.md) |
| Creating or adopting a design study | [Design studies](docs/runbooks/design-studies.md) |
| Upgrading dependencies | The `upgrade-dependencies` skill, with [Foundry's upgrade facts](docs/runbooks/dependency-upgrades.md); never weaken or skip a test to make an upgrade pass — stop and report |
| Taking a pull request through review and CI | The `babysit-pr` skill |
| Reviewing the app, or capturing a review the user leads | The `review-app` skill |

`upgrade-dependencies` and `review-app` are toolkit skills from developer-home
[`skills/`](https://github.com/AppElent/developer-home/tree/main/skills), installed
globally with `npx skills add`. `babysit-pr` is not in the toolkit and is installed
only on Eric's Mac; without it, follow the runbook's
[Review by risk tier](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md#review-by-risk-tier).

Domain terms: [GLOSSARY.md](GLOSSARY.md). Decisions: [`docs/adr/`](docs/adr/).
Adding, moving, or finding docs: [docs map](docs/README.md). Engineering skills read [docs/agents/](docs/agents/issue-tracker.md).

## Factory workflow

The [factory runbook](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md) (on the Mac: `~/Developer/developer-home/RUNBOOK.md`) owns this process; where this section differs, the runbook wins.

Linear (workspace `appelent`, team AppElent, key `APP`) is the source of truth; an issue has the app label and a blast radius. Track work there, never as GitHub Issues.

- `ready-for-agent`: the issue has sharp, testable acceptance criteria and a blast radius, so an agent can pick it up.
- `ready-for-human`: Eric must do or decide something. Add a comment saying what, where, and roughly how long.
- The moment you start a T3 thread for an issue, post a Linear comment `T3 thread: <title> (<thread id>), started by <hub, grok, or claude-code>` and move the issue to In Progress. An issue with such a comment is taken; do not start a second thread for it.

Work in a worktree from `origin/main` on a branch `<type>/app-123-short-slug` (type: feat, fix, refactor, chore, docs, or test). Put `Fixes APP-123` in the PR description. End in a PR with tests (and a PR preview where the repo has one).

Blast radius, which is also the review tier (`Risk: low|med|high` with one line why in the PR body, and `blast-radius:low|med|high` on the PR; when in doubt, pick the higher tier):
- low: copy, styling, small fixes, tests, refactors within one module, docs.
- med: new features (for example a game), UI flows, new dependencies, shared behaviour across several screens.
- high: Convex schema, data migrations, deleting data, auth, permissions, payments, production config, secrets, CI or deploy config, large dependency upgrades (an Expo SDK or a major framework version), and anything that can break the installed mobile apps or affect other users without a way back.

The Linear `Blast radius` label leads; the PR label and `Risk:` line mirror it, so a re-tier changes Linear first. `high` is the one risk reason for Eric's card; there is no `council` or `follow-up` label.

Review the PR in this same thread as the runbook's [Review by risk tier](https://github.com/AppElent/developer-home/blob/main/RUNBOOK.md#review-by-risk-tier) says: `low` is green CI plus your self-check against the acceptance criteria; `med` and `high` get read-only reviewer subthreads, never separate review or council threads. The Codex GitHub review is advisory: address its comments, do not wait for it. Post the review on the PR, fix blockers, and end your final message with `Review verdict (<tier>): PROCEED` or `REVISE` with the open blockers, then a **Leftover work** heading listing everything found but left out of scope, without fixing it.

UI changes follow [general design](docs/standards/general-design.md): screenshots in the PR, and new screens or flows wait for Eric's approval before merge.

Coding agents never merge; the manager merges per the runbook. Never read or change production secrets, and never approve production deployments.
