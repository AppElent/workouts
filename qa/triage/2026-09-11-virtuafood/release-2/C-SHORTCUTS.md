# C — Recent foods, favorites and remembered portions

## Flow and layout

The Add food screen serves a returning user whose primary action is choosing a familiar food. Keep date, four-meal selector, search and the release-one portion sheet. For an empty query, show compact filter controls: Recent, Favorites, All foods, Combos. Use existing native controls, wrap/scroll accessibly at large text, and keep the search field stable. Default Recent when populated; otherwise show All foods with a brief hint explaining how recents appear. Typing searches the active food collection; Combos searches combo names. Retain explicit online search and barcode affordances.

Recent/Favorites rows reuse the existing readable food row and per-100g/ml energy label. Opening a row opens the portion sheet; it does not silently log. Show a secondary “Last used: …” only when valid. Put a labeled favorite toggle in the detail header and optionally the row if it does not crowd quantity/energy. Changing a favorite never adds an entry. Existing session receipts remain receipts, not the persistent recent-food collection.

## Data contract and sequence

1. Extend task B's database migrations with account-scoped food-use records/favorites. Define stable source keys using food kind plus shipped dataset identity/food ID or personal/import local UUID. Names, search position and array indexes are not identity. Use the existing resolver/fork precedence; document missing-source handling.
2. Store last accepted timestamp and last valid portion when a direct food log's local acceptance succeeds. Include this update in the same local transaction as the operation. A failed save does not change recents/portion memory. Sync acknowledgement must not update recency a second time. Editing old diary quantities, copying meals, and logging Combos do not replace direct-food portion preferences.
3. Keep latest 50 unique direct foods per account, newest first with deterministic tie-break. Favorites are independent of this cap and survive process restart. Removing a favorite does not delete a food or diary entry.
4. Resolve sources at read/open time, preserving current source nutrition/provenance. Never revive an unavailable deleted personal food from a stale recent snapshot without explicit import/create authorization. Display an unavailable row with explanation/removal, or clearly filter it with an explanation; logging it is disabled.
5. Implement remembered portion prefill and test it independently before wiring UI.

## Portion memory

Persist structured serving identity (if available), base unit, per-serving amount, bilingual serving labels, and numeric quantity. On next open prefer an authored serving that still matches that semantic identity and amount, not its old index. If changed/missing, translate the remembered total base amount to a valid base-unit entry when units still agree; otherwise fall back to release-one defaults and explain the reset subtly. Never parse localized label strings into quantities. Default remains 100g/100ml for base entries and the existing sensible authored-serving quantity on first use.

Show that the initial value was remembered (“Last used”), keep all shortcuts/editing available, and recalculate with CURRENT food nutrients. Changing a source's nutrients must change a new log; it must not mutate old diary snapshots. Quantity must remain finite and positive. Locale changes must not corrupt decimal values or match by translated name.

## Completion tests

- A directly logged food appears once at top after local acceptance, including offline and database reopen.
- Different food IDs with identical names remain distinct; repeat use moves one row rather than duplicating it.
- Favorites persist and remain separate from recents cap; A/B account isolation holds.
- Correct portion restored across screen/process restart, Dutch locale, reordered/removed servings, changed amount and mismatched base unit.
- Deleted source cannot be logged; current nutrients are used for valid references.
- Failed local acceptance, copied meal and Combo use do not corrupt last direct portion.
- Empty/error/loading states, toggles' accessible names, large text and release-one Add & continue covered by component tests.

Done when persistent shortcuts reduce re-entry without bypassing portion review or snapshot correctness. No cloud library sync or predictive recommendation algorithm is needed.
