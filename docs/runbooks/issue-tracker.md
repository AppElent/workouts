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
GitHub also cancels the Linear issue (observed on APP-14, 2026-11-12). Change
status in Linear.

**PRs as a request surface: no.** External PRs are not triaged as feature requests.
PRs live on this checkout's GitHub remote.

## Triage labels

Skill role names map to Linear labels and statuses:

| Role | In Linear | Meaning |
| --- | --- | --- |
| `needs-triage` | Status Backlog, no `ready-*` label | Maintainer needs to evaluate this issue |
| `needs-info` | `ready-for-human`, plus a comment naming the missing information | Waiting on Eric or the reporter |
| `ready-for-agent` | `ready-for-agent` label | Sharp, testable acceptance criteria and a blast radius; an agent can pick it up |
| `ready-for-human` | `ready-for-human` label | Eric must do or decide something; a comment says what, where, and roughly how long |
| `wontfix` | Status Canceled, with a comment saying why | Will not be actioned |

Every issue also carries `app:foundry` and a blast radius (`low`, `med`, or
`high`). See the Factory workflow in [AGENTS.md](../../AGENTS.md#factory-workflow).
