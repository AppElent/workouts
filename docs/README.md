# Workouts documentation

Start with the [repository README](../README.md) for setup and commands.
[AGENTS.md](../AGENTS.md) routes implementation work to the applicable standards.

## Find the right document

| Need | Location and authority |
| --- | --- |
| General coding and platform design rules | [Shared guidelines](guidelines/shared/README.md), distributed from AppElent/developer-tools |
| Shared stack, feature setup, and toolkit scripts | [Toolkit implementation guides](features/README.md); installation does not mean a feature is enabled |
| Workouts coding, integrations, and design | [Project guidelines](guidelines/project/README.md); project decisions take precedence over shared defaults |
| Product vocabulary | [CONTEXT.md](../CONTEXT.md), the single domain glossary |
| Product behavior and feature briefs | [Product contracts](product/README.md); distinguish intended behavior from dated implementation inventories |
| Architectural trade-offs | [Architecture decisions](adr/README.md) |
| Setup, deployment, migrations, and operations | [Runbooks](runbooks/README.md) |
| Visual studies and design assets | [Design inventory](../designs/README.md); runtime tokens and project guidelines own shipped choices |
| Suggested changes awaiting agreement | [Proposals](proposals/README.md) |
| Checklists, verification reports, and device evidence | [Verification](verification/README.md); coverage is limited to each recorded build and device |
| Investigations supporting decisions | [Research](research/README.md) |
| Superseded plans, specs, reviews, and experiments | [Archive](archive/README.md); historical instructions are not current procedures |

Dataset provenance and generators stay beside their owners:
[NEVO](../data/nevo/README.md), [Lidl](../data/lidl/README.md),
[core nutrition](../packages/core/src/nutrition/README.md), and
[core exercises](../packages/core/src/exercises/README.md).
Configuration and source own versions, routes, schemas, and generated outputs.

## Ownership and maintenance

`guidelines/shared/` and `features/` are toolkit-managed. Change reusable guidance
in AppElent/developer-tools, then sync it; keep their installed paths stable.
Root coding/design standards and agent files contain managed blocks, with
project-owned reading pointers outside them. `guidelines/project/` owns the
Workouts-specific decisions those pointers select.

Place new documents by purpose using the table above. Give proposals and dated
records an explicit status and link their related contract or evidence. Keep
reports with their screenshots/recordings. Archive superseded material with its
assets and update incoming links rather than leaving forwarding pages throughout
the active tree. Retain a compatibility path only when a known consumer needs it.

Updating guidance does not migrate runtime integrations. Existing `appelent.json`
feature versions are legacy adoption records, not proof that migrations passed.
See [project coding decisions](guidelines/project/coding.md) for current exceptions
and [open proposals](proposals/README.md) for unresolved choices.
