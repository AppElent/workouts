# Food search above the keyboard: final study companion (APP-244)

Eric approved option B on a decision card on 18 Nov 2026 ("B: onderin, lijst stopt erboven"). The study follows up APP-56 (workouts #238), which only cleared the end of the list.

- Canvas: [Foundry — Nutrition logging](https://claude.ai/artifact/EibJXFqbgbBruHk84LxvTN), page `APP-244 Food picker search`.
- Artboards: [`food-search_final/`](food-search_final/). Every screen comes from one part, `Phone.dc.html`, with the props `variant` (`now` | `A` | `B`), `theme`, `device` (`pro` 390×844 | `se` 375×667) and `screen` (`log` | `library`). [`overview.png`](food-search_final/overview.png) shows Now, A, B and B on SE side by side.
- Keeps the approved [log food](log_final.html) layout (search in the iOS 26 bottom toolbar) and the [food library](library_final.html).
- In the implementing change, update [Nutrition logging](../../docs/contracts/nutrition-logging.md) ("Bottom search") and [Nutrition foods](../../docs/contracts/nutrition-foods.md) (library search).

## Problem

On iOS 26+ the search field floats above the keyboard, outside the system keyboard inset. Results scroll on underneath it. A row's + or chevron can still be seen through the glass, but a tap there lands on the field or on its close (X) button, which sits in the same column as the +. The keyboard closes, the query clears and nothing logs. On iPhone SE the first results reach the field right after typing.

## Decisions

1. **Search stays at the bottom** (B). Option A, stacked search in the navigation bar while typing, was rejected because it reverses the approved bottom search and moves the field out of thumb reach.
2. **The list ends above the field.** While the keyboard is up on iOS 26+, the results list's **frame** ends 8 pt above the top of the floating field. The band from there to the keyboard top is plain `bg` with a 0.5 pt `border` hairline at its top. No row is ever drawn under the field or its X. Rows clip at the list's bottom edge like any scroll view. A content inset alone does not meet this rule, because rows would still scroll under the field.
3. **Compact header while a query is typed** (log food only). With a non-empty query:
   - The meal summary ("Lunch · 2 items · 540 kcal") is hidden. It comes back when the query is cleared or search closes.
   - "Opslaan als notitie" leaves the list header. It stays in the toolbar + menu (`menu.canSaveAsNote`), which already offers it.
   - The scope chips stay.
   Result: iPhone SE shows 3 to 4 result rows right after typing, against 1 to 2 today.
4. **Keyboard closed:** nothing changes. The list runs to the bottom toolbar as today, and APP-56's bottom clearance stays for the end of the list.
5. **Library** ([`library-screen.tsx`](../../apps/mobile/src/features/nutrition/library/library-screen.tsx)) gets decision 2. Its rows end in a chevron and open the item, and the same overlap closes the keyboard there. The library header (chips) is already compact, so decision 3 does not apply.
6. **Platforms:** iOS < 26 and Android keep the in-content search row, so nothing floats there and they need no change. Web is not affected.

## Screens

| Artboard | Shows |
| --- | --- |
| `Main.dc.html` | Now: Kippensoep's + under the X (dashed marker), iPhone 17 Pro, dark |
| `A-top.dc.html` | Rejected option A, for the record |
| `B-bottom.dc.html` | B, log food, iPhone 17 Pro, dark: compact header, list stops 8 pt above the field |
| `B-se-light.dc.html` | B, log food, iPhone SE, light, right after typing "kip" |
| `B-library.dc.html` | B, library, iPhone 17 Pro, dark |

Copy is unchanged; no new strings.

## States

- Keyboard up with a query: decisions 2 and 3.
- Keyboard up without a query (field just focused): decision 2. The header is unchanged (summary visible).
- Keyboard dismissed interactively (`keyboardDismissMode="interactive"`): the list frame follows the keyboard down. When it is gone, the list runs to the toolbar again. There must be no jump at the end of the drag.
- Larger text (Dynamic Type XL): rows grow and fewer fit, and the rule is the same.
- Light and dark: the band uses `bg`, so both themes follow from tokens.
- Reduce Motion: the frame change follows the keyboard animation and adds no motion of its own.

## Acceptance

- One tap on any visible + (log food) or row (library) logs or opens it with the keyboard open. This must hold on iPhone SE right after typing and mid-scroll, on iOS 26 and 27.
- No pixel of a result row is drawn between the band's top and the keyboard.

## Runtime questions

- Measure the floating field's height and gap (64 pt total today, `FLOATING_SEARCH_CLEARANCE`) and the keyboard top on iOS 26 and 27. The `automaticallyAdjustKeyboardInsets` route over-insets by about 290 pt (APP-56 notes), so drive the list's bottom from the keyboard frame (for example a keyboard-height hook) plus the field clearance.
- Check whether the native bottom scroll edge effect still draws over the band. If it does, a `hidden` or `hard` bottom edge effect on this screen is fine.
- Maestro cannot read the Nutrition tab hierarchy on iOS 27. Use a component test for the layout values and device screenshots for the acceptance checks.
