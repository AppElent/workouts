# Canonical Activity type list lives in packages/core

As Activity gains multiple types (strength, running, cycling, WOD, ...), the list of valid types and their display metadata (label, icon, default unit) needs one canonical source, referenced by Convex's schema validators and by web/mobile UI (pickers, routing, icons). We decided this lives in `packages/core`, not in `convex/schema.ts` with other layers importing Convex-generated types.

This follows the existing precedent set by the 1RM formula (`packages/core`, imported by both `src/` and `convex/` — "a single implementation, not two copies to keep in sync"). Convex-generated types describe database shape; the activity-type catalog is domain/display logic that `src/`, `convex/`, and `apps/mobile` all need independently of the database row shape, so it belongs in the shared, dependency-free package designated for exactly that.
