---
version: 1.0.0
description: Inline numeric editing, replacement behavior, and input acceptance.
---

# Number fields

Use an inline labelled field when a number can be edited in its surrounding row.
Keep the unit visible and separately accessible. Use a stepper for frequent bounded
adjustments; direct entry remains available when stepping across the range is slow.
Product rules own units, bounds, precision, increments, and conversion semantics.

Keep editable text separate from the parsed domain value. Support the app's decimal
locales and intermediate input while typing. Validate on the declared commit
boundary; avoid cursor jumps from formatting on each keystroke. Distinguish empty,
zero, invalid, and unavailable values. A numeric keyboard is a convenience, not a
validator; pasted and hardware-keyboard input needs the same validation.

## Variants

- **Ordinary entry:** focus preserves the editable value. Clear follows the domain's
  explicit optional/required policy.
- **Replace on focus:** for rapidly replacing an existing value, show the previous
  value as a placeholder; the first input replaces it. Leaving untouched or cleared
  restores the previous value. Removal is a separate action. Choose this variant
  explicitly; it is unsuitable when empty itself must be saved.
- **Quantity adjustment:** combine direct entry with useful increments and optional
  unit/serving selection. Keep conversion and remembered amounts domain-owned.

Keep the focused value and commit action above the keyboard. Offer previous/next
and Done for repeated fields when the platform keyboard lacks navigation. Use native
text editing so selection, caret, paste, and accessibility remain available.

## Acceptance and examples

Check decimal separators, paste, zero/empty/invalid values, bounds, precision,
focus/blur without typing, clear, keyboard dismissal, larger text, and screen-reader
label/value/unit. A failed save preserves input.

Origin: Workouts' InlineNumberFieldRow and Diary Entry quantity editor. These
establish implementation examples, not proof that all variants/locales passed.
Workouts' project design system binds them to its studies and dated evidence;
exercise these cases before marking another implementation accepted.
