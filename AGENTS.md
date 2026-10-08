# AGENTS.md

Read [README.md](README.md) for setup and commands, and [docs/README.md](docs/README.md) for current project contracts and runbooks.
Read [CONTEXT.md](CONTEXT.md) when changing domain behavior. For mobile work, also follow [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md).

Dependency upgrades follow [.claude/commands/upgrade-deps.md](.claude/commands/upgrade-deps.md). Verify application changes with [.claude/skills/verify/SKILL.md](.claude/skills/verify/SKILL.md).

<!-- appelent-guidelines:start -->
Before implementing or reviewing code, read CODING_STANDARDS.md.
For UI work, also read DESIGN_SYSTEM.md. Follow their task-specific links.
Read docs/features/README.md for feature implementation and toolkit scripts.
<!-- appelent-guidelines:end -->

## Agent skills

### Issue tracker

Issues live in GitHub Issues for AppElent/workouts, managed with `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` is the glossary, decisions live in `docs/adr/`. See `docs/agents/domain.md`.
