# B — Readable results and an efficient portion sheet

## Read

`apps/mobile/src/screens/nutrition-food-browser.tsx`, especially resultCaption, ServingDetail, servingChoices, servingPreview and logFood; existing food-browser, import, fork and accessibility tests; core servings/rounding helpers; shared button, text, skeleton and safe-area patterns.

## Search rows

Add an explicit energy line to every local and online result: “123 kcal / 100 g” or “123 kcal / 100 ml,” according to the food's base unit. Use per-100 consistently for release 1; remembered portions come later. For absent energy say “Energy unavailable / 100 g”; trace says “Trace / 100 g.” Translate both languages and preserve source captions where they distinguish personal corrections or imports.

Keep the existing emoji/fallback slot. No image fetching or new metadata field is needed. Food names may use two lines at ordinary sizes; allow more space for accessibility text. Original names remain available in detail, and raw/cooked distinctions remain in visible naming.

Preserve result ordering, full-catalogue expansion, pagination and fork precedence. Ordinary typing must cause no network request. Do not change the provider integration in this task.

## Portion sheet

Order: stable title/close control; serving options and quantity; compact energy/macros preview; disclosure for four remaining nutrients; existing attribution and food-management controls. Keep the primary submit area outside the ScrollView, within a keyboard-aware sheet layout. Both keyboard-open and keyboard-closed states must keep the action visible without double bottom padding. Use existing native modal presentation and safe-area helpers.

Defaults are explicit: first authored portion × 1; if no authored portion exists use 100 base units (100 g or 100 ml). Current base-only initialization can amount to one gram because choices[0] is initialized with quantity 1; inspect and correct this through a regression test. Switching units retains the existing clear policy: authored × 1, base unit × 100. Every displayed preview and submitted snapshot must agree.

Add ½, 1 and 2 quantity buttons only for authored portions. They set absolute portion count; they do not repeatedly multiply the current value. Exact grams/ml remain direct numeric entry without those shortcuts. Decimal comma and decimal point both parse; empty, nonfinite and nonpositive input disable submission. Preserve unrounded source arithmetic and missing/trace states.

Use the existing submit action initially; C adds the two outcomes. Keep full eight-nutrient access, attribution, source correction, edit and confirmed deletion. New collapsed detail is not permission to discard data or hide its source.

## Acceptance tests

- A per-100-g food and a per-100-ml food have the correct basis in results.
- Absent and trace energy never render as literal zero.
- Base-only food initially previews/submits 100 units, with scaled values matching core helpers.
- Authored serving defaults to ×1; choosing ½ previews half of that serving, while choosing 2 previews double.
- Decimal comma, zero, blank and invalid quantity paths are correct.
- All eight nutrients remain accessible; imports/forks retain provenance.
- Existing duplicate-submit/failure tests still pass.

On-device: input focused, scroll detail to its end, submit action still visible; title/close and footer both fit at large text; sheet dismissal respects reduced motion and Android back. Completion: arithmetic and rendering tests pass; record native verification separately.
