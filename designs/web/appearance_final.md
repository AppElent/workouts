# Web appearance choice — final study companion (APP-39)

Approved by Eric on a decision card, 17 Nov 2026 ("Goedkeuren").

- Canvas: [Foundry — Profile & settings](https://claude.ai/artifact/5WL2hvuHoXNQnK9FhN1aqf), page `APP-39 Web appearance`.
- Artboards: [`appearance_final/`](appearance_final/) — `Web-Account.dc.html` (desktop light with Systeem, dark with Donker), `Web-Phone.dc.html` (390 px light with Licht, dark with Systeem).

## Context

Light and dark tokens already ship in `src/styles.css` (#221) and follow `prefers-color-scheme`. Missing: a choice, which the phone has (Appearance: System, Light, Dark).

## Decisions

1. Account gets a card "Voorkeuren" (after the totals card from APP-57, before Profiel) with two rows: Weergave and Taal.
2. Weergave is a three-way segmented radio group: Systeem, Licht, Donker. Selected segment = `accent-fill` with `on-accent`; track `surface-2`; pill radius; min height 34 (desktop) / 40 (phone width).
3. Hint under it: Systeem "Systeem volgt de instelling van je apparaat. Opgeslagen in deze browser."; Licht "Altijd licht in deze browser."; Donker "Altijd donker in deze browser, wat je apparaat ook doet." (en: "System follows your device setting. Saved in this browser." / "Always light in this browser." / "Always dark in this browser, whatever your device does.")
4. Taal: a select (Nederlands, English) bound to the existing `setLocale`. The sidebar keeps its NL/EN shortcut; no theme toggle in the sidebar.
5. Per-browser storage (localStorage `foundry.theme` = system|light|dark), not synced to the account.
6. `features.ts`: `theme` → status parity, platforms web + mobile, web route `account`; drop its `pending-port` reason.

## Implementation notes

- Tokens: keep `:root` light and the dark block, but scope dark to `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` plus `:root[data-theme="dark"] {…}` with the same values. `color-scheme` follows the choice.
- Apply before first paint: a tiny inline script in `__root.tsx` head reads storage and sets `data-theme` on `<html>` (no flash). Systeem removes the attribute, so OS changes apply live.
- Update the two `theme-color` meta tags when a fixed theme is chosen.
- Storage access in try/catch; a failure keeps Systeem and shows nothing.

## Verify

Desktop and 390 px, each of the three choices with OS light and OS dark; reload shows no flash; keyboard: arrow keys move within the radio group. Compare with the artboards.
