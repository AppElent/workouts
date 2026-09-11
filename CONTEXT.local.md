# Workouts

Workouts helps a person relate training and fuelling. This glossary names the domain concepts shared by those experiences.

## Fuel

**Food Library**:
The foods available on the device without consulting an external database: shipped foods and personal foods.
_Avoid_: Local foods

**Shipped Food**:
A read-only, generic food included with the app and curated independently of Open Food Facts.
_Avoid_: Standard food, built-in food

**Personal Food**:
A food saved by the person on this device, whether entered manually, imported, or forked from a shipped food.
_Avoid_: Custom food

**Food Import**:
A proposal created from an external food database that must be reviewed before it can become a personal food or diary entry.
_Avoid_: Synced food, downloaded food

**Food Provenance**:
The origin retained when an external food import becomes a personal food or diary snapshot, even when the imported figures are corrected.
_Avoid_: Source food

**Diary Entry**:
A snapshot of the nutrition figures logged at a particular time; later changes to the food it came from do not alter the entry.
_Avoid_: Food log

**Food Reference**:
An optional link from a Diary Entry to the Food it came from. A Diary Entry remains valid when the referenced Personal Food is unavailable or deleted.

**Food Provenance**:
The recorded origin of a Diary Entry's nutrition figures, such as a Shipped Food, Personal Food, or Food Import. Provenance explains where the figures came from; it does not make that source required for reading history.

**Unavailable Food**:
A Food Reference whose source cannot be found in the current Food Library. Its Diary Entries remain readable from their snapshots, but source-dependent actions are unavailable.

**Nutrient Target**:
A person's intended amount for a nutrient over a day. In the first version, targets are a single personal set rather than varying by training-day type.

**Shipped Food Id**:
The permanent identity of a shipped food, a hand-minted slug namespaced with `shipped:` (`shipped:banana-raw`). Minted once at authoring and never changed, even when the food is renamed or its figures corrected; never reused after retirement. The prefix is what lets any reader — Convex included — tell a shipped food from a device-minted personal food id without a second field.
_Avoid_: seedKey, slug, food key

**Serving**:
A named amount of a food, stored in its base unit — "1 banana" as 120 g, "1 slice" as 105 g. Its label may use the familiar household measure while its amount remains source-compatible: for a per-100-g drink, "1 glass (200 ml)" may store a known equivalent such as 195 g. A list, in order, because a food may have several; authored on shipped foods, and supplemented by the amounts a person has logged before.
_Avoid_: Portion, serving size

**Fork**:
The personal food created when a person corrects a shipped food, carrying `forked_from` pointing at the Shipped Food Id it came from. Correcting a shipped food never edits it — shipped foods are read-only.
_Avoid_: Copy, override, custom version

**Shadowing**:
The rule that a shipped food is hidden from search whenever a fork of it exists on this device. Derived from the forks present, never stored — so deleting the fork restores the shipped food with nothing to undo.
_Avoid_: Overriding, hiding, superseding

**Retired Shipped Food**:
A shipped food withdrawn from search but kept in the shipped list forever, its id never reused. Records are retired rather than deleted so that Combos, which read a food's current figures rather than a snapshot, keep working.
_Avoid_: Deleted food, archived food
