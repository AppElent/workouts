---
name: foundry-design
description: Use this skill to generate well-branded interfaces and assets for Foundry, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the readme.md file within this skill, and explore the other available files.

Foundry has two themes, dark and light, and follows the OS setting. The colour tokens in `tokens/colors.css` match `apps/mobile/src/theme/palette.ts` key for key. The accent rule: `--accent` (= `--accent-ink`) is the legible accent for text, icons and strokes (#c8f73c dark, #466400 light); `--accent-fill` is the lime #c8f73c in both themes, used only as a fill, with `--on-accent` content. Check every mock in both themes.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
