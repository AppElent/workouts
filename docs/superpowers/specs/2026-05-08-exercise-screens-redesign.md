# Exercise Screens Redesign

## Context

The exercise module has two screens. The library page (`/exercises`) uses a data table that is unusable on mobile and looks dated. The detail page (`/exercises/$id`) is functional but visually plain and lacks a muscle diagram — a key reference feature for a fitness app. The redesign makes the library mobile-first with a card grid, and gives the detail page a centered hero with front/back anatomical muscle diagrams and tabbed content.

---

## Design Decisions

### Exercise Library (`/exercises`)

| Element | Decision |
|---|---|
| Search | Full-width input row (top) |
| Muscle filter | Horizontally scrollable chips: All, Chest, Back, Legs, Shoulders, Arms, Core |
| Category + Equipment | Compact dropdowns in a second filter row below chips |
| Layout | `grid-cols-2 md:grid-cols-3 xl:grid-cols-4` |
| Card contents | Name (bold), equipment · category (muted), muscle group chips (accent green) |
| Add Exercise | FAB (floating action button, bottom-right, `#1DB954`, 52px circle) opens `AddExerciseModal` |
| Sort | Alphabetical by name (default, no sort UI needed in card view) |

Chip categories map to muscleGroups strings: Chest → `["chest"]`, Back → `["back","lats","traps"]`, Legs → `["quads","hamstrings","glutes","calves"]`, Shoulders → `["shoulders","front delts","side delts","rear delts","traps"]`, Arms → `["biceps","triceps","forearms"]`, Core → `["core"]`. "All" clears the filter.

Active filter chips show accent background + ✕ dismiss. Clicking a card navigates to `/exercises/$id`.

### Exercise Detail (`/exercises/$id`)

| Element | Decision |
|---|---|
| Hero card | Centered: name, category+equipment badges, front+back MuscleMap SVG, muscle chip row |
| Tabs | **Overview** · **Progress** · **History** |
| Overview | 1RM card (value + source badge) + Notes card (if exercise has notes) |
| Progress | 1RM trend line chart + Strength Curve chart (existing Recharts, just relocated) |
| History | Set history table, newest first (existing, just relocated) |
| Muscle diagram | `MuscleMap` component: inline SVG, front+back side-by-side, matched groups filled `var(--accent)` |

### MuscleMap SVG Component

New component `src/components/exercises/MuscleMap.tsx`.

- Props: `muscleGroups: string[]`, `size?: 'sm' | 'md'`
- Renders two inline SVGs (front view + back view) side by side, each ~72×140px at `sm`, ~100×195px at `md`
- Each SVG has named `<path>`/`<rect>`/`<ellipse>` elements per muscle region
- A map object links muscle group strings → SVG element IDs for front/back
- Matched muscles get `fill={accent}` with 0.85 opacity; unmatched get `fill="#2a2a2a"` with `stroke="#444"`

**Muscle group → view mapping:**

| Muscle string | Front | Back |
|---|---|---|
| chest | ✓ | |
| shoulders | ✓ | ✓ |
| front delts | ✓ | |
| side delts | ✓ | |
| rear delts | | ✓ |
| biceps | ✓ | |
| triceps | | ✓ |
| forearms | ✓ | ✓ |
| core | ✓ | |
| quads | ✓ | |
| calves | ✓ | ✓ |
| back | | ✓ |
| lats | | ✓ |
| traps | | ✓ |
| hamstrings | | ✓ |
| glutes | | ✓ |
| full body | ✓ | ✓ (all regions highlighted) |

---

## Files to Create / Modify

### New files
- `src/components/exercises/MuscleMap.tsx` — anatomical SVG component
- `src/components/exercises/AddExerciseModal.tsx` — wraps `AddExerciseForm` in a Base UI `Dialog`

### Modified files
- `src/routes/exercises/index.tsx` — full rewrite: card grid, chips, FAB
- `src/routes/exercises/$id.tsx` — full rewrite: hero card + tabs

### Unchanged
- `src/components/exercises/AddExerciseForm.tsx` — reused inside `AddExerciseModal`
- All Convex backend files — no data model changes needed
- `src/styles.css` — use existing CSS custom properties throughout

---

## Implementation Sequence

1. **`MuscleMap.tsx`** — build and test standalone with multiple exercise examples
2. **`AddExerciseModal.tsx`** — wrap existing `AddExerciseForm` in a Base UI `Dialog`; test open/close and form submit
3. **`exercises/index.tsx`** — rewrite: search row → chip row → dropdown row → card grid → FAB
4. **`exercises/$id.tsx`** — rewrite: hero card (uses `MuscleMap`) → tabs → tab panels

---

## Key Conventions to Follow

- `cn()` from `src/lib/utils.ts` for class merging
- Lucide React for any icons (search icon: `Search` from lucide-react)
- Base UI `Dialog` for the Add Exercise modal (`@base-ui-components/react/dialog`)
- Tailwind CSS v4 + CSS custom properties (`var(--accent)`, `var(--surface)`, etc.)
- Tab state: `useState` for active tab (no URL change needed)
- `pb-16 sm:pb-0` on page root for mobile bottom nav clearance; FAB positioned above bottom nav (`bottom-20 sm:bottom-6`)

---

## Verification

1. `npm run dev:all` — run both Convex and Vite
2. Navigate to `/exercises` on mobile viewport (375px) — verify card grid, search, chips, FAB
3. Click FAB — verify modal opens, form submits, modal closes on success
4. Click an exercise card — verify navigation to detail page
5. On detail page — verify muscle diagram highlights correct groups for that exercise
6. Verify tabs switch between Overview / Progress / History without page reload
7. On desktop (≥768px) — verify grid expands to 3 columns, at ≥1280px to 4 columns
8. `npm run lint` — no Biome errors
