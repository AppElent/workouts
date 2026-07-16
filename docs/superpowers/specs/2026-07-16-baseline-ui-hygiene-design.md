# Baseline UI Hygiene (step 16) — Design

**Date:** 2026-07-16
**Status:** Approved (brainstorming session)
**Repos touched:** `appelent-packages` (catalog — primary), `workouts` (first consumer)

## Problem

Appelent apps have no shared conventions or mechanisms for everyday UI
hygiene. Concretely, in workouts today: destructive actions use native
`window.confirm()` (3 call sites), there is no notification/toast mechanism,
and no skeleton loading states. Each session that touches UI reinvents these
ad hoc, per app, inconsistently.

## Goal

Add a **UI hygiene** step to the baseline feature so every Appelent app gets:

1. **Skeleton loading states** — async views render a skeleton matching the
   final layout, never a blank page.
2. **Destructive-action confirmation** — a styled, accessible confirm dialog
   replaces `window.confirm`.
3. **Notifications** — a repeatable toast mechanism for mutation errors and
   (sparingly) successes.
4. **Empty states** — list/dashboard views get a designed empty state with CTA.
5. **Error handling** — route-level error boundaries with retry; mutation
   failures always surface a toast, never silently swallowed.
6. **Pending-action hygiene** — mutation trigger buttons disable and show a
   spinner while in flight (prevents double-submit); forms keep input on
   failure.
7. **Page titles & a11y basics** — per-route document titles, `aria-label` on
   icon-only buttons, dialogs with focus trap + Escape (free via Base UI).

## Non-goals

- No shared `@appelent/ui` package in v1. UI components are theme-specific
  per app; extraction to a package is a future step once 2–3 apps converge on
  identical code (same path the i18n feature took).
- No full retrofit of existing screens. Applying the step installs the
  mechanisms and does a **bounded** retrofit only (see "Applying to an app").
  Screens gain skeletons/empty states opportunistically as they are touched.
- No new dependencies. Everything builds on `@base-ui/react` (verified:
  v1.6.0 exports `./toast` and `./alert-dialog`) + Tailwind. react-toastify
  and similar were considered and rejected — they drag in a parallel styling
  system the stack doesn't need.

## Decisions made during brainstorming

| Decision | Choice |
| --- | --- |
| Scope | All 7 items above (user confirmed all four proposed extras) |
| Retrofit depth | Mechanisms + small retrofit (confirm call sites, mutation error wiring); not conventions-only, not full audit |
| Delivery | Approach A: baseline step with per-app scaffold, following step 9's (issue reporter) recipe pattern |
| Toast library | Base UI Toast (zero new deps) over react-toastify/sonner |

## Design

### 1. Catalog changes (`appelent-packages`)

**Prerequisite:** merge the pending branch `claude/new-packages-a911bd`
(baseline v5: step 14 mobile viewport, step 15 PWA, `.worktreeinclude`
hygiene, CLAUDE.md conventions) into catalog `main` first. Apps already
record baseline v5 in `appelent.json`, but catalog main is still at v3 —
main must catch up before new steps get numbered, or v6 would ship with
phantom steps 14/15 behind it.

Then:

- Add **step 16 "UI hygiene"** to `skills/baseline/SKILL.md`, written in the
  step-9 recipe shape: contract first, reference implementation second,
  "adapt to the app's conventions — merge, don't clobber" throughout.
- Bump `skills/baseline/FEATURE.md` to **version 6** with a changelog entry.
- Extend the **managed block template** (SKILL.md "Managed block" section)
  with the conventions checklist (section 3 below) so it stamps into every
  app's `CLAUDE.md` and `AGENTS.md` — visible to Codex, which cannot read
  skills.
- Bump the plugin version per the catalog's version-bump rule.

### 2. Scaffolded mechanisms (reference implementations in step 16)

All stamped into the consuming app under its existing conventions
(`src/components/ui/` in workouts), styled with the app's own Tailwind theme:

| File | Contract |
| --- | --- |
| `ui/toast.tsx` | Base UI `Toast` provider mounted once in the app shell/root; `useToast()` hook exposing `success`/`error`/`info` helpers. |
| `ui/confirm-dialog.tsx` | Base UI `AlertDialog` wrapped in a provider + promise-based `useConfirm()` hook: `const ok = await confirm({ title, description, confirmLabel, destructive })` → `Promise<boolean>` (false on cancel/Escape/backdrop). Verb-specific confirm labels ("Delete workout", never "OK"); destructive styling when `destructive: true`. |
| `ui/skeleton.tsx` | Tiny `animate-pulse` primitive; per-view skeletons are composed from it and must match the final layout (no layout shift when data arrives). |
| `ui/empty-state.tsx` | `EmptyState` with icon, title, description, optional CTA. |
| Router config | `defaultErrorComponent` (TanStack Router) rendering an error panel with a retry button; per-route `errorComponent` where a route needs something specific. |
| App `Button` | Add a `loading` prop: disabled + spinner while a mutation is in flight. |
| Route `head` | Per-route document titles via TanStack Router's `head` option. |

The promise-based `useConfirm()` shape is deliberate: call sites read almost
identically to `window.confirm`, so retrofits are one-line swaps.

### 3. Conventions checklist (managed block addition)

Stamped between the `appelent-managed` markers in `CLAUDE.md`/`AGENTS.md`
(final wording may be tightened during implementation, content fixed):

```md
### UI hygiene

- Async views render a skeleton matching the final layout — never a blank
  page or spinner-only screen.
- Destructive actions go through the app's `useConfirm()` dialog — never
  `window.confirm`. Confirm buttons use verb-specific labels.
- Mutations: the trigger button shows a pending state (disabled + spinner);
  errors always surface an error toast; success toasts only when the result
  isn't already visible on screen. Forms keep the user's input on failure —
  never reset fields because a request failed.
- List/dashboard views define an `EmptyState` (icon, title, CTA) — never an
  unexplained blank region.
- Every route defines a document title; route errors render the error
  component with retry, not a white screen.
- Icon-only buttons get an `aria-label`. Dialogs/popovers use Base UI
  primitives only (focus trap + Escape handling come free).
```

### 4. Applying to an app (what "apply step 16" does)

1. Scaffold the mechanisms from section 2 that the app is missing; mount the
   toast + confirm providers once in the app shell/root.
2. **Bounded retrofit:** replace every `window.confirm`/`confirm()` call site
   with `useConfirm()`; sweep mutation error paths so failures reach the
   error toast.
3. Stamp the updated managed block; record the feature in `appelent.json`.
4. Anything beyond that (adding skeletons/empty states/titles to existing
   screens) is **not** part of applying the step — it happens opportunistically
   under the stamped conventions.

### 5. First consumer: workouts

- Scaffold all mechanisms; providers mounted in the app shell
  (`AppShell.tsx` / `__root.tsx` — exact mount point decided in the plan).
- Replace the 3 confirm call sites: `SessionSummary.tsx:72`,
  `HostedWorkoutDashboard.tsx:63`, `routes/log/$sessionId.tsx:119`.
- Wire mutation `onError`/catch paths to the error toast.
- Update `appelent.json`: `"baseline": { "version": 6, "steps": [6, 14, 15, 16] }`.
- Refresh the managed block in `CLAUDE.md`/`AGENTS.md`.

## Error handling (of the mechanisms themselves)

- `useConfirm()` resolves `false` on cancel, Escape, and backdrop dismiss —
  a destructive action can never proceed by accident.
- Toast provider is mounted at the root; calling `useToast()` outside the
  provider throws in dev (fail loud, not silent).
- The error boundary's retry re-renders the route; if data is the failure
  source, Convex's reactive queries refetch on their own.

## Testing

- **Catalog:** none executable — SKILL.md/FEATURE.md are docs. Review pass
  only.
- **Workouts (Vitest + Testing Library):**
  - `useConfirm()` resolves `true` on confirm, `false` on cancel and Escape.
  - Toast helpers render a toast with the right role/status (a11y:
    `role="status"` / `role="alert"` for errors).
  - `EmptyState` renders icon/title/CTA.
  - `Button loading` disables the button and prevents a second click.
- **Static gates:** `pnpm check`, `pnpm typecheck`, `pnpm test` green.
- **Live verify (verify skill):** trigger delete-workout → styled confirm
  dialog appears, cancel aborts, confirm deletes; force a mutation failure →
  error toast appears.

## Open items

- Merge of `claude/new-packages-a911bd` into catalog main is a prerequisite
  and touches work from other sessions — do it as its own reviewed step, not
  silently inside this feature's commits.
- Exact toast API surface (e.g. `toast.promise()` sugar) and the confirm
  provider's stacking behavior (multiple confirms) are implementation-plan
  details, constrained by the contracts above.
