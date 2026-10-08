# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**: one glossary and one ADR directory cover the web app, `apps/mobile`, and `packages/core`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the project glossary. Wherever a skill says `GLOSSARY.md`, read `CONTEXT.md` instead, and add new terms there.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. New ADRs go here, numbered after the highest existing one.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids (its `_Avoid_:` lines).

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0008 (hosted workout ownership), but worth reopening because…_
