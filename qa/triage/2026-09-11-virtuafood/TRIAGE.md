# Nutrition UX Triage — VirtuaFood comparison

## Session

- Recording: `qa/triage/virtuafood.mp4`
- Tested flow: onboarding → nutrition plan → diary → log food → product search
- Audio: ignored; background noise only
- Overall result: VirtuaFood has a more consumer-oriented, visually persuasive nutrition journey, while ours has stronger explicit data provenance, editing, safety, and combo support in code.
- Issue count: 0 confirmed defects in our app; this is a competitor benchmark and UX guidance pack.

## Executive summary

VirtuaFood is better at making nutrition feel immediately understandable: it asks one question per screen, turns the answers into a personalized calorie/macro plan, uses prominent visual summaries, and makes “add food” a single obvious action. Its diary has a strong at-a-glance hierarchy: remaining calories first, macro cards second, education beneath, and a persistent add button.

The most valuable ideas for our nutrition screens are the simplified daily summary, richer first-run goal setup, stronger visual hierarchy, and a more explicit “fast paths” logging surface (search, barcode, AI/photo scan, recent/favorites). The recording also exposes tradeoffs we should avoid copying: aggressive paywall interruption, ads, English-only food data inside a Dutch app, very long labels, and horizontally clipped content.

## Features observed

- Guided onboarding with one focused question per screen: birth date, current weight, target weight, and weekly plan.
- Unit choice for kg/lbs.
- BMI-derived ideal-weight guidance.
- Goal presets with macro percentages, including an adjustable/pro plan.
- Personalized plan summary with daily calorie advice, target date, goal weight, diet label, and macro percentages.
- Loading state while the personalized plan is generated.
- Diary dashboard with date label, remaining calories, calorie target, calories eaten, and calories burned.
- Three macro cards for carbohydrates, proteins, and fats with circular percentage progress and remaining grams.
- Dismissible “tip of the day” educational card.
- Persistent bottom navigation: diary, shopping list, profile.
- Floating add button for food logging.
- Food logging entry point with product search.
- Tabs/fast paths for all products, meals, AI scans, and recently used content.
- Barcode scanning entry point.
- AI meal/photo scanning entry point, presented as a PRO feature.
- Product rows with image, product name, kcal, serving size, and verification/source badge.
- Favorites affordance in the food browser.
- Shopping-list integration visible from the diary and included in PRO messaging.
- Subscription screen with plan comparison, savings labels, trial badge, testimonials, and feature list.

## Comparison and GUI guidance

### QA-001 — Make the daily nutrition state immediately legible

- Severity: high
- Confidence: high
- Category: information architecture / visual hierarchy
- Observed: VirtuaFood leads with “calories remaining,” target, consumed calories, and burned calories in one compact card, then places the three macro cards directly below.
- Ours: `NutritionDayScreen` leads with title/date, goals, combo controls, meal sections, and other nutrients. The code is explicit and robust, but the user’s immediate “how am I doing today?” answer is distributed across the goal rows and diary content.
- Recommendation: Put a compact daily summary above meal sections: remaining kcal, consumed/target, optional activity adjustment, then a three-column or stacked macro summary. Keep detailed goal rows available below or behind “details.”
- Evidence: `sample-12.png`, `sample-14.png`.

### QA-002 — Add a stronger first-run nutrition setup journey

- Severity: high
- Confidence: high
- Category: onboarding / personalization
- Observed: VirtuaFood collects the minimum profile inputs one at a time and immediately turns them into a named plan with calorie advice and macro percentages.
- Ours: `nutrition-goals.tsx` offers presets and editable nutrient targets, which is more flexible but feels like configuration rather than a guided outcome.
- Recommendation: Add an optional guided setup wrapper around the existing goal model. Ask goal, body context, activity/diet preference, then preview the resulting targets before saving. Preserve direct manual editing for advanced users.
- Evidence: `sample-01.png`, `sample-02.png`, `sample-04.png`, `sample-10.png`.

### QA-003 — Make food logging a visible set of fast paths

- Severity: high
- Confidence: high
- Category: interaction design
- Observed: VirtuaFood’s food browser gives search, barcode, AI scan, favorites, meals, and recent products a clear place in the logging flow. The floating plus button is always available from the diary.
- Ours: the day screen routes each meal’s plus to the shipped-food browser; code also supports personal foods, imports, combos, and barcode/Open Food Facts infrastructure, but these paths are less visibly unified.
- Recommendation: Make the add surface a small action sheet or dedicated entry screen with Search, Scan barcode, Scan meal, Favorites/recents, Personal foods, and Combos. Route each option into existing implementations rather than duplicating them.
- Evidence: `sample-16.png`, `sample-18.png`.

### QA-004 — Use food rows optimized for fast recognition

- Severity: medium
- Confidence: high
- Category: food browser / scanability
- Observed: Each VirtuaFood row combines image, name, kcal, serving, and a verification marker. This supports quick comparison while scrolling.
- Ours: the food browser supports provenance and serving selection, but the benchmark suggests making the primary scan line more compact and predictable: name first, kcal + serving second, source/provenance as a quiet secondary signal.
- Recommendation: Add thumbnails where available, clamp names to one or two lines, keep kcal visually prominent, and make serving choice explicit before logging. Preserve the provenance disclosure in the detail/editor screen.
- Evidence: `sample-18.png`, `sample-20.png`.

### QA-005 — Borrow the visual language selectively

- Severity: polish
- Confidence: high
- Category: visual design
- Observed: VirtuaFood uses large type, soft cards, colorful nutrient coding, circular progress, food photography, and a strong green primary action. The hierarchy is easy to scan despite the app’s overall visual excess.
- Recommendation: Adopt the useful primitives: one dominant number, restrained color per nutrient, generous card padding, a single obvious primary CTA, and a persistent add affordance. Do not copy the gradient-heavy PRO screens, oversized marketing copy, or image-first onboarding wholesale.
- Evidence: `sample-10.png`, `sample-14.png`, `sample-16.png`.

### QA-006 — Avoid competitor regressions

- Severity: medium
- Confidence: high
- Category: usability / trust
- Observed: The recording shows an ad in the logging flow, a PRO upsell interrupting the diary, English food results in an otherwise Dutch interface, and clipped/partially visible horizontal plan cards.
- Recommendation: Keep our nutrition flow ad-free, avoid blocking the diary with monetization, preserve locale consistency, and ensure horizontal content has clear scroll affordance and no accidental clipping. These are opportunities for us to be clearer than VirtuaFood.
- Evidence: `sample-16.png`, `sample-22.png`, `sample-24.png`.

## UX / polish observations

- The onboarding rhythm is excellent: one question, one control, one bottom-anchored CTA.
- The plan result is emotionally persuasive because it names the plan and shows a concrete daily calorie number.
- The diary’s macro cards are more visually immediate than a plain progress row.
- Product search is efficient when rows expose serving size and kcal without opening each item.
- The food browser is visually busy: ads, tabs, badges, images, and long database names compete for attention.
- “Calories burned” is prominent but its relationship to the calorie budget is not fully explained.
- The paywall’s social proof and savings labels are strong conversion mechanics, but not appropriate as a default nutrition experience.

## Things that looked correct

- Keyboard-aware numeric entry during onboarding.
- Clear enabled/disabled state for the lbs option and bottom CTA.
- Loading state while the personalized plan is generated.
- Persistent diary add affordance.
- Product search rows expose serving context and energy values.

## Open questions

- Whether our product should calculate calorie targets from profile/activity inputs or remain target-first and user-controlled.
- Whether AI/photo scan is in scope now or should remain a future entry point.
- Whether macro progress should be percentage-based, gram-target-based, or support both views.
