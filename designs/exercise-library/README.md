# Exercise library design playground

Open `index.html` directly, or serve this directory with `python3 -m http.server 8765 --directory designs/exercise-library` from the repository root.

Self-contained HTML/CSS/JavaScript; no install, build, external fonts, network calls, or production app changes. All sample exercise additions remain in memory until refresh.

## Directions

- **A — Native library:** inset grouped rows, a dedicated filter screen, grouped creation form. Recommended baseline.
- **B — Muscle atlas:** muscle browsing and sectioned rows, two-step creation.
- **C — Fast finder:** dense alphabetical rows, direct filter pickers, quick creation with optional fields.

The three selectors mix independently (27 combinations). Light and dark appearances, copyable selection summary, and loading, empty, load-error, and save-error simulations are available. Search, AND-composed filters, personal exercises, details, creation, validation, pending state, and retry work locally.

## Screen contract

The immediate job is finding an exercise or creating a personal one. The library's primary action is Add; the form's primary action is Save. Exercise rows open a read-only detail preview. Filters stage changes until Apply; Cancel leaves active filters unchanged. Add cancellation keeps its draft for the next visit; successful save shows the new exercise in Personal. Escape returns to the library and restores focus. Sample muscle groups are simplified to six browse categories, not a proposed replacement for the full domain model.

Large titles, opaque grouped surfaces, hairline separators, system typography, restrained lime, and 44px targets express the iOS direction. The HTML screens use regular document navigation sections, not custom modal widgets. Sticky form actions remain reachable as content scrolls.

## Native handoff

Guidance applied: expo-overview, expo-native-ui, expo-ui, expo-design-system, vercel-react-native-skills, and better accessibility/layout/writing/typography/colors/UI.

This is a browser visualization, not native implementation. In Expo, use the existing design-system form interfaces, actual native stack titles/toolbars, native pickers and form sheets, SF Symbols, semantic colors, and a virtualized catalog list. Retain the existing muscle aliases and multiple muscle groups; the study's simplified single-group picker is not a schema change. Preserve Android parity through existing adapters. Do not reproduce the mock phone chrome in app code.

Verification: DOM interaction checks cover all 27 combinations, search, combined filters, empty recovery, all three add flows, pending state, failure with retained draft, retry, escaped notes, and loading/error views. Browser visual review covered the main library, dark mode, save-error form, and 320px reflow. Physical iPhone, Android, Dutch copy, VoiceOver, and Dynamic Type remain implementation acceptance work.

## Revision: app fidelity and native header

The phone preview uses the exact mobile light/dark values from `apps/mobile/src/theme/tokens.ts` and starts dark. The six muscle illustrations are embedded unmodified from `public/muscle-icons` so the HTML remains portable. Legs maps to quadriceps and Core to abs for the simplified sample catalog.

Scroll inside the library: the large 34px title yields to the centered 17px toolbar title; scrolling to the top restores it. This is a browser approximation for review. Use the native Expo stack large-title behavior in the app, not this JavaScript scroll handler. Reduced motion disables the scale effect.

Details preserve Overview / Progress / History with keyboard arrow navigation. Barbell Bench Press has explicitly labeled example records, a trend, strength estimates, and recent sets; other exercises demonstrate empty progress/history. These are prototype data, not the user's records. Browser verification covered both header positions and the detail tabs.

## Multi-select and header layout menu

Muscle-group and equipment **filters** accept multiple values. Values within each group use OR; the two groups, search, movement type, and Personal scope combine with AND. Empty selection means any. Cancel preserves applied selections; Reset stages a clear until Apply. The muscle browser also toggles multiple groups. Creation fields remain separate from library filters.

The ellipsis button in the library header switches List (A) and Muscle groups (B) without changing search, filters, or the add-form pattern. Its Base UI Menu supplies keyboard navigation, checked radio state, dismissal, and focus handling. `layout-menu.jsx` is the source; its React / React DOM / Base UI bundle is embedded in the HTML so the artifact still opens without installation or network access. No app dependency files changed.

Verified multi-select union/intersection, result counts, deselection, cancellation, reset, multi-select muscle browsing, and header-menu layout switching.

The header menu now follows the supplied iOS Mail visual-picker reference: two side-by-side phone thumbnails, descriptive layout labels, and selected/unselected circles. It retains the app palette and Base UI menu semantics. Left/Right arrows select focus; Enter applies the layout; Escape dismisses. Verified the visual result and keyboard switching in-browser.
