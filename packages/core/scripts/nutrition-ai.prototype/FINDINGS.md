# PROTOTYPE — Nutrition AI findings (2026-10-14)

Throwaway. Question: can AI turn a label photo, free text, or a meal photo into
food details, grounded in NEVO rather than free-form, cheaply and provider-neutrally?

Run: `pnpm --filter @foundry/core prototype:nutrition-ai` (playground) /
`pnpm --filter @foundry/core prototype:nutrition-ai:eval` (matrix; `--models= --efforts= --strategies= --cases=`).

## Strategies

- **B retrieve→select**: model decomposes into items + Dutch search terms → local
  `searchShippedFoods` → model picks a ref from ≤12 candidates → code computes nutrients.
- **D whole catalog**: all 2,393 refs + names (~51k tokens, cached) in the prompt; model picks refs directly.
- **A free-form**: model estimates nutrients itself (baseline, ungrounded).

## Results (9 meal/text cases, 3–4 label cases)

| model · effort | B retrieve | D catalog | A free-form | B $/run | B s |
|---|---|---|---|---|---|
| haiku off | 5/9 | 6/9 | 8/9* | 0.00037 | 3.8 |
| haiku low | 6/9 | 7/9 | 8/9* | 0.00038 | 4.5 |
| **haiku medium** | **9/9** | 7/9 | 8/9* | **0.00050** | 4.4 |
| haiku high | 9/9 | 8/9 | 8/9* | 0.00077 | 6.3 |
| sonnet off | 9/9 | 7/9 | 7/9* | 0.0081 | 4.5 |
| sonnet low–high | 9/9 | 8/9 | 6–8/9* | ~0.008 | 4.5 |

\* free-form is graded on kcal range only — it cannot be checked against a source.

Label L1 (clean photo): exact on every model/effort, ~$0.0004–0.0006 on Haiku.
OFF cross-check by EAN agrees (OFF salt 0.915 vs label 0.93 — within tolerance).

## Verdict

- **Ground with B (retrieve→select) on Haiku 5.5 at medium effort.** 9/9, ~$0.0005 and ~4 s per meal; Sonnet is 16× the cost for the same score.
- **D (whole catalog) loses**: more expensive (51k-token prefix; cache is per model and effort), and less accurate (picks neighbours such as "stamppot andijvie" for boerenkool, misses eggs on an uitsmijter).
- **Labels: Haiku medium**, but image quality decides it. Sideways + low-res label (L2): Haiku returns nulls (safe); Sonnet *guesses* plausible wrong values or reads the per-portion column. Upright low-res (L2b): off by one digit on single nutrients. Arithmetic checks don't catch digit misreads; **OFF by EAN does**. Always show the review sheet.

## Known failure modes to design for

- Dish + component double count ("havermout met melk" → "pap bereid m volle melk" + 150 g extra milk).
- Speciality-variant drift ("Tarwebrood wit Turks" for a boterham) — fixed with an "everyday Dutch default" rule.
- Per-portion column read as per-100. Next idea: extract both columns and check per-portion ≈ per-100 × serving/100.
