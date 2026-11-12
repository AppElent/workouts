---
type: runbook
description: Read when creating, labelling, or triaging issues.
version: 2.0.0
---

# Foundry issue tracker

Work lives in Linear: workspace `appelent`, team AppElent (key `APP`), project
Foundry, label `app:foundry`. Requests and PRDs are Linear issues, not GitHub
issues. Map and child-issue conventions come from the wayfinder skill when
running that workflow.

Some older GitHub issues are linked to a Linear issue through Linear's GitHub
sync. Such a GitHub issue is a mirror, not a second tracker: closing it on
GitHub also closes the Linear issue. Change status in Linear.

**PRs as a request surface: no.** External PRs are not triaged as feature requests.
Resolve the repository from this checkout's remote.

## Triage labels

Skill role names map one-to-one to Linear labels:

| Label | Meaning |
| --- | --- |
| `ready-for-agent` | Sharp, testable acceptance criteria and a blast radius; an agent can pick it up |
| `ready-for-human` | Eric must do or decide something; a comment says what, where, and roughly how long |

Every issue also carries `app:foundry` and a blast radius (`low`, `med`, or
`high`). See the Factory workflow in [AGENTS.md](../../AGENTS.md#factory-workflow).
