---
name: add-cli
description: Use when adding a command-line interface to an Appelent app. CLI is a shipped, active capability owned by the @appelent/cli package — this skill points at the real integration docs; it does not stamp code itself.
---

# add-cli

CLI is an **active, package-owned** capability: `@appelent/cli`. It is no longer
a candidate — do not write a design/plan from scratch or invent a local pattern.

The source of truth for how to consume it is the package README (tool-agnostic,
also what Codex reads), not this skill:

- **Package + README**: `@appelent/cli` (in `appelent-packages/packages/cli`) —
  `createCli({ appName })` factory, the `cli/index.ts` bin-wrapper pattern,
  config/env conventions, and the `CliCommand` extension seam for app-specific
  domain commands.
- **Reference implementation**: `workouts` — `cli/index.ts` wraps
  `createCli({ appName: "workouts" })`; `@appelent/cli` is a normal dependency.
- **New-app bootstrap**: `custom-bootstrap` step 7 (shared `@appelent` packages).

## To add CLI to an app

1. `pnpm add @appelent/cli` (scope needs the `.npmrc` registry mapping — see
   `custom-bootstrap` step 7).
2. Add a thin `cli/index.ts` wrapper calling `createCli({ appName: "<app>" })`
   and a `"<app>": "tsx cli/index.ts"` script — copy the workouts shape.
3. App-specific commands (that hit the app's own API/Convex functions) go in the
   app via the `commands: CliCommand[]` option — **not** in the shared package.
   Keep `@appelent/cli` generic; never fork it into the app.
4. Register the `cli` capability for the repo (`custom-bootstrap` registry step /
   `appelent-registry.mjs ... --capability cli`).
