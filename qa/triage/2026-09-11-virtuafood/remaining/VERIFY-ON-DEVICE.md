# Nutrition — user verification checklist

These are device/product checks the agent intentionally did not perform. Automated results are recorded separately. Use a development build connected to the matching updated development backend; do not test migrations against production data first.

## Everyday logging and offline recovery

- Select an earlier date, then use header Add, a meal plus, Combo, recipe and assisted entry. Every new entry must land on the visible date and chosen meal, not today/breakfast silently.
- Log three foods with Add & continue. The form should finish promptly after local saving. Reopen and check recent foods, favorites and remembered portions.
- In airplane mode, add a food, edit its amount, move it to another meal/day, and delete another pending food. Confirm pending status and correct local totals. Force-quit, reopen, reconnect, and check each intended entry appears exactly once.
- Interrupt connectivity just after tapping Add or Copy meal; reconnect twice and tap Retry sync. Entries and totals must not duplicate. A local storage error must retain the form, rather than say saved.
- Switch account with entries pending. The other account must not see the first account's cache/shortcuts or upload its queue. Switch back and check recovery.
- Open a never-cached day offline. It must not claim a complete zero-intake day. Locally known totals must be labeled partial.

## Goals and history

- Open Edit goals: start with energy, add protein, expose a second bound, and save a range. Dutch decimal commas should work. Contradictory min/max values must show an error without clearing the form.
- Change goals effective today. Yesterday's known historical target must remain unchanged. Dates before recorded goal history must say reference goals, not pretend the target is historically known.
- Schedule a future goal change; today's target must not jump early. Edit a dirty form while another device changes goals; your input must not be silently replaced.
- Tap the diary date, browse months, pick a day, and return to today. Check February/leap year and month/year boundaries.

## Library backup and restore

- Enable backup for the intended account; read and confirm the separate import of the existing device library. Nothing from legacy storage should upload before explicit association.
- Create a Personal Food and a Combo containing it. On a second installation/account session, restore/sync and check names, amounts, IDs/references and nutrition. Historical diary totals must not change.
- Edit the same food independently on two disconnected devices. After reconnect, confirm that the conflict offers both choices; verify each choice once with disposable test foods.
- Delete a food/Combo on one device while the other is offline, then reconnect. It must not silently resurrect. A Combo with a missing food must explain the missing reference.
- Switch accounts and check restored library isolation, including after importing legacy records.

## Cooking and unfinished logs

- Create a recipe from several ingredients with a measured cooked yield, e.g. 1,000 g. Log 250 g: quantities and known nutrient amounts must be one quarter of the saved recipe. Test yield by portions too.
- Change recipe version/source ingredients, then inspect an old log. Its snapshot must not change. Missing/trace ingredient nutrients must remain visibly qualified.
- Log a Combo at 0.5× and 2×. Only the new log changes; saved defaults stay intact.
- Log an estimated one-off restaurant item with unknown macros. Unknown fields must remain absent, not zero; no unwanted reusable food should be created.
- Save an unfinished note, restart, then finish it. The draft must contribute no calories before review and must become one diary submission, including interruption/retry during conversion.

## Assistance and weekly review

- Enter Dutch/English quantities with explicit g/ml. Ambiguous names and unsupported quantities must require correction/selection rather than guessing a food. Review the full batch and confirm once.
- Paste per-100 g and per-100 ml label text; verify energy units, decimal commas, all eight nutrients and the selected portion before saving. Editing the basis must affect the saved food. This is text review, not automatic photo/OCR recognition.
- Compare a week with missing days, partially logged days and marked-complete days. Missing days must stay unknown, averages must say they describe logged values, and incomplete nutrition must remain qualified.
- Mark/unmark a day complete and revisit after restart. This must not invent food entries or add calories.

## Native feel and accessibility

- Check a small iPhone, large text, Dutch labels, keyboard-visible forms and the home-indicator safe area. Primary actions should stay reachable without overlap.
- Use VoiceOver to identify every date control, favorite toggle, meal selector, quantity, review checkbox, pending state and delete confirmation.
- Check back/swipe dismissal, Reduce Motion and repeated rapid taps. Returning should preserve place and should never re-submit an already accepted meal.
- If you support Android, separately check system Back, keyboard avoidance, permissions and screen-reader labels. No Android visual verification was performed in this run.

## Experimental gates

Meal-photo calorie estimation and automatic photo/OCR label recognition are not validated/shipped by this implementation. Compare assisted versus manual entry on representative Dutch meals/labels before calling assistance faster or more accurate. No performance or accuracy improvement was measured on-device by the agent.
