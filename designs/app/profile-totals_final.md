# Profile lifetime totals — final study companion (APP-57)

Approved by Eric on a decision card, 17 Nov 2026 ("Vier totalen zoals ontworpen"). Round 3 after [round 2](profile_round2.html) (approved 6 Oct 2026), which had sessions, km and PRs.

- Canvas: [Foundry — Profile & settings](https://claude.ai/artifact/5WL2hvuHoXNQnK9FhN1aqf), page `APP-57 Lifetime totals`.
- Artboards: [`profile-totals_final/`](profile-totals_final/). The web Account artboards are in [`../web/appearance_final/`](../web/appearance_final/) (shared with APP-39).
- Update [the Profile contract](../../docs/contracts/profile.md) ("Summary" and "Out of scope") in the implementing change.

## Decisions

1. All-time totals, no period menu (round 2).
2. Four figures, each a button opening Activity history with a sport filter: trainingen → `/activity-history` (all), ton getild → `?sport=strength`, km hardgelopen → `?sport=running`, km gefietst → `?sport=cycling`.
3. PRs are left out until a PR is defined.
4. Web shows the same four figures on Account; each links to the Log page. `features.ts` gets a `profile-totals` (or extended profile) entry with status parity.

## Data

- New read-only query `api.profile.totals` → `{ since: number | null, activities: number, strengthVolumeKg: number, runningMeters: number, cyclingMeters: number }`. Activities = finished strength sessions + runs + rides, not cancelled, not test data. Volume = Σ weight × reps of completed working sets. Tests in Convex.
- Large histories: if the query would read too many rows, keep a per-user counter document updated by the existing mutations (round 2's note); decide in implementation, record in the PR.
- Offline: keep the last totals and their fetch time on the device (like the nutrition operations) so Profile can show them offline.

## Screen (`profile.dc.html`)

Order: large title "Profiel" → account row → **summary card** → footer → "Alle activiteit" → Voorkeuren → Voeding → … (unchanged).

- Card: `surface`, radius 24 (`contentCard`), 2×2 grid of buttons, min height 64, padding 10/12; pressed = `surface2`.
- Each figure: value 24/800 tabular (unit in 14/600 `textMuted` after it), label 13 `textMuted` with "›".
- Values (nl): "{n}" "trainingen"; "{t}" + "ton" "getild" (one decimal below 100 t, else integer); "{km}" + "km" "hardgelopen"; "{km}" + "km" "gefietst". Thousands separator per locale ("1.840").
- Accessibility label: "{n} trainingen, alle activiteit", "{t} ton getild, krachttrainingen", "{km} kilometer hardgelopen", "{km} kilometer gefietst".
- Footer: "Sinds {d MMMM yyyy}. Tik een getal voor de activiteiten erachter."
- en: "workouts", "tonnes lifted", "km run", "km cycled", "Since {date}. Tap a number for the activities behind it."

## States (`P57-States.dc.html`)

- Loading: skeleton blocks for the numbers only (still, no animation), card height unchanged.
- New account (zero activities): card replaced by "Nog geen activiteit" / "Je trainingen, getilde kilo's en kilometers verschijnen hier na je eerste training." + primary pill "Start een training" (opens Start activity). No zeros.
- Offline: existing offline line becomes "Offline · totalen van {HH:mm}"; figures from cache, not tappable. No cache: the card is hidden.
- Error online: "Totalen niet geladen" / "Je instellingen werken gewoon." + text action "Opnieuw proberen".
- A sport with 0: the figure shows "0 km" (honest), still tappable.

## Web

Account page, first card "Sinds het begin": four figures in one row on desktop, 2×2 at phone width, each `<a>` to `/log`, hint "Sinds {date}. Elk getal opent het Logboek." Loading/empty/error as on the phone.

## Verify

iOS simulator light/dark/SE, Android; web desktop and 390 px light/dark. Compare with the artboards.
