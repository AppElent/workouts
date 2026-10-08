# Workouts documentation

| Task | Authority |
| --- | --- |
| Setup | [Repository README](../README.md) |
| Coding and platform architecture | [CODING_STANDARDS.md](../CODING_STANDARDS.md) |
| Visual identity and interaction adoption | [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) |
| Vocabulary and product behavior | [CONTEXT.md](../CONTEXT.md), then [product contracts](product/README.md) |
| Architectural trade-offs | [ADRs](adr/README.md) |
| Deployment, integration bindings, and operations | [Runbooks](runbooks/README.md) |
| Optional reusable capabilities | [Toolkit feature index](features/README.md) |
| Acceptance by recorded revision/device | [Verification evidence](verification/README.md) |
| Design studies | [Design inventory](../designs/README.md) |
| Pending decisions, investigations, history | [Proposals](proposals/README.md), [research](research/README.md), [archive](archive/README.md) |

## Ownership

Apply shared [documentation ownership](guidelines/shared/general/documentation.md)
when editing guidance. `guidelines/shared/` and `features/` are toolkit outputs;
change their developer-tools sources and sync. Root standards own Workouts
adoption and exceptions outside their managed blocks. Agent files only route work.

Product contracts own intended domain behavior; dated reports retain implementation
observations and unresolved acceptance. Dataset provenance stays with
[NEVO](../data/nevo/README.md), [Lidl](../data/lidl/README.md),
[core nutrition](../packages/core/src/nutrition/README.md), and
[core exercises](../packages/core/src/exercises/README.md).

`docs/agents/` retains thin adapters required by the engineering skills; their
policies live in coding standards and the issue-tracker runbook.
