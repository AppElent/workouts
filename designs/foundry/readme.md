# Foundry Design System

Foundry is the iOS-first mobile client of **AppElent Workouts** — a fitness and
health tracking platform that started as a strength tracker and is expanding
into a multi-sport activity log with nutrition alongside it. The phone app is
Expo / React Native (`apps/mobile`); a separate TanStack Start web app shares
the same Convex backend and Clerk auth.

This design system describes the **phone** first. The web app historically
ran a separate Spotify-green-on-black look; as of 2026-09-18 (UI-Redesign) it
adopts Foundry's palette and tokens too, so both clients share one look. The
phone stays the reference: never transcribe web conventions back over it.

## Sources

Everything here was read from source, not reconstructed from screenshots:

- **GitHub — <https://github.com/AppElent/workouts>** (branch `main`), primarily
  the `apps/mobile` subtree. Worth exploring further for anything this system
  does not cover: `apps/mobile/DESIGN_SYSTEM.md` (the app's own written design
  contract), `apps/mobile/src/theme/tokens.ts` (the palette, ramp and metrics),
  `apps/mobile/src/ui/*` (the component seam), `apps/mobile/src/screens/*`
  (every screen), `docs/ios-native-verification.md` (the device acceptance
  checklist), `CONTEXT.md` (the product's vocabulary), and
  `designs/shell/index.html` (the "Coach" shell direction the phone was laid
  out from).
- No Figma file, no brand book and no font files were provided.
- Muscle-group illustrations are not duplicated here; specimens reference the
  repo's own `public/muscle-icons/*.png`.

See `github.md` for the sync record and the screen → source map.

### Product surfaces

| Surface | Status here |
| --- | --- |
| **Foundry** — iOS/Android phone app (`apps/mobile`) | Fully covered: tokens, components, `ui_kits/foundry-ios` |
| Workouts web app (`src/`, Tailwind + Base UI) | Adopts the Foundry palette and tokens (decision 2026-09-18, UI-Redesign branch); the earlier Spotify-green look is being retired. Native-chrome rules do not apply; the phone remains the reference. |
| Convex backend, CLI | No UI |

### Brand mark

**There is no Foundry logo.** The only marks in the repo are placeholder React
and PWA icons (`public/logo512.png` was the stock React atom), so nothing was
copied in and nothing was drawn. Wherever a mark would go, set the word
**Foundry** in the system face at weight 800 — that is what `thumbnail.html`
does. Ask the design owner for a real mark before shipping anything public.

## Content fundamentals

The app's copy is unusually disciplined, and the discipline is the brand.

- **Sentence case everywhere.** "Start activity", "Log set 3", "Cancel
  workout", "Delete routine". Never Title Case, never ALL CAPS in a sentence —
  uppercase is reserved for the tracked micro-labels (`Eyebrow`, stat labels).
- **Actions are verbs with their object.** Confirm buttons say what they do:
  "Delete exercise", "Cancel workout", "Delete routine" — *never* "OK", "Yes"
  or "Confirm". The safe answer is also a verb: "Keep", "Keep going".
- **Say the consequence, not "Are you sure?"** — "Sets you already logged are
  kept.", "Every set and 1RM logged against it goes too."
- **Second person, implied.** The UI addresses the user without pronouns
  ("Ready to move", "No sessions yet — start one above."). "You" appears only
  where it must ("changes sync when you reconnect"). "We" never appears.
- **Empty states are a sentence plus a route**, never a shrug: "A routine is a
  template — the exercises, sets and reps you repeat." / "Log a few sets and
  your 1RM and volume trends appear here." / "Nothing matches — try clearing a
  filter or two."
- **Numbers are qualified honestly.** `≥ 120` for an incomplete total, `~ 120`
  for an approximate one, "Not enough data yet." instead of a chart with one
  point, "Reference goals — historical targets are not known."
- **Short labels; the screen title carries the context.** A row in Exercises
  says "Delete", not "Delete this exercise".
- **Em dashes and middle dots do the work of punctuation.** "compound ·
  barbell", "Zone 2 · nice and easy", "kg · km".
- **Bilingual by construction.** Every string comes from the message tree
  (`src/i18n/messages`), English and Dutch. Copy must survive Dutch length and
  Dynamic Type XL — labels wrap to two lines rather than truncate.
- **No emoji. Ever.** Not in copy, not in labels, not as icons.
- **Vibe:** a calm, competent training log. Energetic when progress matters
  (one lime accent, a big number), silent while entering data.

## Visual foundations

**Colour — two themes.** Dark is the base and the app's origin; light was added
here on top of it. The app follows the OS setting (`prefers-color-scheme`);
`.theme-light` / `.theme-dark` force a mode for mocks and specimens.

*Dark:* three grounds (`--bg` #0a0b09 warm near-black, `--surface` #141613,
`--surface-2` #1d201b), one lime accent (`--accent` #c8f73c) with near-black ink
on it. Elevation is colour, not shadow.

*Light:* warm off-white ground #faf9f5, white cards, one raised step #f3f2ec,
ink #1b1d18, and a 1px card shadow (the only place this system uses one).

**The rule light mode turns on:** lime on white is ~1.4:1, so it can be a
**fill** but never ink. `--accent` stays lime for filled controls in both
themes; `--accent-ink` carries every accented text, icon, stroke and chart
series — lime #c8f73c in dark, deep olive #55700c (5.6:1 on white) in light.
Components read `--accent-ink` unconditionally; if you write `var(--accent)` on
text, light mode breaks.

Three ink weights, no fourth. Semantics per theme: `--danger` #ff6b6b / #c0302c,
`--success` #4ade80 / #157f45, `--warn` #fbbf24 / #9a6600, each with a soft tint
for backgrounds. Activity types keep four fixed hues — lime, orange, cyan, pink
in dark; darkened equivalents (#5f7a10, #c2540f, #0d7e8c, #c22b43) in light, so
they stay legible as labels on their own tint.

**Type.** The system face only — SF Pro on iOS, Roboto on Android. No webfonts
are bundled. Two layers live side by side: the app's original named ramp
(display 32 / title 24 / metric 28 / heading 18 / body 15 / label 13 / caption
12) and a **native iOS layer added in the density pass** — large title 34/700
(−0.8), nav title 17/600, row title 17/600 (−0.2), secondary 15/400, footnote
13/400, control 16/600. New work uses the native layer for chrome and grouped
lists; `AppText` exposes it as `variant="row" | "secondary" | "footnote"`.
Screens pick a name and never a raw size. Numbers that matter use
`tabular-nums`. Uppercase + 0.4px tracking only for eyebrows and stat labels.

**Spacing and layout.** A 4-point grid (4/8/16/24/32/48). Screen gutter 20,
form gutter 16, section gap 18, **row min-height 48** (44 is the floor), field
44, control capsule 46, hit target 44 — always as minimums, never fixed
heights, so Dynamic Type can grow a row. Separators are a **0.5px hairline
inset 16px** from the leading edge, never full-bleed. Space between sections is
bigger than space between related rows; rows inside a group touch. Content
columns cap at 640px so a tablet does not stretch a form.

**Lists over cards.** A collection is an `InsetList` of `InsetRow`s — the iOS
inset grouped list — not a stack of individual cards. Cards are for one object
or one summary. This single choice is most of what separates a native-feeling
screen from a web page.

**Fields are rows, not boxes.** Inside a `FormSection` a field is borderless:
the label sits left, the value is right-aligned on the group's own surface, and
focus shows only a caret in `--accent-ink` — no ring, no border change, no
filled rectangle. A box inside an already-bordered group is the strongest "web
form" tell there is. Errors are a 13pt red footnote under the row. The **only**
boxed input in the system is `SearchField` (36pt, radius 10, on
`--surface-2`), which sits above a list rather than inside a group. Long values
use `layout="stacked"`; notes use `multiline`.

**Backgrounds and imagery.** Screen and surface backgrounds are flat opaque
colour — no gradients, textures or patterns, and no full-bleed background
photography. Photography appears only as **content**, in five defined slots:

| Slot | Component | Ratio | Source |
| --- | --- | --- | --- |
| Exercise library row | `MediaThumb` | 1:1, 36–44px | Generated exercise stills |
| Routine / today's workout card | `HeroCard` | 16:9 | Generated gym imagery |
| Nutrition diary row | `MediaThumb` | 1:1, 40px | Open Food Facts product photos |
| Meal entry | `MediaThumb` / `HeroCard` | 1:1 / 16:9 | The user's own camera |
| Progress photo | `HeroCard` | 4:3 | The user's own camera |

Every slot treats "no image" as a supported state, not an error: `MediaThumb`
falls back to a muted initial on a raised surface and `HeroCard` keeps a flat
image well, both without changing height. Copy sits **below** an image by
default; `overlay` (copy on the photo behind a bottom protection gradient) is
only for imagery you control. The other bitmap set is the muscle-group anatomy
figures (`public/muscle-icons/`) — grey figures with a red highlight, cool and
clinical, used small next to exercises.

⚠️ **No photography has been produced yet.** The slots, ratios and fallbacks
are defined and the fallbacks are what currently renders.

**Transparency and blur.** Strictly for functional chrome: native headers
(`systemUltraThinMaterialDark`), the tab bar, sheet scrims and iOS 26 Liquid
Glass. Content is opaque, always — the rule in the app's own words is "let the
system own its material and motion instead of imitating it in React Native".
Tokens `--glass-chrome`, `--glass-chrome-strong`, `--glass-blur` exist for HTML
mocks only.

**Corners.** Continuous ("squircle") corners: 4/6/8/12 for small parts, 14 for
shell rows and tiles, 18 for content cards, 20 for sheets. Pills (9999) are
reserved for the primary action, chips, the resume bar and the rest timer — not
for every tappable thing.

**Cards.** `--surface` fill, 1px `--border` hairline, 18px radius, 16px
padding, no drop shadow. Elevation is colour, not shadow: raise a surface by
stepping `bg → surface → surface-2`. Shadows appear only under things that
genuinely float — sheets (`--shadow-sheet`) and menus (`--shadow-menu`).
An in-progress card swaps to the `--accent-dim` fill with an `--accent` border.

**States.** Press is a **colour change, not a fade**: accent → `--accent-pressed`,
rows and ghost buttons → `--surface-2`. (The reasoning in the repo: at arm's
length mid-set, a colour change reads and a fade does not.) Disabled is opacity
0.5. Selected is a filled accent capsule plus an announced state — colour is
never the only signal. Destructive intent is always red text/fill *and* a
confirmation. Haptics: one warning buzz on destructive confirm, one success buzz
when rest ends, one tick at a swipe threshold. There is no hover state; this is
a touch product.

**Motion.** Navigation, sheets and menus are native — nothing hand-animated.
In-app motion is one spring to settle a swiped row (`--ease-ios`
cubic-bezier(.32,.72,0,1), ~250ms) and native modal fades. Reduce Motion cuts
the snap to an instant move. **Nothing loops** — skeletons are deliberately
still, which is how Reduce Motion is honoured without a branch.

**Charts.** One series, `--accent-ink`. 2px line, 3px points, 16px bars with a
rounded top, no grid rules, transparent y-axis, 9px `--text-faint` ticks. Under
two points it says "Not enough data yet." instead of drawing. Bounded counts use
`ProgressRing` (one arc, number in the hole, 48px minimum); multi-segment
donuts and per-series hues were considered against the reference kit and left
out — the nutrition day uses a linear track per nutrient instead.

## Iconography

- **In the app: SF Symbols**, via `expo-symbols` (`SymbolView`) and
  `NativeTabs.Trigger.Icon sf="…" md="…"`. Names in use: `house.fill`,
  `play.fill`, `fork.knife`, `chart.bar.fill`, `person.fill`,
  `magnifyingglass`, `trash`, `arrow.right`. Android gets the Material name on
  the same call. **No icon font, no SVG icon set, and no PNG icon sprite is
  bundled.**
- **Unicode glyphs are used inline and deliberately** for small affordances:
  `›` `‹` (chevrons, always `--text-faint` or `--accent`), `＋` `−` (steppers and
  add rows), `✕` (dismiss), `···` (row menu), `⌃` `⌄` (group expand), `☑` `☐`
  (selection), `●` (training marker), `⌕` (empty search).
- **SF Symbols cannot be redistributed to the web**, so HTML mocks in this
  system substitute **Lucide** via the `iconify-icon` CDN element, mapped
  SF-name → Lucide-name inside `components/core/Icon.jsx`. ⚠️ **Flagged
  substitution** — the stroke weight is close but not identical, and the app
  itself must keep using SF Symbols.
- The only bitmap icons are the muscle-group figures in
  `public/muscle-icons/` (15 PNGs, ~512px).
- Activity types are represented by a tinted tile with a **letter** glyph
  (S/R/C/W) — `SportIcon` — not by a sport pictogram.
- No emoji, anywhere.

## Fonts

No font files exist in the repo and none are needed: the app uses the platform
system face. `--font-system` names `-apple-system`, `SF Pro Text`, `SF Pro
Display` and then falls back to `system-ui`/Roboto, so macOS and iOS render the
real thing and everything else renders the closest native equivalent. **No
Google Fonts substitution was made** — substituting a webfont here would make
every mock look less like the app, not more. If you want Foundry mocks to match
iOS exactly on Windows, send SF Pro (Apple licenses it for design use) and it
can be added as `@font-face`.

## Index

| Path | What it is |
| --- | --- |
| `styles.css` | The entry point consumers link — `@import`s only |
| `tokens/` | `colors.css` (dark base), `light.css` (light theme + `.theme-*` scopes), `sports.css`, `typography.css`, `spacing.css`, `radius.css`, `effects.css`, `motion.css` |
| `components/` | React primitives, grouped by concern (below) |
| `ui_kits/foundry-ios/` | Click-through recreation of the phone app + its own README |
| `guidelines/` | 23 foundation specimen cards (Colors, Type, Spacing, Brand) |
| `explorations/` | The four light-mode accent candidates; olive was chosen |
| (`../../public/muscle-icons/`) | 15 muscle-group illustrations — the repo's copy, not duplicated |
| `thumbnail.html` | Homepage tile |
| `github.md` | Source repo, last sync, screen → file map |
| `SKILL.md` | Agent Skills front-matter for use in Claude Code |

### Components

**`components/core/`** — `AppText`, `Card`, `Chip`, `SportIcon`, `StatBox`,
`Eyebrow`, `SkeletonBlock`, `SkeletonGroup`, `EmptyState`, `Icon`

**`components/buttons/`** — `PrimaryButton`, `GhostButton`, `TextAction`

**`components/forms/`** (the `form.tsx` seam) — `FormSection`,
`GroupedSurface`, `FormTextField`, `InlineNumberFieldRow`, `DisclosureRow`,
`AddRow`, `EditableValueRow`, `StepperField`, `Segmented`, `SearchField`

**`components/navigation/`** — `NavBar`, `TabBar`, `ActiveSessionBar`

**`components/feedback/`** — `Toast`, `ConfirmDialog`, `OfflineBanner`,
`RestTimerBar`

**`components/data/`** — `SwipeableRow`, `InsetList`, `InsetRow`,
`ProgressRing`, `DateStepper`, `NutritionCalendar`, `TrendChart`,
`BucketChart`

**`components/media/`** — `MediaThumb`, `HeroCard`

**`components/sheets/`** — `Sheet`

Each directory has one `@dsCard` showcase HTML; each component has a `.d.ts`
props contract and a `.prompt.md` with a usage example.

#### Intentional additions

The inventory above mirrors `apps/mobile/src/ui/*` and `src/theme/tokens.ts`
one-for-one, with three additions that exist only because HTML is not React
Native:

- **`Icon`** — the app passes SF Symbol names straight to native components, so
  it has no Icon component. This wrapper maps those names to Lucide glyphs for
  mocks.
- **`NavBar` / `TabBar`** — in the app these are `Stack`/`NativeTabs` chrome
  owned by the OS and never drawn in React Native. They exist here so a mock can
  show a realistic iOS screen; **do not port them back into the app**.
- **`InsetList` / `InsetRow`** — the app hand-builds grouped lists per screen
  (`train.tsx`, `profile.tsx`, `exercises-list.tsx` each have their own row
  styles). Naming the pattern is the fix for the "rows all differ slightly"
  drift; port it into `src/ui/` when you touch those screens.
- **`ProgressRing`** — Home draws its week ring inline today.
- **`SearchField`** — `exercises-list.tsx` and the food browser each style
  their own `TextInput`; this names the search bar once.
- **`MediaThumb` / `HeroCard`** — new: the app has no photography yet.

`FormScreen` from the app's seam is intentionally *not* a component here: its
whole job is keyboard avoidance and safe-area footers, which do not exist on the
web. Use a column with a 640px max width and a footer instead.

## Working rules for designers and agents

1. **Native chrome first.** On iOS, navigation, menus, pickers, sheets and
   toolbars are the system's — headers and tab bars are configured, not drawn.
   Content below them is calm, opaque and grouped.
2. **One primary action per screen**, as a lime capsule, in a safe-area footer
   or at the end of the content column.
3. **Every destructive action confirms**, and every action reachable by swipe or
   long press is also reachable visibly.
4. **44pt minimum**, as a minimum and not a fixed size.
5. **Answer the screen contract** from `apps/mobile/DESIGN_SYSTEM.md` before
   drawing: the user's immediate job, the single primary action, what precedes
   and follows, the native pattern being followed, and the populated / empty /
   loading / error / long-text / keyboard states.
6. **Cards are objects, not containers for fields.** Repeated objects are
   compact summary rows that open focused editing.
7. **Never put `var(--accent)` on text.** Accented ink is `--accent-ink`;
   `--accent` is a fill. Check every screen in both themes before calling it
   done — the device acceptance list in `docs/ios-native-verification.md` now
   has a light-mode pass too.
8. **Never box a field inside a group.** See "Fields are rows, not boxes".
9. **Reach for the grouped list first.** If a screen feels like a web page, it
   is almost always because a collection was drawn as cards, the rows are taller
   than 48pt, or a separator is full-bleed at 1px instead of inset at 0.5.
