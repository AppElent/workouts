---
version: 1.2.0
description: "Ownership, shared behavior, and verification."
---

# Coding

- Extend the existing owner of a responsibility; avoid a parallel mechanism.
- Before adding a reusable mechanism, check the existing feature guides and component owners. Keep domain decisions app-owned. Extract reusable code when actual callers demonstrate a common contract. Keep repeatable setup in portable scripts and implementation choices in feature guidance. Copied application examples become project-owned.
- Follow the applicable shared baseline and project overrides. Use pnpm for JavaScript/TypeScript projects; use `pnpm exec` for installed tools and `pnpm dlx` for deliberate one-off tools. Read versions, formatter options, scripts, and supply-chain policy from configuration rather than duplicating them in prose.
- Treat generated files as outputs. Change their source or generator and regenerate; never patch generated route trees, API bindings, or datasets by hand.
- Preserve the existing environment/credential routing. Keep secrets out of tracked files and client bundles.
- Verify changed behavior and relevant failure paths with the affected target's checks; a passing root suite does not cover an excluded workspace. Never weaken assertions, skip tests, or relax checks to make a change pass. If a failure cannot be fixed cleanly, report it and its evidence. Report automated checks separately from browser/device/provider checks that were not exercised.
- Keep one canonical domain glossary in `CONTEXT.md`, free of implementation details. Put current implementation decisions in project standards and operational steps in runbooks. Label dated plans, research, and reviews as historical; check their claims against current source before acting.
- Write an ADR for a durable decision only when it is hard to reverse, surprising without context, and resolves a genuine trade-off. Prefer one ADR per architectural boundary; include related consequences there.
- Consult [specialist skills](specialist-skills.md) only when task-specific expertise is useful.
