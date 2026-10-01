---
version: 1.1.0
description: Shared repository and JavaScript/TypeScript setup without a developer CLI.
---

# Shared baseline

## Standard

Use pnpm, TypeScript, and Biome for new JavaScript/TypeScript applications. Keep versions and formatter options in configuration. Commit the lockfile; CI installs it frozen and runs the affected targets' lint/format, types, tests, and build checks. Existing target-specific test runners remain valid: the web baseline uses Vitest and the mobile baseline uses Jest with Expo support. Respect the configured dependency release-age policy and build-script approvals; security overrides need a demonstrated advisory and compatible resolution.

Repository layout, package names, aliases, and deployment identities remain project-owned. These standards describe defaults, not an automatic migration of existing projects. Record deliberate exceptions with scope and reason in CODING_STANDARDS.md.

## Setup

Run from the repository root. Read the installed general coding/design guidance and project decisions first.

```sh
node scripts/baseline.mjs --dry-run
node scripts/baseline.mjs --apply
node scripts/check-project.mjs
```

The script creates missing editor/LF settings. With package.json it pins the installed pnpm version (or `--pnpm-version 11.8.0`), adds missing scripts only for tools already declared, and creates starter pnpm/Biome configuration when absent. It installs no packages. A repository without package.json receives only text-file settings; no Node app is created.

Existing scripts, versions, configuration, and unknown package fields survive. A non-pnpm lockfile blocks automatic setup: review `pnpm import`, install, and remove the old lockfile only as an explicit package-manager migration. Existing pnpm-workspace.yaml is preserved; inspect it for a release-age policy and approve only native build scripts actually required by the dependency graph. Do not copy vulnerability overrides from another app.

Choose compatible Biome, TypeScript, and target-specific test dependencies in the application, then rerun setup. The script creates check/format for Biome, typecheck for TypeScript, and test for Vitest only when those dependencies exist. Existing test runners remain valid. New TypeScript configuration should come from the framework scaffold; do not overwrite a framework-specific tsconfig with a generic one.

`--ci` creates a workflow only if required package roles exist. Existing ci.yml is preserved. Inspect other workflows before enabling it to avoid duplicate checks. The generated workflow assumes a public dependency graph; an app still using private packages must retain its existing registry authentication. Monorepos should apply root settings once and keep target-specific workflows at the correct working directory.

For a new web or Expo app, create it with the supported upstream scaffold first, then follow [web](../web-baseline/FEATURE.md) or [mobile](../mobile-baseline/FEATURE.md). Those scripts include this shared setup; they are not independent package-manager policies.

## Ownership and verification

Setup output becomes app-owned. No capability catalog, adoption version, or permanent recipe receipt is added. Plans list paths and manual review items without dumping existing config values. Writes preflight expected contents and preserve symlink boundaries. They are individually atomic, not one transaction: after interruption inspect the diff and rerun; matching files are retained. A stale .appelent/baseline.lock requires verifying no setup process remains before manual removal.

Run the actual install, check, typecheck, test, and build roles. A successful setup command proves configuration writes only. `check-project.mjs` reads metadata and routing files without executing app code, reading dotenv values, or contacting providers.

## Migration

Replace `appelent recipe ... baseline.config` with focused baseline script invocations. Preserve prior recipe receipts and feature records as historical evidence until project migration is reviewed. Do not infer that old numbered steps are all complete.
