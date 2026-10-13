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
| `runbooks/` | `runbook`: project facts for a repeatable task, read by its standard or skill | Living, versioned |
| `records/` | `record`: dated evidence cited by a contract or ADR; follow-ups are GitHub issues | Frozen |
| `agents/` | Pointers that engineering skills look up by path | — |

Vocabulary: [GLOSSARY.md](../GLOSSARY.md). Design studies: [designs/](../designs/README.md).
Dataset provenance stays beside the data: [NEVO](../data/nevo/README.md),
[Lidl](../data/lidl/README.md), [core nutrition](../packages/core/src/nutrition/README.md),
[core exercises](../packages/core/src/exercises/README.md).
