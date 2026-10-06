# Workouts documentation

Start with the repository [README](../README.md) for setup/commands,
[AGENTS.md](../AGENTS.md) for agent entry points, and the standards below for
implementation rules. Configuration and source own versions, routes, schemas,
and generated outputs; old plans do not override them.

## Ownership

| Content | Owner / location |
| --- | --- |
| Cross-project behavior | [Shared guidelines](guidelines/shared/README.md); canonical source is AppElent/developer-tools. |
| Common stack, TanStack web, Expo mobile | [Feature index](features/README.md), especially the three baselines. |
| Workouts integrations and exceptions | [CODING_STANDARDS.md](../CODING_STANDARDS.md), outside its managed block. |
| Workouts visual identity and component seams | [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) and [mobile design system](../apps/mobile/DESIGN_SYSTEM.md). |
| Product vocabulary | [CONTEXT.md](../CONTEXT.md), the single domain glossary. |
| Durable architectural trade-offs | `adr/`; use the shared ADR criteria before adding one. |
| Current operational procedures | Runbooks below; retain actual environment/identity choices. |
| Dated observations, plans, and proposals | [Archive](archive/README.md), research, and verification reports; status claims are historical. |

Edit toolkit guidance at its source, version it, then sync it. Project overrides
name the rule, scope, replacement, and reason. Installing guides/scripts does not
migrate app code or enable a feature. `appelent.json`'s existing feature versions
are legacy adoption records, not evidence that the new runtime migrations passed.

## Current runbooks

- [Environment routing](environment.md): manifest, Infisical sources, destinations,
  and existing legacy `pnpm env:*` aliases.
- [Worktree setup](worktree-setup.md): isolated Convex resources and mobile URL routing.
- [Mobile releases](mobile-releases.md): development clients, TestFlight, OTA,
  environment/runtime compatibility, and local/cloud preflight.
- [Mobile Sentry](mobile-sentry.md): the app's project, credentials, native build,
  source maps, and version exception.
- [Exercise migration](exercise-migration.md): operator dry run, rollout, resume,
  and verification. Preserve this while old clients/history may need it.
- [MCP endpoint](mcp.md): Workouts tools and client authentication.
- [Project verification](../.claude/skills/verify/SKILL.md): target checks and
  browser/device acceptance.
- [Issue tracker](agents/issue-tracker.md): Workouts ticket conventions.

## Domain and implementation references

Accepted boundaries live in [Activity families](adr/0001-closed-activity-family.md),
[local-first nutrition](adr/0005-local-first-nutrition-with-durable-history.md),
[shipped foods](adr/0006-ship-nevo-as-generated-core-data.md),
[hosted ownership](adr/0008-hosted-workout-ownership.md), and
[shipped exercises](adr/0009-shipped-exercise-catalog.md), and
[personal Servings for Shipped Foods](adr/0010-personal-servings-for-shipped-foods.md).

Dataset provenance and generators remain with their owners:
[NEVO](../data/nevo/README.md), [Lidl](../data/lidl/README.md),
[core nutrition](../packages/core/src/nutrition/README.md), and
[core exercises](../packages/core/src/exercises/README.md).
[Food benchmarks](research/nutrition-shipped-food-benchmark.md) and
[NEVO identity research](research/nevo-code-stability.md) support those choices;
read them for their stated dataset/revision, not as general coding standards.

## Briefs and acceptance evidence

Briefs describe a feature's intended contract; they are not alternative standards.
Check current source and paired reports before treating their “current state” or
completion language as current.

- [Run/ride brief](briefs/running-cycling-v1.md) and
  [dated endurance verification](reports/endurance-verification.md).
- [Personal Food/Recipe/estimate brief](briefs/personal-food-recipes-estimates.md)
  and [implementation record](briefs/personal-food-recipes-estimates-completion.md).
- [Capture Draft brief](briefs/capture-drafts-in-diary.md); the dedicated draft
  repository and diary UI now exist. Its pre-implementation inventory is historical.
- [iOS acceptance checklist](ios-native-verification.md): record results by build
  and device; an unchecked row is not a passed release check.
- [Nutrition prototype/evidence](prototypes/nutrition/README.md),
  [review](prototypes/nutrition/REVIEW.md), and
  [SQLite lifecycle regression](prototypes/nutrition/SQLITE-REVIEW.md).
- [Exercise library design](../designs/exercise-library/README.md) and
  [implementation/device evidence](../designs/exercise-library/IMPLEMENTATION.md).
- [Foundry design assets](../designs/foundry/readme.md); supporting component
  prompts and mockups describe design intent, not a second runtime implementation.

Old specs, implementation plans, early assessments, and review notes are in the
[archive](archive/README.md). Original paths forward to their archived copies.
Evidence and unresolved acceptance work are retained rather than marked complete.

## Decisions still to settle

- Whether Convex + Clerk should be cross-project defaults or remain feature choices.
  Workouts uses both; the shared baselines currently leave the provider choice open.
- How to retire legacy runtime packages and wrappers. Each needs its own import,
  configuration, tests, and runtime migration; guidance sync does not do that work.
- Replace public-build test-login credentials with a server-side or locally
  controlled test mechanism. Existing non-production placement is a project
  exception, not a shared authentication standard.

- [Labs Diary Entry implementation and verification](reports/diary-entry-editor-implementation.md):
  spec #91, first feature-folder adoption, file ownership, and native acceptance limits.

- [Live Nutrition Diary redesign](reports/nutrition-diary-redesign-implementation.md):
  production routes, folder ownership, targeted nutrient corrections, and verification.
