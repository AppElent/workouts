# Workouts docs

Rules for placing, naming, and formatting documents:
[documentation standard](standards/documentation.md). Each folder
has a managed `.template.md` to copy. Every document's `description` says when to
read it: `grep -r "^description:" docs/standards docs/contracts docs/runbooks docs/adr`.

| Folder | Type | Lifetime |
| --- | --- | --- |
| `standards/` | `standard`: shared platform, capability, and pattern rules | Managed by developer-tools |
| `contracts/` | `contract`: intended behavior per area | Living, versioned |
| `adr/` | `decision`: hard-to-reverse trade-offs; number after the highest (gaps are intentional) | Immutable; superseded |
| `runbooks/` | `runbook`: procedures and project bindings | Living, versioned |
| `records/` | `record`: dated research, verification, reviews, specs, with their assets | Frozen |
| `agents/` | Pointers that engineering skills look up by path | — |
| `guidelines/shared/`, `features/` | Developer-tools output; edit upstream, then `node scripts/sync-devtools.mjs` | Managed |

Vocabulary: [GLOSSARY.md](../GLOSSARY.md). Design studies: [designs/](../designs/README.md).
Dataset provenance stays beside the data: [NEVO](../data/nevo/README.md),
[Lidl](../data/lidl/README.md), [core nutrition](../packages/core/src/nutrition/README.md),
[core exercises](../packages/core/src/exercises/README.md).

## Open records

Pending acceptance lives in each record's `## Open` section:

- [Personal Food, Recipes, estimates](records/2026-09-16-personal-food-recipes-estimates.md)
- [Nutrition prototype](records/2026-09-20-nutrition-prototype/README.md)
- [Endurance](records/2026-09-25-endurance.md)
- [Exercise library](records/2026-09-28-exercise-library/README.md)
- [Diary Entry editor](records/2026-10-04-diary-entry-editor/README.md)
- [Nutrition Diary](records/2026-10-06-nutrition-diary/README.md)
- [App redesign](records/2026-10-07-app-redesign/README.md)
- [Local data tools](records/2026-10-08-local-data-tools/README.md)
- [Sentry](records/2026-10-08-sentry-acceptance.md)
- [In-app test data](records/2026-10-10-in-app-test-data.md)
