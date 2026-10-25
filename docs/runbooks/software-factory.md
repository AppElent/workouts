---
type: runbook
description: Read when labelling an issue for the agent, reviewing a factory PR, or adding a factory task.
version: 1.0.0
---

# Software factory

Foundry's factory turns labelled GitHub issues into draft PRs. Its terms (task,
trigger, run, runner, and the service slots) follow Matt Pocock's
[`software-factory` skill](https://github.com/mattpocock/skills/pull/1316). It starts
with one task, the implementer, and grows by adding one throttled task at a time.

## Prerequisites

- The [Claude GitHub App](https://github.com/apps/claude) installed on this repository.
  Its token pushes and opens PRs, so CI runs on them; `GITHUB_TOKEN` events start no workflows.
- Actions secret `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`.

## Project facts

| Service | Product |
| --- | --- |
| Ticket tracker | GitHub Issues, routed by the [triage labels](issue-tracker.md#triage-labels) |
| Ticket source | None yet; humans file issues |
| Git host | GitHub |
| Orchestrator | GitHub Actions |
| Runner | `ubuntu-latest` Actions runner, fresh per run |
| Observability platform | None: the Actions run page |

| Task | Workflow | Trigger | Does | Triggers next |
| --- | --- | --- | --- | --- |
| Implementer | `.github/workflows/factory-implementer.yml` | The owner adds `ready-for-agent` to an issue | Builds the issue on `factory/issue-<N>` until checks pass and opens a draft PR | CI and the PR preview, through the app token |

Implementer answers to the design questions:

- **Reads and writes:** the issue and its comments; the repository; one branch and one draft PR.
- **Human re-entry:** a question on the issue with `needs-info`; a failed or timed-out run comments
  the run link and sets `needs-triage`; every PR is a draft a human reviews and merges.
- **Duplicate work:** the run swaps `ready-for-agent` for `agent-working` before starting, skips
  when its branch already exists, and the concurrency group allows one run at a time.
- **Limits:** 60-minute timeout; one try per label. The run sees only the OAuth token and the app
  token, so deploys, Convex, and runtime acceptance stay with humans.

## Steps

1. Write the issue as a full spec: behavior, acceptance checks, and affected area.
2. Add `ready-for-agent`. Label one issue at a time; GitHub drops all but the newest pending run.
3. Review the draft PR like any other, including its pending runtime checks, then mark it
   ready and merge.
4. To retry, answer the questions or fix the spec, delete any stale `factory/issue-<N>` branch,
   and relabel `ready-for-agent`.

Add tasks one at a time, each after the last has earned trust. Candidates in order: automated
review on factory PRs, Sentry feedback as a ticket source with an explore task, and a nightly
architecture task. Record each in the tables above with its answers.

## Verify

- Labelling a test issue starts a "Factory implementer" run, and the issue shows `agent-working`.
- The run ends with a draft PR that closes the issue, and CI runs on it.

## Troubleshooting

- No run starts: only the repository owner's label triggers it; check the label name.
- PR opened but no CI: the push used `GITHUB_TOKEN`; confirm the Claude GitHub App is installed
  and the job keeps `id-token: write`.
- Run skipped with a branch comment: a previous run left `factory/issue-<N>`; finish or delete it.
