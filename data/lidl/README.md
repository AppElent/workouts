# Lidl bake-off sheets — dataset notes

Second shipped source next to NEVO (see `../nevo/README.md`). Lidl Nederland publishes
ingredient/allergen/nutrition sheets for its in-store bake-off range; two of them were
transcribed here as a **one-time, hand-reviewed load**. There is no repeatable PDF pipeline:
the committed `lidl-bakeoff.json` is the generator's only input, exactly as the NEVO CSV is.

## What's here

| File | What it is |
| --- | --- |
| `lidl-bakeoff.json` | **The extract.** 65 products, per-100 g figures as printed, plus authored `nameEn`, `category`, `emoji`. Read by `packages/core/scripts/lidl.ts`. |
| `*.pdf` | The source sheets (git-ignored — the fixed-assortment sheet is 14 MB). Filenames and version dates are recorded in the JSON's `sheets` block. |

Sheets transcribed:

- *Landelijke Lijst — Bake-off overzicht ingrediënten en allergeneninformatie*, versie 27 juli 2026 (49 products, EAN column).
- *Actie lijst bake-off WK35–WK38*, versie 9 september 2026 (17 rows, 16 unique — Churros is listed twice; article-code column).

Both are treated as fixed assortment. If a product ever leaves, the ordinary
`--retire-missing` flow applies; its `shipped:lidl-…` id is kept forever.

## Reading the JSON

- `code` is the identifier printed on the sheet: a 13- or 8-digit **EAN** on the fixed list,
  a 6–7 digit **article code** on the promo list (`codeType` says which). Codes are unique
  within the Lidl namespace only — identity in the artifact is `lidl:<code>`, never the bare
  number, so a Lidl code can never collide with a NEVO code.
- `grammage` is the piece weight in grams; it becomes the product's single authored serving
  ("1 stuk (75 g)", or "Heel (600 g)" at ≥ 250 g).
- `nutrients` are **per 100 g, unchanged from the sheet**, decimal comma converted to a
  point. All eight are present on every row; there are no empty, trace or `<0,5` cells.
- **Salt is published, sodium is not.** The artifact stores salt as given and sodium as
  absent (`null`); nothing is derived. `sources.lidl.saltDerived` is `false` accordingly.
- `nameNl` is the product name as printed (first name line; descriptive sub-lines dropped).
  `nameEn`, `category` and `emoji` are Appelent additions.

Known sheet oddity, kept as printed: *Donut met vanillesmaakvulling* lists saturated fat
equal to total fat (21,7 g).

## Licence

Not yet settled. These are public product sheets Lidl hands to customers on request; the
attribution line and any terms are **TBD** — see ADR 0006. Until then the artifact's
`sources.lidl` block carries publisher and edition only.
