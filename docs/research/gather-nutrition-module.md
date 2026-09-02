# How gather's nutrition module actually works, end to end

Research for [#52](https://github.com/AppElent/workouts/issues/52), part of the
Fuel module map [#51](https://github.com/AppElent/workouts/issues/51).

Every claim below is cited to a file in `AppElent/gather` as checked out at
`/home/user/gather`. Paths are gather-relative. Quotes are from that source; the
schema and ADR prose is unusually load-bearing and is quoted rather than
paraphrased where the wording carries the argument.

Reader's shortcut: the last section, **Keep / adapt / drop**, is the opinion the
grilling tickets are meant to argue with. Everything before it is the record.

---

## 1. The shape of the thing

Five tables and one user column, plus seven pure libraries and two Node actions.

| Table | Owner | Lifetime |
| --- | --- | --- |
| `foods` | nobody (Catalog rows) or one person (`createdBy`) | permanent, globally readable |
| `consumptionEntries` | one person (`userId`) | a record of what happened; never recomputed after the fact except on edit |
| `combos` | one person (`userId`) | a shortcut for what will happen |
| `comboItems` | its `combos` row | ditto |
| `users.nutritionTargets` | the person | a single per-nutrient target set |

The scope split is [ADR-0003](https://github.com/AppElent/gather/blob/main/docs/adr/0003-three-scopes-personal-group-and-personal-records.md):
Group-scoped content, **Personal** records, and the **Catalog** which "belongs
to nobody". Nutrition is the module that uses Personal — and `CONTEXT.md:59-64`
now calls Personal a *legacy scope*: "The target model removes this scope from
Gather, with Nutrition being deprecated separately."

**There is no `groupId` anywhere in the nutrition tables.** `convex/combos.ts`
says so explicitly: "there is no Group argument to take, and no Group whose
membership could widen what is returned." The only place Group membership enters
nutrition at all is the *recipe* reference on a diary entry or a combo item,
where visibility is re-checked on read (§4).

---

## 2. The schema, field by field

Source: `convex/schema.ts` lines 231-365, `convex/lib/nutrition.ts`,
`convex/lib/consumption.ts`, `convex/lib/servings.ts`.

### 2.1 The nutrient vocabulary

`packages/core/src/domain.ts:161-178` is the single definition, shared by web,
mobile and Convex:

```ts
export const NUTRIENT_KEYS = ['calories','protein','carbs','sugars','fat',
  'saturatedFat','fiber','salt'] as const
export type NutritionSource = 'imported' | 'ai' | 'manual'
export const MEAL_NAMES = ['breakfast','lunch','dinner','snack'] as const
export const QUANTITY_UNITS = ['serving','g','ml','piece'] as const
```

Eight nutrients, all optional. `NutritionFacts` is
`Partial<Record<NutrientKey, number>>` — calories in kcal, everything else in
grams. The rule that follows from optionality is stated in
`convex/lib/consumption.ts`, in `sumFacts`:

> "A nutrient is only present in the sum if at least one entry had it — absence
> isn't the same as zero (spec: 'store what a source provides, render only what
> exists')."

This is the single most consequential small decision in the module. It is why
every summary function has to distinguish absent from zero, why `nutritionEqual`
compares `a[key] ?? null` rather than `a[key] ?? 0`, and why `DayTotals` renders
only the nutrients present.

The nutrient *names a person reads* are deliberately not here. `convex/lib/nutrition.ts`
carries a tombstone comment: "The nutrient *names* used to live here... They are
read by a person, so they are translated, and they now live in each locale's
`nutrients.ts`... No Convex function ever read them; three client components
did." Same for meal names in `convex/lib/consumption.ts`. This is
[ADR-0011](https://github.com/AppElent/gather/blob/main/docs/adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)'s
chrome-vs-content line applied to the backend: **display strings never live in
`convex/`**.

### 2.2 `foods`

```ts
foods: defineTable({
  name, brand?, barcode?,
  baseUnit: 'g' | 'ml',
  nutritionPer100: nutritionValidator,
  servings?: Serving[],              // { label, amount } in baseUnit
  source: 'openfoodfacts' | 'manual' | 'seed',
  nutritionSource?: 'imported' | 'ai' | 'manual',
  localEdited?: boolean,
  createdBy?: Id<'users'>,           // absent on Catalog rows
  seedKey?: string,                  // present only on Catalog rows
  searchText?: string,
  imageId?: Id<'_storage'>,
  icon?: string,                     // an emoji
})
  .index('by_barcode').index('by_seedKey').index('by_name')
  .searchIndex('search_by_text', { searchField: 'searchText' })
```

The why for each of the non-obvious ones:

- **`baseUnit`** is `g` or `ml` only. Everything nutritional is per 100 of it.
- **`servings`** is a *list*, not a single portion. The schema: "What somebody
  calls a portion of this food, in order — '1 slice', '1 glass' — each an amount
  in `baseUnit`. Optional because most foods have none: an empty list is
  answered by the person's own logged amounts rather than by inventing a portion
  for them." That third source of servings is `rankLoggedAmounts` (§5.3). It
  replaced an earlier single `servingSize`/`servingLabel` pair (#68/#71,
  `docs/migrations/0006-food-servings.md`).
- **`searchText`** is `name + brand`, denormalised. `convex/lib/foodSearchText.ts`
  explains: "A Convex search index has exactly one full-text field and its filter
  fields are equality-only, so 'match either the name or the brand' cannot be
  expressed as a query — it has to be expressed as data."
- **`imageId`** is only ever an Open Food Facts product picture that gather
  fetched and stored, never a photo a person took: "that would need the
  prepare-on-upload pipeline (ADR-0010) and is deliberately not offered."
- **`icon`** is an emoji, added for foods with no picture (#94). It is *content*,
  not a display string, so it is stored rather than translated. The tile's
  fallback chain is photograph → emoji → generic glyph.
- **`by_name`** exists solely so browsing takes an alphabetical first page rather
  than an arbitrary one: "cutting the Catalog before sorting would make the first
  page whatever the table happened to return" (`convex/foods.ts`, `list`).

Foods have **no sharing model at all**. `convex/consumption.ts` states it: "Foods
have no sharing/visibility model (spec §3.3: 'readable by any authenticated
user')." Only `foods.search`/`list`/`get` gate on being signed in.

### 2.3 `consumptionEntries` — the diary

```ts
consumptionEntries: defineTable({
  userId, date /* 'YYYY-MM-DD' */, meal,
  recipeId?, foodId?,          // at most one; a one-off has neither
  label: string,               // snapshot
  quantity: number,
  quantityUnit: 'serving' | 'g' | 'ml' | 'piece',
  nutrition: NutritionFacts,   // snapshot, NOT optional
  icon?: string,               // one-offs only
  comboId?, comboLabel?,       // which Combo wrote this, and its name then
})
  .index('by_user_date').index('by_user_food')
```

`date` is a client-local `YYYY-MM-DD` string. `NutritionPage.todayLocal()` is
exported specifically so the add route computes "today" identically — "matches
spec §3.4 ('no server timezone math')". There is no timezone anywhere in the
module.

`by_user_food` exists for exactly one question, and the schema names it: "'Which
amounts of this food have I logged before?' — read to offer them back as
servings, and the reason this is an index rather than a scan of every entry the
person has ever written."

### 2.4 `combos` and `comboItems`

A Combo is "a named, reusable set of things logged together — the same lunch,
again" ([ADR-0012](https://github.com/AppElent/gather/blob/main/docs/adr/0012-a-combo-is-a-personal-shortcut-and-not-a-recipe.md)).
`combos` is `{ userId, name, order }` and nothing else. `comboItems` is
"exactly a diary entry minus the date, the meal and the person."

The critical difference from a diary entry is in the schema comment on
`comboItems`:

> "**References, not figures**: `foodId` / `recipeId` say what this is, so
> correcting a food's nutrition corrects every future log of every Combo
> containing it. `label` is a snapshot so a reference that has become unreachable
> still has something to render, and `nutrition` is present only for a one-off,
> which has nothing behind it to read figures from."

ADR-0012 gives the reason: "an entry is a record of something that happened, a
Combo is a shortcut for something that will."

`convex/combos.ts:saveFromMeal` enforces it on write — `nutrition: entry.foodId
|| entry.recipeId ? undefined : entry.nutrition` — and the same for `icon`.

### 2.5 `users.nutritionTargets`

One optional `nutritionValidator` on the user row (`convex/schema.ts:43`), set by
`convex/users.ts:setNutritionTargets`, which is four lines and takes no Group.
Read in exactly two places: `NutritionTargetsSettings.tsx` (a `/settings` panel)
and `NutritionPage.tsx:153`, which hands it to `DayTotals`.

`DayTotals.remainder` is the whole targets feature: "A target of zero is not a
target — it is somebody who cleared the field — so it produces no remainder and
no progress bar rather than a division by zero." It returns `{ amount, over }`
and lets the renderer choose the sentence (ADR-0011 again — a validator or
calculator returns a key or a fact, never a sentence).

There is no per-day target, no target history, no training-load input. Targets
are one flat set of the same eight nutrients, compared against today's totals.

---

## 3. Two `source` fields and a flag — the argument

This is the part of gather's design worth stealing verbatim. Three distinct
questions get three distinct fields, and the schema refuses to collapse them.

**`source: 'openfoodfacts' | 'manual' | 'seed'` — where the *row* came from.**
Written once at insert and only changed by `applyOffRefresh`, which sets
`source: 'openfoodfacts'`. It is a provenance fact about the record.

**`nutritionSource: 'imported' | 'ai' | 'manual'` — where the *figures* came
from.** The schema comment is the argument:

> "Where the *figures* came from, which is a different question from where the
> *row* came from (`source`, above): a food somebody added by hand can later be
> corrected off a packet, and an imported row can be typed over. **Conflating the
> two loses both answers.**"

Three further decisions ride on it:

1. It reuses **the same union Recipes carry**, "rather than a second, finer
   vocabulary meaning nearly the same thing."
2. It is **optional with no backfill** — "a food that predates the field simply
   does not claim a source."
3. It is **absent on Catalog rows** — "their figures are authored, and 'Built-in'
   already says so."

The transition rule is a pure function, `nextNutritionSource(before, after,
recorded)` in `convex/lib/nutrition.ts`:

```ts
if (!hasNutritionFigures(after)) return undefined
return nutritionEqual(before, after) ? recorded : 'manual'
```

Two things this deliberately does *not* do, both documented:

- It **does not trust the caller.** "Renaming a food, adding a serving or fixing
  a brand are not claims about its nutrition, and a client is in no position to
  say which of those it did." `foods.update` therefore computes it from
  before/after figures rather than accepting it as an argument — "it must not be
  possible to [type over the figures] while still claiming the numbers came off
  a packet."
- It **does not claim a source for empty figures.** `hasNutritionFigures` exists
  only for this: "a food that says 'Manual' over an empty panel is claiming an
  answer to a question nobody asked." That function's docstring also draws a line
  worth keeping: it is "deliberately *not* 'is this nutrition usable' — that one
  is about whether something can be logged from these figures, and energy alone
  would satisfy it. Different question, and it belongs to whoever needs it."

**`localEdited: boolean` — has a human touched this row?** A third question
again, and it governs one thing only: whether an automatic Open Food Facts
re-import may overwrite. `foods.update` sets `localEdited: true`
unconditionally — "Any edit through the general edit form counts as a local
edit: from this point on, a rescan of this barcode must never silently overwrite
what the user typed, until they explicitly ask to refresh."

- `upsertFromOff` (a rescan/import) hitting an existing `localEdited` row
  **writes nothing** and returns the existing id.
- `applyOffRefresh` — the *explicit* "refresh from Open Food Facts" — overwrites
  wholesale and sets `localEdited: false`, `nutritionSource: 'imported'`.
- `attachOffImage` also refuses a `localEdited` row: "their local edit wins."

So: `source` = record provenance, `nutritionSource` = figure provenance,
`localEdited` = a consent flag about future automatic writes. Each is read by
different code and none can substitute for another.

---

## 4. Snapshot discipline — why the device/Convex split costs nothing

The map's premise ("personal foods are device-only; the diary and targets live
in Convex; the split costs nothing") is exactly the property gather engineered
on purpose. Here is the mechanism.

**A diary entry carries `label`, `quantity`, `quantityUnit` and `nutrition` of
its own.** `nutrition` is *not* optional on `consumptionEntries`. The entry is
readable and correct with `foodId` pointing at nothing.

ADR-0003 states the rule:

> "Personal records may reference Group-scoped content — a diary entry recording
> which recipe it came from. Those references are **provenance**, not
> dependencies: the record snapshots what it needs at write time, and the
> reference is permission-checked on read and allowed to dangle."

`CONTEXT.md` promotes it to a standing rule: "A Personal record **snapshots**
what it references. Provenance is permission-checked on read and safe to dangle.
A **Combo** is the deliberate exception and says why."

Four places implement it:

1. **`consumption.entryThumbnail`** resolves the reference *for decoration only*
   — a picture and an icon. A recipe that was deleted and a recipe the viewer can
   no longer see "drop it in precisely the same way — there is one branch and it
   cannot tell them apart" (ADR-0009's refusal-uniformity rule). "What the entry
   recorded is untouched either way."
2. **`consumption.update`** is the one place a snapshot is re-derived, and only
   on a quantity/unit change. `recomputeFromSource` reads the food or the visible
   recipe; if the source is gone *or no longer visible*, it falls back to scaling
   the existing snapshot. The comment names the reason visibility matters:
   "recomputing from it would leak nutrition data the owner is no longer
   authorized to see." There is a second subtlety — a *unit* change with no
   source to read leaves the figures alone rather than scaling "by a ratio
   between two different things."
3. **Catalog retirement** deletes rows, which dangles `foodId`s. ADR-0004
   accepts this by name: "a diary entry stays correct and readable regardless."
4. **`comboLabel` beside `comboId`** — the same discipline applied to the Combo
   stamp: "renaming a Combo does not rewrite last Tuesday, and deleting one does
   not blank what it left behind."

The consequence for workouts: a diary entry written from a device-local food is
a complete, self-describing row. The `foodId` would simply be a string the server
cannot resolve — which is a state the server already has to handle for retired
Catalog rows and left Groups. **Nothing in the read path breaks; only the
decoration (a thumbnail, an "edit this food" link) goes missing.**

The one thing that *would* break is `consumption.update`'s recompute-on-quantity-change,
which needs the food. Gather's own fallback (scale the snapshot proportionally,
same unit only) is already the correct answer and is already implemented.

The Combo is the counterexample and states why it is one — see §2.4. A
device-local food inside a Combo is a harder case than one in the diary, because
a Combo *does* read current figures. `resolveComponent` returning
`available: false` for an unreachable reference is the existing handling: the
card renders by saved label and simply is not logged.

---

## 5. The pure libraries

Seven files, all under `convex/lib/`, all with tests. Test counts are `it(`/`test(`
call counts in the sibling `.test.ts`.

| File | LoC | Tests | Non-pure imports | Portable as-is? |
| --- | --- | --- | --- | --- |
| `nutrition.ts` | 171 | 33 | `convex/values` (validators only) | yes, minus validators |
| `consumption.ts` | 84 | 10 | `convex/values` | yes, minus validators |
| `servings.ts` | 168 | 12 | `convex/values` | yes, minus validators |
| `combos.ts` | 128 | 9 | none | **yes, verbatim** |
| `offMapping.ts` | 238 | 22 | none | **yes, verbatim** |
| `offFetch.ts` | 118 | 15 | none (injectable `fetch`) | **yes, verbatim** |
| `foodSearchText.ts` | 19 | 4 | none | **yes, verbatim** |
| `nutritionAiEstimate.ts` | 101 | 5 | none (injectable `fetch`) | yes (deferred by #51) |

The only Convex coupling in the whole set is `import { v } from 'convex/values'`
for the *validators* — `nutritionValidator`, `mealValidator`,
`quantityUnitValidator`, `servingValidator`, `nutritionSourceValidator`. Split
each file into "the logic" and "the validator", and the logic half moves
unchanged. `@gather/core/domain` already holds the key/union constants, which is
the precedent for exactly this move.

### 5.1 `nutrition.ts` — parsing and provenance

- `parseNutritionValue` — normalises free-text nutrition from JSON-LD: `"12,5 g"`
  (Dutch decimal comma), `"1,200 kcal"` (US thousands comma — disambiguated by
  `/^\d+,\d{3}$/`), `"1046 kJ"` (÷4.184), `"740 mg"` (÷1000, and also matches the
  spelled-out "milligram", "some sites (bbcgoodfood.com)"). Never throws;
  unparseable → `undefined`.
- `parseServings` — schema.org `recipeYield`: `"4 personen"`, `"4-6"` (lower
  bound wins), arrays. Capped at 100 "so strings like '1000 ml' don't become
  servings."
- `sanitizeNutrition` — shape-check untrusted AI output.
- `hasNutritionFigures`, `nextNutritionSource` — §3.
- `nextNutritionStale` — recipe-only; belongs to the recipe module, not the diary.

Recipe-shaped concerns (`parseServings`, `nextNutritionStale`,
`NutritionStaleState`) are roughly a third of this file and are cuttable for
workouts.

### 5.2 `consumption.ts` — the arithmetic

Four functions, and they are the entire nutrition maths of the module:

- `scaleFacts(facts, factor)` — multiply present nutrients, round to 2 dp "to
  avoid floating-point noise in stored snapshots."
- `sumFacts(list)` — absent ≠ zero (§2.1).
- `computeRecipeEntryNutrition(perServing, servings)` = `scaleFacts`.
- `computeFoodEntryNutrition(food, quantity, unit)` — `'piece'` means "a count of
  the food's own portions — its first named serving"; `g`/`ml` is the direct
  amount; then `scaleFacts(nutritionPer100, amount / 100)`.

Note `'piece'` resolves against `servings[0]` only. "A food with no servings has
no portion to count, so a 'piece' of it is nothing."

### 5.3 `servings.ts` — what amounts to offer

Three sources of servings, in order (`offeredServings`):

1. `authoredServings(food)` — what the food declares.
2. `rankLoggedAmounts(entries, baseUnit)` — **your own past amounts**, most-used
   first, capped at 3. Only counts entries already in the food's base unit,
   because "a 'serving' or 'piece' entry counts something else — how many
   portions — and reoffering its number as a weight would be a different amount
   wearing the same digits." Ties break to the larger amount purely for stable
   ordering.
3. A typed custom amount (`parseServingAmount`, accepts a Dutch decimal comma,
   refuses anything non-positive rather than coercing).

Duplicates between (1) and (2) are dropped rather than repeated under a second
heading.

`resolveAmount(food, choice)` is the seam: it turns a chip or a typed number into
`{ amount, label, nutrition }`. Its docstring is the reason it exists: "One
function, imported directly by the client as well as read on the server, because
the alternative is the same arithmetic in two places disagreeing about rounding."
The label it builds is deliberately not a translated sentence — a serving's own
name is content, and the fallback is `"200 g"` / `"2 × 1 slice"`, which "reads
the same in both locales."

`rankLoggedAmounts` is the single most valuable behaviour in this file for a
fuelling app: it is what makes a Catalog food (which nobody may edit) usable
without anyone authoring portions for it.

### 5.4 `combos.ts` — expansion

`comboEntries(components, counts)` turns a Combo, adjusted for today, into diary
entries. Rules, all from the docstrings:

- Nutrition comes from the **reference** where there is one; a one-off scales its
  own saved figures "by how many of *those* are being logged rather than by the
  raw quantity."
- A component that is unavailable or stepped to zero produces nothing "and the
  rest still log — losing access to one thing does not break the whole shortcut."
- `countOf`: missing from the map means 1; zero means removed — "the stepper
  reaching zero *is* the remove control, which is why there is no second one
  beside it."
- Pure "and imported directly by the client, so what the expanded card shows and
  what the mutation writes cannot drift apart."

Zero non-pure imports. This moves to `@workouts/core` unchanged.

### 5.5 `offFetch.ts` / `offMapping.ts` — Open Food Facts

Split into I/O and mapping, both never-throwing, both `fetch`-injectable.

`offFetch.ts` carries the single most useful piece of external knowledge in the
repo, and it was learned the hard way:

> "Full-text search is NOT part of the world.openfoodfacts.org/api/v2 REST API —
> that API is structured/tag search only and **silently ignores an unrecognized
> `search_terms` param** (returning an unfiltered, identical-every-time page of
> the whole catalog rather than an error, which is what shipped here
> originally). The actual full-text search service is 'search-a-licious' at
> search.openfoodfacts.org, a separate host with its own response shape
> (`{hits: [...]}`) and `q` query param."

Other facts worth carrying:

- Two hosts: `world.openfoodfacts.org/api/v2/product/{barcode}.json` for a
  barcode, `search.openfoodfacts.org/search` for text.
- A `User-Agent` is set (OFF asks for one); 10 s timeout via `AbortSignal.timeout`.
- `barcodeTerm()` — one definition of "plausible barcode" (`/^\d{8,14}$/`) shared
  by the search box and the lookup. Eight digits is EAN-8, "and it is also what
  keeps a number still being typed out of barcode mode."
- `normalizeSearchLang(locale)` — the `langs` param; search-a-licious defaults to
  English, "which is what gather did for as long as it has preferred Dutch names
  on the way *back* — it searched English and displayed Dutch, so a Dutch product
  name found nothing."
- `page_size: 40` for ~20 shown results, because mapping drops a lot.

`offMapping.ts` handles the shape divergence between the two APIs (`brands` is a
comma-joined string on v2, a string array on search-a-licious) and the data
quality of a community database:

- `mapOffSearchResults` drops hits with no barcode, no usable name, or **zero
  nutrients**, then dedupes by lowercased `name|brand` keeping whichever has the
  most nutrients populated — "OFF's product database has many low-quality/duplicate
  barcodes for the same real product." Capped at 20, relevance order otherwise
  preserved.
- `mapOffProduct` (barcode path) does *not* drop a nameless result — that
  decision is left to the confirmation screen.
- Name preference is `product_name_nl` → `product_name` → `''`. Locale-specific
  and would need re-deciding for workouts.
- `NUTRIMENT_MAPPINGS` maps the eight keys onto OFF's `*_100g` fields.
- `preferredImageUrl` takes the *smallest* image OFF offers: "a thumbnail in a
  list is the whole job here, and the full-size image is several hundred
  kilobytes of a photograph of a packet."
- One serving max per product, kept with the packet's own words as its label.

### 5.6 The action layer (not pure, worth reading anyway)

`convex/foodsLookup.ts` is `'use node'` and holds the four OFF actions:
`lookupBarcode`, `searchByName`, `importFromOff`, `refreshFromOff`, plus
`storeOffImage`. Three separate defences on the image path, each named:

- `isOffImageUrl` — https + `*.openfoodfacts.org` only. "These are public
  actions, so the `imageUrl` each is handed is whatever a caller sent." Closes
  "gather's storage being used to mirror arbitrary files off the public
  internet."
- `safeFetch` (from `recipeImport.ts`) — redirect-revalidating private/loopback
  refusal. Closes SSRF.
- content-type `image/*` + 2 MB, checked on the header *and* on the blob, "A
  `content-length` that lies is caught by measuring the blob after."

`importFromOff` writes the row first and fetches the picture second so "the
external host never delays the add-sheet return"; `attachOffImage` then attaches
it only if the row still wants it, deleting the blob otherwise. That is the
`FILE_HOLDERS` discipline from gather's `CLAUDE.md` applied here.

`convex/recipeNutrition.ts` is 32 lines wrapping `estimateNutritionWithAi` —
`claude-sonnet-5`, one tool (`estimate_nutrition`) with a `found: boolean` escape
hatch, output run through `sanitizeNutrition`. Its comment names it as "The
single 'text → nutrition' seam (spec §4.2): a future NEVO or other lookup backend
replaces this function's internals without touching callers, schema, or UI."
Deferred by #51, but the seam is the reusable idea.

---

## 6. The Catalog rules

[ADR-0004](https://github.com/AppElent/gather/blob/main/docs/adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md),
implemented in `convex/lib/seed/apply.ts:applyCatalog` and enforced in
`convex/foods.ts:assertNotCatalog`.

**Identity.** Catalog rows and user rows share the `foods` table and are told
apart by `seedKey` alone — present on Catalog, absent on user rows. Catalog rows
also carry no `createdBy`, "because they have no author — which is what 'owned by
nobody' means."

**Reconciliation** (`applyCatalog`), per fixture: look up by `by_seedKey`;
`db.replace` (not patch) the first match, delete any duplicates (a duplicated
`seedKey` "is a data bug, not a reason to fail the deploy"), insert if absent.
Then sweep every row carrying a `seedKey` that is no longer shipped and delete
it. Rows with no `seedKey` are never touched.

**Read-only enforcement, in two places by design.** `assertNotCatalog` throws on
any row with a `seedKey`, and is called by `update`, `upsertFromOff` and
`applyOffRefresh`. The comment says why it is not only in the UI:

> "Every write path into `foods` goes through this, not just the edit form: these
> are public mutations, so a client can call any of them with any food id
> regardless of what the UI offers. Allowing a write would be worse than refusing
> it — the next Catalog seed overwrites unconditionally, so the change would
> silently revert."

The UI hides the edit affordance "rather than offering one that fails" — but
ADR-0004 notes "the refusal lives in the mutation, not only in the route, because
the route is reachable by URL."

**Why the seed wins.** "A shipped Catalog is app data, not user content. Its
figures get corrected between releases... Anything that lets a row opt out of
them leaves a database where some entries are silently frozen."

**Two alternatives gather rejected, and #51 has adopted one of them.**

1. *Preserve local edits with `localEdited`.* Rejected because `foods.update` has
   no ownership check on Catalog rows, so "one person's edit to a Catalog row
   changes it for everybody and freezes it against future corrections for
   everybody" — and because an editable-but-reverting row is a trap.
2. *Fork-on-edit.* Rejected **only for sequencing**: "It is the better end state,
   but it needs a decision about what happens to the `recipes` and
   `consumptionEntries` already pointing at the original `foodId`, and that is
   its own piece of work."

**#51 has already settled on fork-on-edit.** Gather's own words say that is the
better end state, and gather's own snapshot discipline is most of the answer to
the objection: an entry that already points at the original keeps its own
figures, so a fork does not need to migrate anything. This is worth recording as
the strongest single piece of evidence *for* the map's premise.

Fixtures live in `convex/lib/seed/catalogFoods.ts` — 33 `seedKey`s, hand-authored,
each with an emoji, per-100 figures and hand-authored servings. The fixture
header sets editorial policy: "representative generic values for cooking, not a
branded product's label — a specific product belongs in the app via a barcode
scan, not here." And `seedKey` "never changes once shipped, even if `name` does.
Renaming a key orphans the old row."

The Catalog is seeded by an explicit `convex run seed:seedCatalog` step in
`deploy:dev`/`deploy:prod`, "since Convex offers no post-deploy hook outside
previews." Consequence stated in the ADR: "The seed is therefore not atomic with
the deploy: a failed seed leaves new code running against un-reconciled data."
**#51's "ships as a code constant in `@workouts/core`" removes this entire class
of problem** — no reconciliation, no retirement sweep, no deploy-step ordering,
and no possibility of a dangling-because-retired `foodId`.

---

## 7. The UI surface

Routes (web, all under the Group segment — ADR-0002 puts the Group in the URL
even for Personal data, "the Group segment picks the navigation context and
nothing else: the page is identical in every Group"):

| Route | Renders | What it does |
| --- | --- | --- |
| `_app/nutrition.tsx` (layout) | `NutritionPage` + `<Outlet/>` | **The diary.** Stays mounted while the sheet is open. |
| `_app/nutrition/index.tsx` | nothing | "the address the sheet closes back to" |
| `_app/nutrition/add.tsx` | `AddSheet` | Adding food, as an address (`?meal=`, `?food=`) |
| `_app/combos.tsx` | `CombosPage` | The Combo library — browsing only |
| `_app/foods/index.tsx` | `FoodsPage` | Catalog browse + search |
| `_app/foods/$foodId.index.tsx` | `FoodDetailPage` | One food; "refresh from OFF" lives here |
| `_app/foods/$foodId.edit.tsx` | `EditFoodPage` | Edit form (never reached for Catalog rows) |
| `_app/foods/new.tsx` | `NewFoodPage` | Create, `?barcode=` `?name=` `?returnDate=` `?returnMeal=` |

**The diary** (`NutritionPage.tsx`, 197 lines) is: a date stepper with a native
date input, `DayTotals` (totals vs. `me.nutritionTargets`), then four `MealSlot`s
in `MEAL_NAMES` order, plus two links up top to the Foods and Combos libraries.
Those links are above the day rather than in the shell "because neither is a
Module — Foods is Catalog and a Combo is Personal — so nothing in the sidebar or
the dock claims a row for them."

`MealSlot` is keyed `` `${date}-${meal}` `` deliberately: a slot holds the ticks
for a Combo being saved, and those name rows of *this* day.

**The add sheet** (`AddSheet.tsx`, **1101 lines** — by far the largest single
file in the module) is the centre of gravity. Its docstring:

> "Adding food: one sheet, one list, no tabs. The dialog this replaces made you
> choose *what kind of thing* you were logging — Recipes, Foods or Quick add —
> before you were allowed to search for it. Here there is one search box and one
> list, with your foods, your Recipes and Open Food Facts in labelled sections.
> Quick add is not a separate place."

It is an *address*, not component state: "the phone's back gesture closes it, a
reload does not lose it, and it can be linked to." The `?food=` param is how a
just-saved food comes back ready to log — and it is *re-read from the server*
rather than carried in the URL, "because what is logged has to be the row as it
was written."

Everything else in `src/components/nutrition/` is small and testable:
`ServingPicker`, `DayTotals`, `MealSlot`, `ConsumptionEntryRow`, `ComboCard`,
`ComboActions`, `SaveAsCombo`, `ResultCard`, `FoodThumbnail`, `NutrientInputGrid`,
`BottomSheet`, `JustLogged`, plus four pure helpers with their own tests
(`kcal.ts`, `nutrientInputs.ts`, `sheetDetents.ts`, `nutritionNav.ts`,
`useFoodSearch.ts`).

One detail worth stealing: **the confirm button says why it is disabled** rather
than "being mysteriously grey."

The Combos page is browsing only, on purpose: "there is deliberately no builder
here: a Combo is made by saving a meal slot you have already filled in, which is
what the empty state explains instead of offering a button that would have to
invent one."

---

## 8. The ADRs, in one line each

- **[0003](https://github.com/AppElent/gather/blob/main/docs/adr/0003-three-scopes-personal-group-and-personal-records.md)
  — Three scopes.** *Superseded by ADR-0030*, retained as historical context, and
  still the source of the rule that matters: a Personal record snapshots what it
  references, provenance is permission-checked on read and may dangle. The scope
  taxonomy is dead in gather; **the snapshot rule is not**, and `CONTEXT.md`
  restates it as a live standing rule.
- **[0004](https://github.com/AppElent/gather/blob/main/docs/adr/0004-catalog-entries-are-read-only-and-the-seed-always-wins.md)
  — Catalog read-only, seed always wins.** §6. Explicitly names fork-on-edit as
  "the better end state" deferred for sequencing reasons.
- **[0011](https://github.com/AppElent/gather/blob/main/docs/adr/0011-the-ui-is-english-at-the-source-and-translations-are-typed-dictionaries.md)
  — English at source, typed dictionaries.** The consequence for this module is
  structural, not cosmetic: nutrient names, meal names and refusal messages moved
  *out* of `convex/`, validators return keys (`'comboNothingSelected'`), and
  content — a serving's label, a food's name, an emoji — is never translated.
- **[0012](https://github.com/AppElent/gather/blob/main/docs/adr/0012-a-combo-is-a-personal-shortcut-and-not-a-recipe.md)
  — A Combo is a Personal shortcut.** Why it is not a Recipe, why it holds
  references while a diary entry holds figures, why it is created only by saving
  a meal selection, why logging one never edits it, and why the entries it writes
  are badged.

Two ADR-0012 arguments transfer directly and are easy to lose:

- **Why not a builder:** "The alternative — a builder that opens empty and asks
  you to pick everything again — is how a Combo becomes a second food library to
  maintain, with its own staleness and its own reason to be abandoned."
- **Why the badge exists:** the expansion is *indistinguishable* from what it
  replaced, "so a save that did exactly what it promised left the meal looking
  untouched, and the first person to try it reasonably reported that nothing had
  happened. A shortcut you cannot tell has been applied is a shortcut nobody
  trusts."

Also relevant, and cited in the schema rather than in a nutrition ADR:
**0009** (a refusal never says which refusal it is — `combos.replaceItems`
returns one "Combo not found" for both cases), **0010** (photos are prepared, not
chosen — which is why a food's `imageId` can only ever be an OFF fetch), and
**0002/0031** (the Group in the URL, ambient on mobile).

---

## 9. Keep / adapt / drop — an opinion to argue with

### Keep, close to verbatim

1. **The snapshot discipline.** `nutrition` non-optional on a diary entry,
   `label` beside every reference, references allowed to dangle. It is the whole
   basis of #51's device/Convex split and it is already load-bearing in gather
   for reasons that have nothing to do with sync.
2. **Absent ≠ zero.** Cheap, correct, and impossible to retrofit once summaries
   assume otherwise.
3. **The three-way source split** — `source` / `nutritionSource` / `localEdited`
   — including `nextNutritionSource` deriving from the figures rather than
   trusting the caller. Workouts drops `'seed'` from `source` (a code-constant
   catalog is never a row) but keeps the other two axes intact.
4. **Three sources of servings, `rankLoggedAmounts` included.** For a fuelling
   app whose standard list is read-only, "what you have logged for this before"
   is the primary portion mechanism, not a nicety.
5. **`resolveAmount` as the one arithmetic seam** shared by client and server.
6. **Combos, references-not-figures.** ADR-0012's argument survives the change of
   job intact.
7. **The Combo badge on entries it wrote.** The bug it fixes is a UX bug, not a
   gather-specific one.
8. **The OFF split** — `offFetch` (I/O, never throws, injectable fetch) /
   `offMapping` (pure, dedupes, drops zero-nutrient hits). And the
   search-a-licious-vs-v2 fact, which cost gather a shipped bug.
9. **The add surface as an address, not state.** More valuable on a phone than on
   the web.
10. **Disabled controls that say why.**

### Adapt

1. **`meal` as a four-value enum.** Training days have pre/post-session eating
   that `breakfast|lunch|dinner|snack` describes badly. Either add slots or make
   the diary time-ordered. Note the cost gather paid: ADR-0012 rejected calling a
   Combo a "Meal" precisely because that word was already taken by this enum —
   changing it is cheap now and expensive later.
2. **Targets.** Gather has one flat per-nutrient set on the user, with
   `remainder()` as the whole feature. Fuelling wants targets that vary with
   training load, and a protein-first read. Keep `remainder`'s shape (return the
   number and which sentence it belongs in), replace what feeds it.
3. **The Catalog.** Fork-on-edit instead of refuse-to-edit, per #51 — which is
   the end state ADR-0004 itself preferred. A code constant deletes `seedKey`,
   `applyCatalog`, the retirement sweep and the deploy-ordering hazard. What it
   does *not* delete is the read-only *enforcement question*: a fork still needs
   `assertNotCatalog`-equivalent logic, and gather's "the refusal lives in the
   mutation because the route is reachable by URL" applies unchanged to a mobile
   client calling a public mutation.
4. **`quantityUnit`.** `'serving'` exists only for recipe entries
   (`consumption.ts`: "Food entries never use 'serving'"). With recipes cut, the
   union should shrink to `'g' | 'ml' | 'piece'` — and `consumption.update`'s
   `as 'g'|'ml'|'piece'` cast disappears with it.
5. **`nutritionSource: 'ai'`.** The union keeps the value even though #51 defers
   the estimator. Keeping the *seam* (`estimateNutritionWithAi`'s "single text →
   nutrition seam") costs nothing; building the estimator is the deferred part.
6. **The Foods/Combos library links.** Gather puts them above the day because
   neither is a Module. With Fuel as its own native tab, that placement is a
   fresh decision.

### Drop

1. **All Group scoping.** No `isVisibleToGroups`, no `getMyGroupIds`, no
   `viewerGroupIds` threading, no ADR-0009 refusal-uniformity in this module.
   Roughly half of `consumption.ts`'s and `combos.ts`'s server complexity is
   Group-visibility handling for the *recipe* reference alone.
2. **`recipeId` everywhere** — cut at charting. That removes
   `computeRecipeEntryNutrition`, `entryThumbnail`'s recipe branch,
   `recomputeFromSource`'s recipe branch, `resolveComponent`'s recipe branch,
   `nextNutritionStale`, `NutritionStaleState` and `parseServings`.
3. **`source: 'seed'`** — see above.
4. **Dutch-first naming in `offMapping`** (`product_name_nl` preference) and the
   `langs` default. Re-decide, don't inherit.
5. **The Catalog seed machinery.** `applyCatalog`, `seedKey`, the retirement
   sweep, the deploy step.
6. **The image pipeline, at least in v1.** `imageId`, `attachOffImage`,
   `storeOffImage`, `fetchAndStoreOffImage`, `isOffImageUrl`, and the
   `getUrl`-returns-an-unauthenticated-URL tradeoff. The `icon` emoji covers the
   same job at a fraction of the surface — and gather's own Catalog rows already
   rely on the emoji tier rather than a picture.
7. **`nutritionStale`** — a recipe concept.

### The thing I'd flag hardest

`consumption.update`'s recompute-on-quantity-change is the **only** place the
snapshot is re-derived from a live source, and it is the only place the
device/Convex split actually bites: a device-local food's figures are not
readable from the server. Gather's existing fallback — scale the snapshot, and
only when the unit is unchanged — is already the right answer, but it means an
edited quantity on a device-local food is *scaled*, not recomputed. Those differ
whenever the food's figures have been corrected since. It is almost certainly
fine, and it should be decided rather than inherited.

---

## Sources

All under `/home/user/gather` (`AppElent/gather`):

`convex/schema.ts` · `convex/foods.ts` · `convex/foodsLookup.ts` ·
`convex/consumption.ts` · `convex/combos.ts` · `convex/recipeNutrition.ts` ·
`convex/users.ts` · `convex/seed.ts` · `convex/lib/nutrition.ts` ·
`convex/lib/consumption.ts` · `convex/lib/servings.ts` · `convex/lib/combos.ts` ·
`convex/lib/offFetch.ts` · `convex/lib/offMapping.ts` ·
`convex/lib/foodSearchText.ts` · `convex/lib/nutritionAiEstimate.ts` ·
`convex/lib/seed/apply.ts` · `convex/lib/seed/catalogFoods.ts` ·
`packages/core/src/domain.ts` · `src/routes/_app/nutrition.tsx` ·
`src/routes/_app/nutrition/{index,add}.tsx` · `src/routes/_app/combos.tsx` ·
`src/routes/_app/foods/*` · `src/components/nutrition/*` ·
`src/components/foods/*` · `CONTEXT.md` · `docs/adr/000{3,4,9}-*.md` ·
`docs/adr/001{1,2}-*.md`
