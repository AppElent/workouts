# Typed foods recognised before AI entry: final study companion (APP-626)

On 23 Nov 2026 Eric chose option A on a decision card: recognise the foods where you already type, in the Log food search field. He doubted round 1's card at the top of the results ("Popup far above keyboard, search underneath") and asked for a council. Opus and Sol both picked a compact tray directly above the search field. Sol stood in for Gemini, whose session would not open. Eric approved the tray on a decision card the same evening ("Goed, bouwen").

- **Canvas:** [Foundry — Nutrition logging](https://claude.ai/artifact/EibJXFqbgbBruHk84LxvTN), page `APP-626 Typed lines`.
- **Artboards:** [`typed-lines_final/`](typed-lines_final/). Every screen comes from one part, `Typed.dc.html`, with these props:
  - `screen`: `search` (round 1 card) | `tray` | `live` | `review` | `resolved` | `offline`
  - `theme`
  - `device`: `pro` 390×844 | `se` 375×667
- **Keeps:**
  - the approved [AI entry](ai-entry_final.html) review table
  - the [food search above the keyboard](food-search_final.md) rule (APP-244): the list ends above the field
- **Contracts to amend in the implementing change:** [Nutrition logging](../../docs/contracts/nutrition-logging.md). It says AI entry replaced the strict text parser and that + logs at once; allow a local review of recognised text.

## Decisions

1. **The phone recognises the text first.**
   - It splits the search text on comma, "en" and new lines.
   - It reads an amount and a unit: g, kg, ml, l, dl, stuks, ½, 1,5, and Servings such as boterham, plak or eetlepel.
   - It matches each name with the existing food search over Shipped and Personal Foods.
   - None of this needs AI, consent, a connection or the daily limit.
   - Parser: copy Gather's grammar, with Foundry's own unit table.
2. **A tray sits directly above the search field** (`T-tray`, `T-tray-se`). The tray is one button, 52 pt high, 8 pt above the field. Its content:
   - Line 1, semibold: "3 herkend · 1 niet herkend". The unmatched count is `warn` and has a small dashed-ring icon, so colour is not the only signal.
   - Line 2, caption, one line, ending in an ellipsis when it is too long: the recognised names and the total kcal, for example "Ei, Kwark, Kaas · ~291 kcal". Show `~` when any amount is estimated.
   - Trailing: "Controleer ›".
3. **The tray opens the review and never logs by itself.** Review is the AI-entry table (`R-review`):
   - Recognised rows come first. A row opens the amount editor.
   - An unmatched part is a dashed row: "Niet herkend · wordt niet gelogd", with "Vraag hulp" (AI for that part only, one analysis) and "Kies zelf" (search prefilled with the part).
   - The button counts matched items only: "Log 3 items".
   - After logging, show the undo toast, clear the logged parts from the field, and keep the unmatched text.
4. **Results above the tray are for the active part only.** That is the last unmatched or unfinished part ("Resultaten voor 'pesto'"), never the whole sentence. This includes the Open Food Facts lookup.
5. **When the tray shows:**
   - Show it only when the text has 2 or more parts, or one part with an explicit amount ("150 g kwark").
   - Never show it for a plain single-food search ("kwark"), in Combo add or replace, or in barcode linking.
   - With 2 or more parts and nothing recognised, it reads "Niets herkend · Vraag hulp of kies zelf ›" and opens the same sheet.
6. **Timing:** the tray appears after about 300 ms without typing and updates in place, with no spinner. While a trailing part is still incomplete, it keeps the last valid counts.
7. **Keyboard closed:** the tray stays while the text remains and sits 8 pt above the bottom toolbar, inside the safe area. Clearing or cancelling search removes it. Opening the review dismisses the keyboard, and closing the review does not bring it back.
8. **✨ Hulp bij invoeren** keeps its place next to the field. It also matches on the phone first and sends only the leftovers to AI (`live`).
9. **Offline** (`R-offline`):
   - Recognition and review work on shipped and cached foods.
   - "Vraag hulp" is disabled and says "Verbinding nodig".
   - Logging is disabled with a reason, because saving to the diary needs a connection.
10. **Platforms:**
    - On iOS 26+ the field is the native `Stack.SearchBar`, so the tray floats at keyboard top + the field's height. Reuse `NutritionKeyboardOverlay`.
    - On iOS < 26 and Android the field sits in the list header. Put the same tray directly below it.

## Screens

| Artboard | Shows |
| --- | --- |
| `T-tray.dc.html` | The tray above the field, iPhone 17 Pro, dark |
| `T-tray-se.dc.html` | The tray on iPhone SE, light |
| `R-review.dc.html` | Review: 3 recognised, 1 unmatched (not logged) |
| `R-resolved.dc.html` | After "Vraag hulp" on the unmatched part only |
| `R-offline.dc.html` | Offline: recognition and review still work; logging and help are disabled until a connection returns |
| `A-search-se.dc.html` | Round 1's card under the chips (rejected), for the record |

## Layout (iPhone SE, keyboard open)

| Region | Height (pt) |
| --- | --- |
| Status and navigation bar | ~64 |
| Results, with the chips scrolling in the list header | rest, ~225 |
| Tray + gap | 52 + 8 |
| Floating search field | ~58 |
| Keyboard | ~260 |

- The list's bottom clearance (64 pt today, tested since APP-56) grows by the tray's measured height, so no + sits under the tray.
- While the tray shows, the "Beschrijf je maaltijd" row in the list header is hidden.

## Accessibility

- **VoiceOver order:** title, chips, results, tray, search field, toolbar.
- **Tray label:** "3 herkend, 1 niet herkend, ongeveer 291 kilocalorieën", with the hint "Opent controle". Announce politely when the settled counts change, never on each keystroke.
- **Size:** at least 44 pt tall, and it grows with the text. At large Dynamic Type sizes, drop line 2 and wrap "Controleer ›" under line 1. The results area gives up the space. Respect Reduce Motion.

## Copy (nl / en)

| Key | nl | en |
| --- | --- | --- |
| Tray counts | {n} herkend · {m} niet herkend | {n} recognised · {m} not recognised |
| Tray, none | Niets herkend · Vraag hulp of kies zelf | Nothing recognised · Ask for help or pick yourself |
| Tray action | Controleer | Review |
| Unmatched row | Niet herkend · wordt niet gelogd | Not recognised · won't be logged |
| Help | Vraag hulp | Ask for help |
| Pick | Kies zelf | Pick yourself |
| Offline help | Verbinding nodig | Needs a connection |
| Log button | Log {n} items | Log {n} items |

## Build risks (check first)

1. **The tray following the keyboard.** On an iPhone SE with iOS 26+, the overlay must follow the keyboard during open, interactive drag (`keyboardDismissMode="interactive"`) and dismiss. It must never cover the native field. If it can't, hide the tray during the drag; do not fall back to an expanded list. Do not host it in `InputAccessoryView`.
2. **The AI-entry review screen asks for AI consent before anything else.** Extract its review presentation, or add a local review entry that skips consent. `groundItems` and `buildAssistanceFoodCatalog` look reusable. Build the catalog once, not on every keystroke.
3. **Search currently gets the raw query** (`useLogFoodItems`, `useOffSearch`). Derive the active part from the text, because the native change event gives no cursor position.

No schema change.

## Council

- [Opus 5.5](https://app.t3.codes/threads/0c0eb609-de32-4bb4-9af2-7ae149502aa0/mcp%3Alaunch%3Aa8e37d8c39f106bb61a216ffbad141cdb7f240ec79bd8f6928434e5927113844)
- [Sol, standing in for Gemini](https://app.t3.codes/threads/0c0eb609-de32-4bb4-9af2-7ae149502aa0/mcp%3Alaunch%3A821953eccccee1905a85490ff6f7641b48a0c177816352f9699981c6a57dc032)

The goal was to choose one of four placements. Both chose the tray. They rejected:
- **An expanded list above the field:** it leaves about 95 pt for results, and it is a nested scroller next to the keyboard drag.
- **A list anchored to the bottom:** rows shift under the finger, and paging fights the order.
- **A mode switch:** the results flip when a comma is typed or deleted, and you lose plain search.
