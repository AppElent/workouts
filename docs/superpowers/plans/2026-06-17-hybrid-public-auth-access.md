# Hybrid Public/Authenticated Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the exercise library publicly browsable while keeping logging, tracking, and all personal data behind sign-in.

**Architecture:** Frontend-only change. The Convex backend already returns default exercises to anonymous callers and returns `null`/skips for personal data, so no backend edits. The existing `AppShell` stays the chrome for all non-landing routes; navigation items for gated routes render in a locked state when signed out, and the exercise list/detail pages drop their redirect guards and gate only the personal pieces (write actions, personal charts/history).

**Tech Stack:** React 19, TanStack Router, Clerk (`@clerk/clerk-react`), Convex (`convex/react`), Tailwind v4, Vitest + Testing Library, Biome.

**Branch:** `feat/hybrid-public-auth` (already created; the design spec is committed there).

---

## File Structure

- **Create** `src/components/navItems.ts` — single source of truth for the nav config shared by `Sidebar` and `BottomTabBar`, plus the pure `isNavItemLocked` rule. Removes the current duplication between the two nav components.
- **Create** `src/components/navItems.test.ts` — unit tests for the config + lock rule.
- **Modify** `src/components/Sidebar.tsx` — consume shared config, render locked state for gated items when signed out, swap `UserButton` for a Sign In button.
- **Modify** `src/components/BottomTabBar.tsx` — consume shared config, dim + redirect gated tabs to `/login` when signed out.
- **Modify** `src/routes/exercises/index.tsx` — remove redirect guard; gate the add-exercise FAB and per-card delete buttons behind `<SignedIn>`.
- **Modify** `src/routes/exercises/$id.tsx` — remove redirect guard; skip personal queries when signed out; show a sign-in nudge on the Progress/History tabs (and the Overview empty state).
- **Modify** `src/routes/index.tsx` — add a "Browse exercises" secondary CTA on the landing hero.

---

## Task 1: Shared nav config + lock rule (TDD)

**Files:**
- Create: `src/components/navItems.ts`
- Test: `src/components/navItems.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/navItems.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isNavItemLocked } from "./navItems";

describe("NAV_ITEMS", () => {
	it("marks only /exercises as public (non-gated)", () => {
		const publicRoutes = NAV_ITEMS.filter((i) => !i.gated).map((i) => i.to);
		expect(publicRoutes).toEqual(["/exercises"]);
	});

	it("has a label and shortLabel for every item", () => {
		for (const item of NAV_ITEMS) {
			expect(item.label.length).toBeGreaterThan(0);
			expect(item.shortLabel.length).toBeGreaterThan(0);
		}
	});
});

describe("isNavItemLocked", () => {
	it("locks a gated item when signed out", () => {
		expect(isNavItemLocked({ gated: true }, false)).toBe(true);
	});

	it("unlocks a gated item when signed in", () => {
		expect(isNavItemLocked({ gated: true }, true)).toBe(false);
	});

	it("never locks a non-gated item", () => {
		expect(isNavItemLocked({ gated: false }, false)).toBe(false);
		expect(isNavItemLocked({ gated: false }, true)).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/navItems.test.ts`
Expected: FAIL — cannot resolve module `./navItems`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/navItems.ts`:

```ts
import {
	BookOpen,
	ClipboardList,
	Dumbbell,
	LayoutDashboard,
	type LucideIcon,
	TrendingUp,
	User,
} from "lucide-react";

export type NavItem = {
	to: string;
	label: string;
	shortLabel: string;
	Icon: LucideIcon;
	gated: boolean;
};

export const NAV_ITEMS = [
	{ to: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", Icon: LayoutDashboard, gated: true },
	{ to: "/log", label: "Log Workout", shortLabel: "Log", Icon: Dumbbell, gated: true },
	{ to: "/exercises", label: "Exercises", shortLabel: "Exercises", Icon: BookOpen, gated: false },
	{ to: "/routines", label: "Routines", shortLabel: "Routines", Icon: ClipboardList, gated: true },
	{ to: "/progress", label: "Progress", shortLabel: "Progress", Icon: TrendingUp, gated: true },
	{ to: "/profile", label: "Profile", shortLabel: "Profile", Icon: User, gated: true },
] as const satisfies readonly NavItem[];

export function isNavItemLocked(
	item: { gated: boolean },
	isSignedIn: boolean,
): boolean {
	return item.gated && !isSignedIn;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/navItems.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/navItems.ts src/components/navItems.test.ts
git commit -m "feat: shared nav config with gated-item lock rule"
```

---

## Task 2: Sidebar — locked items + Sign In button

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Replace the imports block (top of file)**

Replace lines 1–13 (the `UserButton`, router, lucide, and `useState` imports) with:

```tsx
import { SignedIn, SignedOut, UserButton, useAuth } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";
import { NAV_ITEMS, isNavItemLocked } from "./navItems";
```

Then delete the local `navItems` array (the `const navItems = [...] as const;` block) — it now lives in `navItems.ts`.

- [ ] **Step 2: Read auth state inside the component**

Immediately after `const { location } = useRouterState();`, add:

```tsx
	const { isSignedIn } = useAuth();
```

- [ ] **Step 3: Replace the nav `.map` with locked-aware rendering**

Replace the `<nav>` block body (the `{navItems.map(...)}`) with:

```tsx
				{NAV_ITEMS.map(({ to, label, Icon, gated }) => {
					const locked = isNavItemLocked({ gated }, Boolean(isSignedIn));
					const active = !locked && location.pathname.startsWith(to);
					return (
						<Link
							key={to}
							to={locked ? "/login" : to}
							title={collapsed ? label : undefined}
							className={[
								"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
								active
									? "bg-[var(--accent-dim)] text-[var(--accent)]"
									: locked
										? "text-[var(--text-muted)]/60 hover:text-white hover:bg-white/5"
										: "text-[var(--text-muted)] hover:text-white hover:bg-white/5",
							].join(" ")}
							aria-current={active ? "page" : undefined}
						>
							<Icon
								size={18}
								strokeWidth={active ? 2.5 : 1.75}
								className="shrink-0"
							/>
							{!collapsed && <span className="flex-1">{label}</span>}
							{!collapsed && locked && (
								<Lock size={13} className="shrink-0 opacity-70" />
							)}
						</Link>
					);
				})}
```

- [ ] **Step 4: Swap the footer UserButton for an auth-aware footer**

Replace the user-button block:

```tsx
			{/* User button */}
			<div className="flex items-center justify-center p-3 border-t border-[var(--border)]">
				<UserButton />
			</div>
```

with:

```tsx
			{/* User / Sign in */}
			<div className="flex items-center justify-center p-3 border-t border-[var(--border)]">
				<SignedIn>
					<UserButton />
				</SignedIn>
				<SignedOut>
					<Link
						to="/login"
						className="w-full text-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-bold text-black hover:bg-[var(--accent-hover)] transition-colors"
					>
						{collapsed ? "→" : "Sign In"}
					</Link>
				</SignedOut>
			</div>
```

- [ ] **Step 5: Verify the suite still passes and lint is clean**

Run: `npm run check`
Expected: no errors. (Type-checks the new `to={locked ? "/login" : to}` union and imports.)

Run: `npx vitest run`
Expected: PASS (existing tests + Task 1 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: sidebar locks gated items and shows Sign In when signed out"
```

---

## Task 3: BottomTabBar — locked tabs

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: Replace imports + delete the local tabs array**

Replace lines 1–18 (the router import, the lucide icon imports, and the `const tabs = [...] as const;` block) with:

```tsx
import { useAuth } from "@clerk/clerk-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { NAV_ITEMS, isNavItemLocked } from "./navItems";
```

- [ ] **Step 2: Read auth state and render locked-aware tabs**

Replace the component body (`export function BottomTabBar() { ... }`) with:

```tsx
export function BottomTabBar() {
	const { location } = useRouterState();
	const { isSignedIn } = useAuth();

	return (
		<nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] sm:hidden">
			<div className="flex items-stretch">
				{NAV_ITEMS.map(({ to, shortLabel, Icon, gated }) => {
					const locked = isNavItemLocked({ gated }, Boolean(isSignedIn));
					const active = !locked && location.pathname.startsWith(to);
					return (
						<Link
							key={to}
							to={locked ? "/login" : to}
							className={[
								"flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
								active
									? "text-[var(--accent)]"
									: locked
										? "text-[var(--text-muted)]/60"
										: "text-[var(--text-muted)]",
							].join(" ")}
							aria-current={active ? "page" : undefined}
						>
							<Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
							{shortLabel}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
```

- [ ] **Step 3: Verify lint + tests**

Run: `npm run check`
Expected: no errors.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: bottom tab bar locks gated tabs when signed out"
```

---

## Task 4: Exercises list — public list, gated write actions

**Files:**
- Modify: `src/routes/exercises/index.tsx`

- [ ] **Step 1: Remove the redirect guard**

Replace the import line:

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
```

with:

```tsx
import { SignedIn } from "@clerk/clerk-react";
```

Then replace the route definition + guard wrapper:

```tsx
export const Route = createFileRoute("/exercises/")({
	component: ExercisesPageGuarded,
});

function ExercisesPageGuarded() {
	return (
		<>
			<SignedIn>
				<ExercisesPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}
```

with:

```tsx
export const Route = createFileRoute("/exercises/")({
	component: ExercisesPage,
});
```

- [ ] **Step 2: Gate the per-card delete button**

Wrap the delete `<button>` inside the card map in `<SignedIn>`. Replace:

```tsx
								{!ex.isDefault && (
									<button
										type="button"
										onClick={(e) => {
											e.preventDefault();
											void removeExercise({ id: ex._id });
										}}
										className="p-0.5 text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
										aria-label={`Delete ${ex.name}`}
									>
										<Trash2 size={12} />
									</button>
								)}
```

with:

```tsx
								{!ex.isDefault && (
									<SignedIn>
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												void removeExercise({ id: ex._id });
											}}
											className="p-0.5 text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
											aria-label={`Delete ${ex.name}`}
										>
											<Trash2 size={12} />
										</button>
									</SignedIn>
								)}
```

- [ ] **Step 3: Gate the add-exercise FAB + modal**

Wrap the FAB button and the `AddExerciseModal` in `<SignedIn>`. Replace:

```tsx
			{/* FAB */}
			<button
				type="button"
				onClick={() => setModalOpen(true)}
				className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-[52px] h-[52px] rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:bg-[var(--accent-hover)] transition-colors"
				aria-label="Add exercise"
			>
				<Plus size={24} strokeWidth={2.5} />
			</button>

			<AddExerciseModal open={modalOpen} onOpenChange={setModalOpen} />
```

with:

```tsx
			{/* FAB (auth only) */}
			<SignedIn>
				<button
					type="button"
					onClick={() => setModalOpen(true)}
					className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-[52px] h-[52px] rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:bg-[var(--accent-hover)] transition-colors"
					aria-label="Add exercise"
				>
					<Plus size={24} strokeWidth={2.5} />
				</button>

				<AddExerciseModal open={modalOpen} onOpenChange={setModalOpen} />
			</SignedIn>
```

- [ ] **Step 4: Verify lint + tests**

Run: `npm run check`
Expected: no errors. (`removeExercise`, `modalOpen`, `setModalOpen`, `Plus`, `Trash2` all remain used.)

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/exercises/index.tsx
git commit -m "feat: make exercise list public, gate add/delete behind auth"
```

---

## Task 5: Exercise detail — public overview, gated personal data

**Files:**
- Modify: `src/routes/exercises/$id.tsx`

- [ ] **Step 1: Swap imports — drop guard, add auth hook**

Replace:

```tsx
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
```

with:

```tsx
import { useAuth } from "@clerk/clerk-react";
```

- [ ] **Step 2: Remove the guard wrapper, point the route at the page**

Replace:

```tsx
export const Route = createFileRoute("/exercises/$id")({
	component: ExerciseDetailPageGuarded,
});

function ExerciseDetailPageGuarded() {
	return (
		<>
			<SignedIn>
				<ExerciseDetailPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}
```

with:

```tsx
export const Route = createFileRoute("/exercises/$id")({
	component: ExerciseDetailPage,
});
```

- [ ] **Step 3: Read auth state and skip personal queries when signed out**

Inside `ExerciseDetailPage`, replace the query block:

```tsx
	const exercise = useQuery(api.exercises.getById, {
		id: id as Id<"exercises">,
	});
	const history =
		useQuery(api.exercises.getHistory, {
			exerciseId: id as Id<"exercises">,
		}) ?? [];
	const currentOrm = useQuery(api.oneRepMaxes.getCurrentForExercise, {
		exerciseId: id as Id<"exercises">,
	});
	const ormHistory =
		useQuery(api.oneRepMaxes.listForExercise, {
			exerciseId: id as Id<"exercises">,
		}) ?? [];
```

with:

```tsx
	const { isSignedIn } = useAuth();
	const signedIn = Boolean(isSignedIn);

	const exercise = useQuery(api.exercises.getById, {
		id: id as Id<"exercises">,
	});
	const history =
		useQuery(
			api.exercises.getHistory,
			signedIn ? { exerciseId: id as Id<"exercises"> } : "skip",
		) ?? [];
	const currentOrm = useQuery(
		api.oneRepMaxes.getCurrentForExercise,
		signedIn ? { exerciseId: id as Id<"exercises"> } : "skip",
	);
	const ormHistory =
		useQuery(
			api.oneRepMaxes.listForExercise,
			signedIn ? { exerciseId: id as Id<"exercises"> } : "skip",
		) ?? [];
```

- [ ] **Step 4: Add a local SignInPrompt helper**

Directly above `function ExerciseDetailPage() {`, add:

```tsx
function SignInPrompt({ message }: { message: string }) {
	return (
		<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-6 flex flex-col items-center gap-3 text-center">
			<p className="text-sm text-[var(--text-muted)]">{message}</p>
			<Link
				to="/login"
				className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-black hover:bg-[var(--accent-hover)] transition-colors"
			>
				Sign In
			</Link>
		</div>
	);
}
```

(`Link` is already imported from `@tanstack/react-router`.)

- [ ] **Step 5: Gate the Overview empty state**

In the Overview tab, replace:

```tsx
					{!currentOrm && !exercise.notes && (
						<p className="text-sm text-[var(--text-muted)] text-center py-8">
							No data yet. Log sets for this exercise to see your 1RM.
						</p>
					)}
```

with:

```tsx
					{!exercise.notes &&
						(signedIn ? (
							!currentOrm && (
								<p className="text-sm text-[var(--text-muted)] text-center py-8">
									No data yet. Log sets for this exercise to see your 1RM.
								</p>
							)
						) : (
							<SignInPrompt message="Sign in to track your 1RM for this exercise." />
						))}
```

- [ ] **Step 6: Make the Progress tab signed-in only**

This and Step 7 avoid editing the existing multi-`</div>` closing tags. Instead, restrict each personal tab to signed-in users with `&& signedIn` and add a separate nudge block.

Replace the Progress tab opening:

```tsx
			{/* Progress tab */}
			{activeTab === "progress" && (
				<div className="flex flex-col gap-4">
```

with:

```tsx
			{/* Progress tab */}
			{activeTab === "progress" && signedIn && (
				<div className="flex flex-col gap-4">
```

- [ ] **Step 7: Add the Progress nudge and make History signed-in only**

Replace the History tab opening (the comment + the `activeTab === "history"` line):

```tsx
			{/* History tab */}
			{activeTab === "history" && (
				<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
```

with:

```tsx
			{activeTab === "progress" && !signedIn && (
				<SignInPrompt message="Sign in to track your 1RM progress and strength curve." />
			)}

			{/* History tab */}
			{activeTab === "history" && signedIn && (
				<div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
```

Then add the History nudge at the very end of the component. Replace the component's closing (the History block's `)}` followed by the page-wrapper close):

```tsx
			)}
		</div>
	);
}
```

with:

```tsx
			)}

			{activeTab === "history" && !signedIn && (
				<SignInPrompt message="Sign in to see your set history for this exercise." />
			)}
		</div>
	);
}
```

- [ ] **Step 8: Verify lint + types + tests**

Run: `npm run check`
Expected: no errors. Pay attention to balanced JSX parens from steps 6–7; if `npm run check` reports a syntax/paren error, re-check those edits before moving on.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/routes/exercises/$id.tsx
git commit -m "feat: public exercise detail with sign-in nudge on personal tabs"
```

---

## Task 6: Landing page — Browse exercises CTA

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Add a secondary CTA next to "Start Logging"**

Replace the single CTA `<Link to="/log" ...>Start Logging →</Link>` (the block ending with `Start Logging →\n\t\t\t\t\t\t</Link>`) by wrapping it and adding a second link. Replace:

```tsx
					<Link
						to="/log"
						className="inline-flex items-center px-8 py-3 font-bold text-black text-sm transition-colors"
						style={{
							background: "#1DB954",
							borderRadius: 9999,
							fontWeight: 700,
						}}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLElement).style.background = "#1ed760";
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLElement).style.background = "#1DB954";
						}}
					>
						Start Logging →
					</Link>
```

with:

```tsx
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Link
							to="/log"
							className="inline-flex items-center px-8 py-3 font-bold text-black text-sm transition-colors"
							style={{
								background: "#1DB954",
								borderRadius: 9999,
								fontWeight: 700,
							}}
							onMouseEnter={(e) => {
								(e.currentTarget as HTMLElement).style.background = "#1ed760";
							}}
							onMouseLeave={(e) => {
								(e.currentTarget as HTMLElement).style.background = "#1DB954";
							}}
						>
							Start Logging →
						</Link>
						<Link
							to="/exercises"
							className="inline-flex items-center px-8 py-3 text-white text-sm border transition-colors"
							style={{
								borderColor: "var(--border)",
								borderRadius: 9999,
								fontWeight: 700,
							}}
						>
							Browse exercises
						</Link>
					</div>
```

- [ ] **Step 2: Verify lint + tests**

Run: `npm run check`
Expected: no errors.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: add Browse exercises CTA to landing hero"
```

---

## Task 7: Full verification (manual, browser preview)

**Files:** none (verification only)

- [ ] **Step 1: Run the full check + test suite**

Run: `npm run check && npx vitest run`
Expected: lint/format clean, all tests PASS.

- [ ] **Step 2: Start the dev servers**

Run: `npm run dev:all`
Expected: Convex dev + Vite on port 3000.

- [ ] **Step 3: Verify the logged-OUT experience**

In the browser preview, while signed out:
- `/exercises` lists default exercises; **no** add FAB; **no** delete buttons; sidebar shows gated items dimmed with a lock icon; the footer shows a green "Sign In" button (no UserButton).
- Clicking a locked sidebar item (e.g. Dashboard) navigates to `/login`.
- `/exercises/<id>` shows the Overview (muscle map, tags); the **Progress** and **History** tabs show the sign-in nudge with a working Sign In button — and the browser console shows **no** Convex "Unauthenticated" errors (queries are skipped).
- `/` landing page shows both "Start Logging →" and "Browse exercises"; the latter opens `/exercises`.
- Directly visiting `/dashboard` (or `/log`, `/routines`, `/progress`, `/profile`) redirects to sign-in.

- [ ] **Step 4: Verify the logged-IN experience**

Sign in, then confirm:
- `/exercises` shows defaults **plus** user exercises; the add FAB and delete buttons are present and work.
- Sidebar shows all items as normal links (no locks); the footer shows the `UserButton`; `BottomTabBar` (narrow viewport via responsive preview) shows all tabs active/normal.
- `/exercises/<id>` Progress and History tabs render the charts/table as before.

- [ ] **Step 5: Final confirmation**

No console errors in either state at both desktop and mobile widths. The feature branch `feat/hybrid-public-auth` contains one commit per task.
```
