---
version: 1.0.0
description: Classify instructions and maintain one authoritative owner.
---

# Documentation ownership

Classify each rule before adding or moving it:

| Content | Owner |
| --- | --- |
| Personal working preferences across repositories | Global AGENTS.md |
| Reusable engineering or platform behavior | Shared coding/design guidelines |
| Optional capability, setup, and operational mechanism | Shared feature guide |
| Reusable interaction and its variants | Shared design pattern |
| Product identity, domain behavior, adoption bindings, or justified deviation | Project standards or product contract |
| Deployment identities and local procedures | Project runbook |
| Hard-to-reverse, surprising trade-off rationale | ADR |
| Dated findings, runtime evidence, superseded plans | Research, verification, or archive |

Challenge every local rule: if product nouns, identifiers, and paths are removed,
would another project make the same decision? Extract the reusable contract and
retain only the binding or deviation. A feature can be shared without requiring
all projects to enable it. A design pattern can be shared without a component package.
Mark a candidate as proposed until adopted; keep runtime-specific workarounds tied
to their observed version and evidence.

AGENTS.md routes tasks to standards. CLAUDE.md delegates to AGENTS.md at both
global and project scope. Coding instructions belong in CODING_STANDARDS.md;
visual and interaction decisions belong in DESIGN_SYSTEM.md. These select relevant
platform and feature references. Each pointer names its trigger; detail files do
not require readers to return to a parent index.

Delete instructions that do not change a decision, repeated indexes, and caches
of cheap config/source lookups. Preserve rationale and non-obvious hazards.
Give each rule one authoritative owner. Move its incoming links with it; preserve
unresolved acceptance and colocated evidence when archiving. Shared files are
edited in developer-tools and distributed with receipts; project files select
shared defaults and state each exception's scope, replacement, and reason.

Check moved links, required-reading paths, and managed-file ownership. Documentation
changes do not establish runtime acceptance.
