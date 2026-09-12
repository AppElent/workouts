# Nutrition release 1 — implementation instructions

## Assignment

Implement the Clear and quick release in `apps/mobile`. Read this file, then execute tasks A, B, C in order. Each task has its own brief so a smaller model can concentrate on one change. Finish with integration verification. This is the concrete release-1 interpretation of PROPOSAL.md; later roadmap ideas are outside this assignment.

Outcome: a compact daily summary, readable search results, an accessible portion sheet with a persistent submit action, and logging several foods during one browser visit.

## Start here

1. Read the root AGENTS.md and CLAUDE.md, global instructions they reference, and any instructions inside modified directories. Use pnpm. Inspect git status and preserve unrelated changes.
2. Inspect current files before applying the brief: names below were verified on September 12, 2026. If code moved, locate the corresponding responsibility. Complete any already-satisfied requirement through verification rather than rewriting it.
3. Execute [A: daily summary](release-1/A-DIARY.md), [B: results and portions](release-1/B-PORTIONS.md), then [C: continued logging](release-1/C-LOGGING.md). Read the next task when ready. B and C modify the same component; execute sequentially.
4. Record completion and evidence in `release-1/IMPLEMENTATION-STATUS.md`: task, changed files, tests and results, unresolved issues, remaining device checks. Update this checkpoint after each task so another session can resume.

## Release boundaries

Use existing Convex mutations, source provenance, core arithmetic, and device storage contracts. This release needs no schema migration, new provider, new dependency, or generated-food changes. Leave preset calculation and goal editing behavior intact.

Favorites, remembered portions, meal copying, Combo navigation redesign, calendar picker, offline durable queue, recipes, AI, personalized goals and library sync belong to later releases. Existing Combo creation/logging stays reachable. The optional pinned-nutrient feature is deferred: the compact extra-goals disclosure covers release 1.

A new global Add food action is included. It uses the existing browser and a visible meal selector; date stays the selected diary date. Preserve meal-specific plus buttons. No intermediate chooser screen is needed.

## Shared behavior and design

- Use the mobile warm dark palette and lime action color in `apps/mobile/src/theme/tokens.ts`. Use existing text styles, spacing, Card, PrimaryButton, GhostButton and native route/modal patterns. Keep changes scoped to Nutrition.
- Treat energy and nutrients as recorded intake. Training remains a decorative marker and never changes the budget.
- Preserve all eight nutrients and `value`, `absent`, `trace` states. Arithmetic uses unrounded values and existing core helpers; round only for display. Missing nutrition is never zero.
- Keep min/max semantics, snapshot provenance, bilingual names, and required attribution. All new copy belongs in the existing English/Dutch message system; inspect `src/i18n/index.tsx` and the locale parity tests to find authoritative files.
- Ordinary search remains local. Online search remains explicit. Keep personal-food fork precedence and barcode import review.
- Every asynchronous mutation retains user input on failure, reports an error, and prevents duplicate submission. Confirm existing destructive actions through the shared mechanism.
- Primary controls have at least 44-point touch targets, useful accessible labels, and large-text layout. Use visible buttons in addition to gestures. Reuse reduced-motion/haptics helpers.
- Do not claim that a pending network request is saved locally. Durable offline work is a later release.

## Integration verification

Use the package scripts currently declared on disk. At briefing time, the useful commands from the repository root are:

```powershell
pnpm build:packages
pnpm --filter @workouts/mobile typecheck
pnpm --filter @workouts/mobile test --runInBand
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Root tests use Vitest; mobile tests use Jest. During each task, run focused mobile tests using `pnpm --filter @workouts/mobile test --runInBand --runTestsByPath src/screens/<file>.test.tsx`. Broaden to the full checks once integrated. If core logic changed, run the core package tests too. Record pre-existing failures with evidence; never weaken a test to hide them. Update assertions for intentionally changed UI while retaining behavioral coverage.

Device checks: standard and small iPhone viewport, default and accessibility text sizes, keyboard visible in portion sheet, Dutch, VoiceOver, Reduce Motion, and equivalent Android back/keyboard behavior. Save before/after screenshots where available. If native testing is unavailable, finish code and automated verification, then explicitly mark those checks outstanding. A web preview cannot prove native keyboard/sheet correctness.

Completion means all three tasks integrated, appropriate tests passing or accurately accounted for, three foods log in one browser visit, no unit ambiguity, no duplicate submits, and every visible primary action accessible. Report exactly what remains unverified. Commit/push/deployment and starting another task are not part of this implementation brief unless requested separately.

## Model choice and launch prompt

Recommended for an entire release: Codex `gpt-5.6-terra`, medium effort initially. This is specified feature implementation spanning interactive states. Luna at high effort is a reasonable lower-tier option when executing one brief at a time with the checkpoint and tests. High effort is a deliberate increase from Luna's medium default for these interaction edge cases; it is not a guarantee of correctness. Have the integrated diff and native UI reviewed separately.

The local roster fetched 2026-09-12 and installed Codex CLI 0.154.0 both support these choices. Commands:

```powershell
codex --model gpt-5.6-luna -c model_reasoning_effort="high"
codex --model gpt-5.6-terra -c model_reasoning_effort="medium"
```

Paste-ready instruction:

> Implement Nutrition release 1 following `qa/triage/2026-09-11-virtuafood/RELEASE-1.md`. Complete A, B and C sequentially, loading each brief when needed. Implement and verify each task before advancing; keep IMPLEMENTATION-STATUS.md current. Continue through all three tasks without asking me to reapprove the brief. Preserve unrelated changes. Finish with the documented integration checks and state any native checks you could not run. Do not implement later roadmap releases.
