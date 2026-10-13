---
type: standard
kind: platform
description: Read when adding, moving, or reviewing documentation or agent instructions.
version: 2.0.0
applies_to: [all]
---

# Documentation

Every rule has one owner, every document has one type, and readers find the right
file from its folder and frontmatter.

## Rules

### Owners

- **Required:** give each rule one owner. Remove product nouns and paths: if another
  project would decide the same, it belongs in a shared standard and the project
  keeps only its binding. Shared files change only through a developer-tools PR.

| Content | Owner |
| --- | --- |
| Personal preferences across repositories | Global AGENTS.md |
| Reusable engineering, design, or interaction rules | Shared standard or guideline |
| Project adoption, bindings, deviations (rule, scope, replacement, reason) | `CODING_STANDARDS.md`, `DESIGN_SYSTEM.md` |
| Domain vocabulary | `GLOSSARY.md` |
| Everything else | One document type below |

- **Required:** AGENTS.md routes tasks and names each trigger; CLAUDE.md delegates
  to it.
- **Default:** delete text that changes no decision and facts that config or source
  already states. Keep rationale and hazards.

### Types

| Type | Answers | Lifetime | Location |
| --- | --- | --- | --- |
| `standard` | What must hold for this platform, capability, or pattern? | Living; shared | `docs/standards/<name>.md` |
| `contract` | How should this feature behave? | Living | `docs/contracts/<area>.md` |
| `decision` | Why this hard-to-reverse trade-off? | Immutable | `docs/adr/NNNN-<slug>.md` |
| `runbook` | How do I perform or bind this here? | Living | `docs/runbooks/<task>.md` |
| `record` | What did we find or observe, when? | Frozen | `docs/records/YYYY-MM-DD-<slug>.md` |

- **Required:** projects do not edit standards.
- **Required:** `docs/README.md` is the only index: folders and open records.
  Frontmatter descriptions replace per-folder indexes.
- **Default:** names are lowercase kebab-case. A record's `kind` is `research`,
  `verification`, `review`, `plan`, or `spec`. Design studies live in `designs/`.

### Frontmatter and versions

- **Required:** every document has `type`, `description` (one line naming the
  reader's trigger), and `version`. Per type:

| Type | Also |
| --- | --- |
| `standard` | `kind`: platform, capability, pattern; `applies_to` |
| `contract` | `status`: draft, current |
| `decision` | `status`: proposed, accepted, superseded; `date`; `superseded_by` |
| `record` | `kind`; `status`: open, closed; `date` |

- **Required:** version living documents: major when a relied-on rule, behavior, or
  step changes or is removed, minor when one is added, patch for wording. Decisions
  and records change only by patch. Never change an accepted decision's substance;
  add a new one and mark the old one superseded.

### Lifecycle

- **Required:** a record holds pending acceptance in one `## Open` section and stays
  `open` until it is empty. Closed records are frozen; new evidence is a new record.
- **Required:** before deleting a superseded contract or runbook, move its unresolved
  acceptance to an open record. Git keeps history.
- **Default:** a plan or spec is a record; its lasting behavior moves into a contract.

## Implementation

1. Copy the folder's managed `.template.md` (this folder's is [the standard
   template](.template.md)) and start at `version: 1.0.0`.
2. A document with assets is a folder: `<name>/README.md` for records,
   `<name>/examples/` for standards. Commit only assets it cites.
3. Moving a document moves its incoming links in the same change.
4. List open records in `docs/README.md`; remove them when closed.

## Verify

- Every file under `docs/{standards,contracts,adr,runbooks,records}` starts with the
  required frontmatter for its type.
- Relative links resolve, including from AGENTS.md and the root standards.
- Each open record has a non-empty `## Open` section and is listed in `docs/README.md`.
- Documentation changes do not establish runtime acceptance.

## Exceptions

None expected. Record any in `CODING_STANDARDS.md`: rule, scope, replacement, reason.
