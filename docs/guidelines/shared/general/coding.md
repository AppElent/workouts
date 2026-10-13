---
version: 1.3.1
description: "Ownership, shared behavior, and verification."
---

# Coding

- Extend the existing owner of a responsibility; avoid a parallel mechanism.
- Before adding a reusable mechanism, check the existing feature guides and component owners. Keep domain decisions app-owned. Extract reusable code when actual callers demonstrate a common contract. Keep repeatable setup in portable scripts and implementation choices in feature guidance. Copied application examples become project-owned.
- Follow the applicable shared baseline and project overrides. Use pnpm for JavaScript/TypeScript projects; use `pnpm exec` for installed tools and `pnpm dlx` for deliberate one-off tools. Read versions, formatter options, scripts, and supply-chain policy from configuration rather than duplicating them in prose.
- Treat generated files as outputs. Change their source or generator and regenerate; never patch generated route trees, API bindings, or datasets by hand.
- Preserve the existing environment/credential routing. Keep secrets out of tracked files and client bundles.
- Before completion, follow the [verification contract](verification.md) and the affected project's check commands.
- For documentation, follow [documentation standard](../../../standards/documentation.md). Keep domain vocabulary in GLOSSARY.md and hard-to-reverse, surprising trade-offs in ADRs.
- Consult [specialist skills](specialist-skills.md) only when task-specific expertise is useful.
