# NEVO-online 2025/9.0 — dataset notes

Source data for the shipped food list ([#62](https://github.com/AppElent/workouts/issues/62)),
verified in [#63](https://github.com/AppElent/workouts/issues/63). Written so the extract can be
built without opening the file again.

Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven.

## What's here

`../NEVO2025_v9.0.zip` is the download as received. Unpacked here are the parts the pipeline
needs; the 88 MB `_Details.csv` and 22 MB `.xlsx` are left in the zip — they add only per-value
source citations and a spreadsheet copy of the same rows.

| File | What it is |
| --- | --- |
| `NEVO2025_v9.0.csv` | The food table. 2,328 rows × 148 columns. **The extract's only real input.** |
| `NEVO2025_v9.0_Nutrienten_Nutrients.csv` | Nutrient-code legend: code → Dutch name, English name, unit. |
| `NEVO2025_v9.0_Recepten_Recipes.csv` | Ingredient breakdowns of the 695 derived rows. Not needed by the app; kept for provenance. |
| `Conditions of use NEVO-online 2025 dataset.pdf` | The licence. Read before changing what ships. |
| `NEVO-online background information 2025.pdf` | 31 pages of method notes. Cited by section below. |

## Reading the CSV

- **Delimiter `|`**, quote char `"`. Quoting is inconsistent — the first 11 columns are unquoted
  in data rows, the nutrient columns are quoted. A normal CSV reader handles both.
- **Encoding is cp1252**, not UTF-8, and there is no BOM. Reading it as UTF-8 mangles
  `Vetten en oliën` and `Energie en macronutriënten`.
- **Decimal comma**: `1,8` is 1.8. Thousands are never separated, so a plain
  `replace(",", ".")` is safe.

## The eight nutrients (#57)

| Wanted | NEVO column | Notes |
| --- | --- | --- |
| Calories | `ENERCC (kcal)` | Also `ENERCJ (kJ)`. Always calculated from macros, never measured. |
| Protein | `PROT (g)` | |
| Carbs | `CHO (g)` | **Available** carbohydrate — fibre and polyols excluded. Same basis as EU labels. |
| Sugars | `SUGAR (g)` | Mono- and disaccharides total. `NVSUGAF (g)` is free sugars, new in 2025. |
| Fat | `FAT (g)` | |
| Saturated fat | `FASAT (g)` | |
| Fibre | `FIBT (g)` | |
| Salt | **absent** | NEVO ships **sodium** only: `NA (mg)`. See below. |

### Salt is not in the dataset

There is no salt or NaCl column. NEVO stores total sodium, and where it takes a salt figure off
a label it converts *in* at `salt g × 0.4 × 1000 = mg sodium` (background info §6, sodium). So
`salt g = NA mg × 2.5 / 1000` is the exact inverse of NEVO's own factor — but it is still a
figure NEVO does not publish. Unresolved: see #64.

### Empty, zero, and trace are three different things

- **Missing → the cell is empty.** "If no information is available about a nutrient, the space
  for the value remains empty" (background info §6.1). Across all eight nutrients × 2,328 rows
  there are **10 empty cells**: sugars 1, fibre 7, sodium 2. Everything else is populated.
- **Trace → the cell holds `0`**, and the nutrient code appears in the
  `Bevat sporen van/Contains traces of` column. "For the nutrient value a zero is assigned to
  allow calculations" (§6.1). Among the eight: sodium 10 rows, fat 8, sugars 5, saturated fat 4,
  carbs 2, fibre 2, protein 2.
- **`Is verrijkt met/Is fortified with`** flags added nutrients — fibre on 23 rows of the eight.

So #57's absence-is-not-zero rule survives the raw data intact: blank and `0` are distinct in
the file, and the extract can carry that through by omitting the key rather than writing 0. A
trace is a genuine ~0 and needs no separate state.

## Identity

`NEVO-code` is an integer, unique, no leading zeros, 1–5,610 across 2,328 rows — the code space
is 41% used, and material changes mint a new code rather than mutate an old one (background info
§5.5 records margarine 2063 being replaced by a new code 5562). That is consistent with
retire-don't-reuse, but the documentation never states it. Not proven: see #66.

## Units and quantity basis

`Hoeveelheid/Quantity` is `per 100g` on **2,275 rows** and `per 100ml` on **53** — and all 53 are
infant formula and ORS preparations in *Foods for special nutritional use*.

**Every beverage is per 100 g.** All 153 rows in *Non-alcoholic beverages* and *Alcoholic
beverages* — milk, beer, juice, water — are per 100 g. See #65.

## Food groups

27 groups, Dutch in `Voedingsmiddelgroep` and English in `Food group`, to be mapped onto #62's
ten categories:

| Group | Rows | Group | Rows | Group | Rows |
| --- | ---: | --- | ---: | --- | ---: |
| Vegetables | 230 | Meat and poultry | 216 | Pastry and biscuits | 170 |
| Cereal products and types of flour | 142 | Milk and milk products | 131 | Sugar, sweets and sweet sauces | 128 |
| Bread | 124 | Non-alcoholic beverages | 112 | Fruits | 111 |
| Fish, crustacean and shellfish | 98 | Mixed dishes | 83 | Savoury sauces | 82 |
| Cheese | 73 | Savoury snacks | 72 | Fats and oils | 70 |
| Cold meat cuts | 65 | Meat substitutes and dairy substitutes | 62 | Foods for special nutritional use | 58 |
| Herbs and spices | 51 | Potatoes and tubers | 49 | Alcoholic beverages | 41 |
| Legumes | 39 | Nuts and seeds | 37 | Soups | 29 |
| Savoury bread spreads | 24 | Miscellaneous foods | 18 | Eggs | 13 |

## Names

Both name columns are **fully populated — 0 empty out of 2,328**, so the `{ en, nl }` shape in
#55 costs nothing to fill. `Synoniem` is populated on 1,237 rows but is **Dutch only**
(background info §5.1); it is a search-alias source for `nl`, not for `en`.

NEVO names are identification strings, not conversational ones. **25% of English names carry
NEVO abbreviations** — `wo` (without), `w` (with), `av` (average), `gem`: *Chop-suey Indonesian
wo rice*, *Mutton >10g fat raw av*. The longest is 105 characters. The licence forbids amending
them, so the raw "search all" tier shows these verbatim and the overlay's conversational name is
the only readable one.

`Opmerking` (762 rows, Dutch) carries disambiguating notes — *"Zonder schil."* — useful while
authoring the overlay, not for shipping.

## Prepared and composite foods

695 rows are recipe-derived, and **all 695 are ordinary rows of the main table with per-100
figures like everything else** — #62's assumption holds. They are not confined to *Mixed dishes*
(76 of that group's 83): *Pastry and biscuits* has 108, *Bread* 56, *Savoury sauces* 47. The
separate Recipes CSV holds only the ingredient list and relative amounts, e.g. NEVO 71 "Carrot
raw av" = 63.3% bunched + 36.7% winter carrot. The app never needs it.

275 names contain "raw" and 348 a cooked verb, so #62's enumerated dry/cooked pair list has
plenty of material.

## No portion data

**NEVO ships no portion, serving, or household-measure data of any kind** — no column, and no
mention anywhere in the 31-page background document. #62's assumption holds: every serving is an
authored addition.

## Size

The extract trimmed to code, both names, group, unit and the eight nutrients:

- **503 KB** compact JSON (`separators=(',',':')`)
- 562 KB pretty-printed
- **95 KB gzipped**

Against #62's 600 KB – 1 MB estimate, so the low end. Adding the overlay's servings, emoji and
aliases lands it inside the range.

## Licence

Full text in the PDF here; three clauses bind the build.

1. **Unchanged only.** "The user is entitled to make additions … provided that … it is clear
   these are additional to the original dataset and to what part(s) they apply. The user is not
   entitled to make amendment." The overlay/extract split in #62 is exactly this shape.
2. **Attribution on output.** "Any output from software for nutritional calculations produced by
   the user must contain one of the following references: *Based on data from NEVO online
   version 2025/9.0, RIVM, Bilthoven* or *… and other data sources*." This is stronger than an
   about-screen credit — it attaches to the day view, wherever totals are shown. The second
   variant is the one to use once a personal food or an OFF import can enter a total.
3. **No charging end users** for the data. Already load-bearing in #62.

Two further notes: RIVM asks users to replace the dataset as soon as a new version is released
(roughly every two years), and the list of abbreviations and the added/removed-foods list are on
the NEVO website only — not in the download.
