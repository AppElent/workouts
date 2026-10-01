---
version: 1.3.0
description: Install and update the complete AppElent toolkit without a developer CLI package.
---

# Toolkit distribution

Requires Node 22.15+ and GitHub CLI authenticated with access to AppElent/developer-tools. Copy a reviewed scripts/sync-devtools.mjs into the project's scripts directory. No adjacent checkout or npm package installation is needed.

```sh
node scripts/sync-devtools.mjs --dry-run
node scripts/sync-devtools.mjs
node scripts/sync-devtools.mjs --check
```

All distributed scripts, platform guidelines, feature guides, and examples/templates are installed. Updates resolve main once and fetch every file from that commit. `--ref <branch|tag|commit>` is retained in the receipt; `--ref main` returns to the default source. `--check` is offline drift detection; use `--dry-run` to discover upstream changes.

Commit installed files and .appelent/devtools.json. Keep credentials outside Git. Sync never executes downloaded code, provisions resources, enables a feature, or migrates application code. Review a change before running updated scripts.

## Ownership and conflicts

Shared guides, scripts, and source templates are toolkit-owned. CODING_STANDARDS.md and DESIGN_SYSTEM.md are project-owned: sync creates them when missing, then updates only their appelent-standards blocks. These blocks enumerate all shared guideline/feature files and explain script ownership and reading triggers. Local content outside the blocks may change freely. Workflows/components created from templates belong to the application. Project guidance and content outside managed agent blocks are preserved. Changed toolkit files stop the entire update before content writes; reconcile deliberately rather than deleting receipts. Existing identical files can be adopted without overwriting them.

A legacy .appelent/guidelines.json receipt supplies ownership for unchanged files during first adoption and is retained as historical evidence. New offline checks use .appelent/devtools.json, which records standards block hashes instead of whole-file hashes. An older whole-file receipt is migrated only when that file is unchanged. Existing project-coding.md, project-design.md, and app.md are preserved; move their decisions into the root files when migrating that project. New installs do not create those extra decision files.

Writes are individually atomic, not a cross-file transaction. Interrupted writes leave .appelent/devtools-pending.json. Run `node scripts/sync-devtools.mjs --recover` to restore pre-update contents, then retry. Recovery refuses concurrent edits. If a process was killed, first verify no sync is running before removing a stale .appelent/devtools.lock directory. Do not delete the pending journal to bypass recovery.

The updater updates itself; its new implementation runs on the next invocation.

## Skills

Skills are installed separately with the [skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add https://github.com/AppElent/developer-tools/tree/main/skills --list
npx skills add https://github.com/AppElent/developer-tools/tree/main/skills --skill '*' -a codex claude-code -g
npx skills check
npx skills update
```

Omit -g for project installation. This updater does not inspect, install, update, or remove skills. Existing project skill copies from an older toolkit receipt are preserved and released from toolkit ownership on the next update, including copies now replaced by external-installer symlinks. Reconcile duplicates through the skills CLI. Old home-scope receipts belong to the retired installer and are no longer updated.

## Local development

`--source /path/to/developer-tools` uses the checked local distribution without fetching or executing it. Its receipt says local and records no machine path. Subsequent normal updates fetch the retained Git ref. Only committed and pushed source is available through GitHub.

## Existing projects

Updating a feature guide is not proof of application migration. Read the changed feature's migration notes if used, inspect actual app code, apply the relevant correction, and run its checks. Portable baseline, environment, workspace, and read-only project-check scripts are now available. Follow their feature guides; old CLI/package dependencies remain until each consuming project migrates and verifies them.

## Migrating from earlier updaters

Copy the current reviewed scripts/sync-devtools.mjs once before upgrading: distribution schema 2 excludes skills and old bootstraps refuse it before self-update. Remove --scope, --agent, and --skill-scope options; install skills with npx skills separately. Existing project receipts remain readable. Pending updates must be recovered before upgrading; this updater retains recovery support for earlier journals.

The separate sync-guidelines bootstrap and adjacent developer CLI launcher are retired. Existing legacy guideline receipts still establish ownership of unchanged guideline files during adoption. Runtime package imports and project configuration stay app-owned and need separate migrations.
