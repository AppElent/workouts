# `@workouts/core/nutrition`

The shipped food library and the pure functions around it. Imported by `apps/mobile`; **not**
imported by the web app or Convex, and not re-exported from the `@workouts/core` barrel.

## Before you charge money for anything that includes this

The NEVO-online 2025 conditions of use forbid charging end users for the data. If Workouts becomes a
paid product — a subscription, a one-off purchase, or a paid tier that includes the food diary — the
bundled dataset must be **removed or separately relicensed with RIVM first**.

Two other clauses bind day-to-day work:

- **Unchanged only.** NEVO's values and names are never amended. Everything we add — conversational
  names, aliases, emoji, categories, servings, and the salt column — lives in the overlay or is
  marked as derived, so it is always clear what is ours.
- **Attribution on output.** "Any output from software for nutritional calculations produced by the
  user must contain one of the following references." That attaches to the day view and to every
  screen that shows a total, not to an about screen. Use `nevoAttribution(onlyShippedSources)` from
  `./attribution`; it picks between the plain reference and the "…and other data sources" variant.

Full text: `data/nevo/Conditions of use NEVO-online 2025 dataset.pdf`. Rationale: ADR 0006.

## Files

| File | What it is |
| --- | --- |
| `shipped-foods.json` | **Generated.** All 2,328 NEVO foods plus the overlay. Committed. Do not edit. |
| `shipped-foods.lock.json` | **Generated, append-only.** NEVO code → permanent `shipped:` id. Committed. Entries are never deleted and ids are never reused. |
| `overlay.ts` | **Hand-authored.** The promoted foods: bilingual names, aliases, emoji, category, servings. This is the file to edit. |
| `schema.ts` | Zod schema for both generated files. Generation and tests only — `zod` is a devDependency and must not reach the phone. |
| `library.ts` `search.ts` `servings.ts` `aggregate.ts` `salt.ts` `nutrients.ts` `attribution.ts` | The public API. |
| `../../scripts/` | The generator, its NEVO reader, and the benchmark. |

## Regenerating

```bash
pnpm --filter @workouts/core generate:foods          # normal run
pnpm --filter @workouts/core check:foods             # verify the committed files are current
pnpm --filter @workouts/core bench:foods             # timings and memory
```

Two consecutive runs produce byte-identical files. If they do not, that is a bug.

Generation **stops** rather than guessing whenever a NEVO code is new, has changed identity, has
disappeared, or has come back. Each case prints the code, both names, and the exact flag that
resolves it (`--mint-new`, `--accept-change=N`, `--remint=N`, `--retire-missing`). This is
deliberate: an id that a diary entry or a Combo already points at must never quietly come to mean a
different food.

## Adding a food to the overlay

1. Find its NEVO code in `data/nevo/NEVO2025_v9.0.csv`.
2. Add an entry to `overlay.ts`: conversational `en`/`nl` name, emoji, one of the ten categories,
   any aliases, and up to three servings.
3. Run the generator and commit both generated files with your overlay change.

Two rules the generator enforces: a beverage cannot be promoted without a practical authored
serving, and because every NEVO beverage is measured per 100 **grams**, a volume-labelled serving
must say how the volume became a mass — a density with a note, or `one-to-one` for a water-like
drink.

## Reading a nutrient

`value`, `trace` and `absent` are three different things and stay that way through aggregation. A
trace contributes numeric zero and qualifies the total; an absent figure is unknown and must never
render as `0`. Salt is not published by NEVO — it is derived from sodium as
`salt (g) = sodium (mg) × 2.5 / 1000`, the source sodium is retained, and the derivation is declared
in the artifact and in `SALT_DERIVATION_DISCLOSURE`.
