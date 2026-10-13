---
type: runbook
description: Read when creating, labelling, or triaging GitHub issues.
version: 1.0.1
---

# Workouts issue tracker

Requests and PRDs live in this repository's GitHub issues. Map and child-issue
conventions come from the wayfinder skill when running that workflow.

**PRs as a request surface: no.** External PRs are not triaged as feature requests.
Resolve the repository from this checkout's remote.

## Triage labels

Skill role names map one-to-one to tracker labels:

| Label | Meaning |
| --- | --- |
| `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | Requires human implementation |
| `wontfix` | Will not be actioned |

