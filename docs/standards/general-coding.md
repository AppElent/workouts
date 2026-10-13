---
type: standard
kind: platform
description: Read before implementing or reviewing any code change.
version: 1.3.2
applies_to: [all]
---

# General coding

Changes extend existing owners, keep generated output generated, and finish verified.

## Rules

- Extend the existing owner of a responsibility; avoid a parallel mechanism.
- Before adding a reusable mechanism, check the existing standards and component owners. Keep domain decisions app-owned. Extract reusable code when actual callers demonstrate a common contract. Keep repeatable setup in portable scripts and implementation choices in standards. Copied application examples become project-owned.
- Follow the applicable [baseline](baseline.md) and project overrides. Use pnpm for JavaScript/TypeScript projects; use `pnpm exec` for installed tools and `pnpm dlx` for deliberate one-off tools. Read versions, formatter options, scripts, and supply-chain policy from configuration rather than duplicating them in prose.
- Treat generated files as outputs. Change their source or generator and regenerate; never patch generated route trees, API bindings, or datasets by hand.
- Preserve the existing environment/credential routing. Keep secrets out of tracked files and client bundles.
- For documentation, follow the [documentation standard](documentation.md). Keep domain vocabulary in GLOSSARY.md and hard-to-reverse, surprising trade-offs in ADRs.
- **Default:** consult [specialist skills](../guidelines/shared/general/specialist-skills.md) only when task-specific expertise is useful.

## Verify

- Before completion, follow the [verification standard](verification.md) and the affected project's check commands.

## Exceptions

Record in `CODING_STANDARDS.md`: rule, scope, replacement, reason.
