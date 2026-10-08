---
version: 1.0.0
description: GitHub issue tracking and optional map/child workflow conventions.
---

# Issue tracking

Use when a project selects GitHub issues for requests, PRDs, or investigation
maps. Resolve the repository from its remote; use the installed gh help for
command syntax. Read the issue body, labels, and relevant comments before work.
For multiline writes, pass exact text through a body file. Creating/commenting
on issues follows the user's authorized workflow; this guide alone authorizes
no external communication.

Project runbooks select the tracker and whether external PRs are a request
surface. GitHub issues and PRs share numbers; resolve the resource type before
acting. A disabled PR-triage branch needs no copied PR workflow in the project.

## Optional map workflow

Use only when the project adopts the wayfinder conventions. A map is one issue
labelled `wayfinder:map` with Notes, Decisions-so-far, and Fog. Child issues use
`wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
Link children as sub-issues; where unavailable, use a task list in the map and
`Part of #<map>` in the child.

Represent blocking with native issue dependencies. API references use an issue's
numeric database ID, not its displayed number or node ID; inspect current API
support before adding edges. Where unavailable, keep `Blocked by: #<n>` at the
top of the child. A child is available when all blockers are closed and it is
unassigned. Select the first available child in map order.

Claim by assigning the driving developer before implementation. On completion,
record the answer, close the child, and add a concise result/link to the map's
Decisions-so-far. Preserve unresolved blockers and distinguish evidence from plans.
