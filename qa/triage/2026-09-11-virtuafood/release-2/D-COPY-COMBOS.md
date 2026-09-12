# D — Copy meal, integrate Combos, verify release

## Copy-meal flow

Add “Copy meal” to each meal's existing secondary actions, including empty target meals. Open one review sheet with target date/meal prominently visible. Default source to the previous calendar day relative to the SELECTED diary date and the same meal, not yesterday relative to the clock. Allow source date via existing date-entry pattern and source meal selector; a calendar redesign is not part of release 2.

Load the source day from the shared cache/query path. Show its food rows with quantities and energy plus item count. All rows initially selected; allow checkboxes to exclude rows. CTA says “Copy N foods to [meal]”. Zero selections disables it. Explain empty source, uncached offline source, loading and error states. A complete cached source works offline. An incomplete source must be labeled partial and require explicit acknowledgement before copying the visible subset, or disable copy until complete (prefer the latter for this release).

On confirm, freeze selected recorded snapshots, replace only target date/meal and identity/group metadata, then submit ONE createBatch operation through task B. Do not resolve the source foods again, rescale nutrition, retain server IDs or modify the source meal. Preserve exact snapshot quantities, serving labels, all nutrient states and provenance. Fresh client entry IDs and operation ID belong to this copy intent. Source Combo groups get fresh destination group IDs consistently per copied source group; partial group selections may remain plain entries to avoid claiming a complete Combo. Do not retain the old group ID.

After local acceptance, close sheet and show destination rows plus pending status. Prevent double taps during local commit. A failed commit preserves selection. Network retry never recopies the meal. Copying into a nonempty meal is additive; review text says so. Copying a meal to itself is disabled with explanation in this release to avoid accidental duplication. Two separately confirmed copy actions intentionally add two batches.

## Combo integration

Use the Combos filter in Add food; reuse existing local Combo repository and resolution helpers. Show name, item count and available summary, with explicit missing-source state. Opening a Combo previews parts and the selected target day/meal, with one primary “Add Combo” action. Existing standalone creation/library navigation stays available. Reuse one component/helper instead of duplicating business logic.

Resolve current referenced source foods at confirmation and freeze all resolved snapshots in the same batch acceptance boundary; if any source cannot resolve, block the whole submission and name the missing items. Preserve fixed quantities, provenance and fresh group identity. Offline works for locally resolvable sources. After acceptance support continuing food selection using existing receipt conventions. Do not introduce scaled portions, nested Combos or recipe editing.

## Selected-day regression fix

Inspect the header Add action in `app/(app)/_layout.tsx`: release one currently initializes it with today, while diary selected date is screen state. Bind it to that selected state through a small existing-pattern context or screen navigation options. Test header Add, meal plus, copy and Combo all targeting an earlier day, including navigation back/forward and midnight boundary. Avoid a global today fallback that conceals missing route context. Preserve selection-mode controls used to create a Combo.

## Required tests

- Yesterday defaults relative to selected date, including month/year/leap-day boundaries without UTC/local timezone drift.
- Copy cached historical snapshots after source food edit/deletion; nutrition remains exactly the historical record.
- Empty, uncached, nonempty destination, self-copy, partial selection and cancel paths.
- Retry/lost ACK/restart of copy yields one complete batch; a deliberate second copy is allowed.
- New Combo logs current source values; copied old Combo logs old values; groups never share identity across logging events.
- Missing Combo source blocks all parts; local commit failure retains UI selection.
- All entry points use selected date/meal and produce the same durable operation shape.

## Final integration pass

Run the verification commands described in RELEASE-2.md and inspect the complete task diff without reverting release-one/user changes. Add a brief release-two section to the nutrition spec describing new storage, consistency, privacy boundaries and UX. Update IMPLEMENTATION-STATUS.md with concrete evidence for A–D and native checks remaining.

Exercise the complete scenario: select an earlier diary day → Add → favorite a food → change portion → Add & continue twice → reopen and verify remembered portion → airplane-mode Combo → copy prior meal → edit and delete pending entries → reopen local database → reconnect/lost-ACK retry → verify exact entries and totals → switch accounts and verify isolation. Automated tests should cover deterministic portions of this journey; leave device-only steps explicitly unverified if no device is available.

Finish only when the implementation and evidence cover all four task contracts. If a real external blocker prevents completion, checkpoint precisely what is done and what needs user action. Do not treat passing typecheck as proof of offline durability.
