# Baseline UI Hygiene (Step 16) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "UI hygiene" step (step 16, baseline v6) to the appelent feature catalog and apply it to workouts: toast notifications, promise-based confirm dialogs, skeleton/empty-state primitives, route error fallback, button pending states — all on Base UI with zero new dependencies.

**Architecture:** Two repos. `workouts` (this worktree) gets the mechanisms first, proven by tests — then the catalog (`appelent-packages`) captures them as baseline step 16 so the code that lands in the catalog is already verified. A prerequisite task lands the catalog's pending v5 branch on main first so step numbering is stable.

**Tech Stack:** `@base-ui/react` 1.6.0 (`Toast`, `AlertDialog` — verified exports), Tailwind v4 with the app's CSS custom properties, TanStack Router `defaultErrorComponent`, Vitest + Testing Library (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-07-16-baseline-ui-hygiene-design.md`

---

## Repo locations & ground rules

- **workouts** = this worktree (`D:\Dev\workouts\.claude\worktrees\cli-workflow-syntax-7b11fb`), branch `claude/appelent-plugin-hygiene-256bb8`. All `src/` paths below are relative to it.
- **catalog** = `D:\Dev\appelent-packages` (in Git Bash: `/d/Dev/appelent-packages`). Its main checkout is on `main`, clean. Catalog work happens there directly.
- Catalog validation gate: `pnpm validate:catalog` and `pnpm lint` (Biome, LF, tab indent) — run from the catalog root before every catalog commit. There is **no CI** on the catalog repo; local validation is the only gate.
- Catalog version-bump rule: any change under `skills/` relative to `origin/main` requires bumping `version` in **both** `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` (they must stay identical in name/version/description/repository). `validate:catalog` enforces this.
- Workouts gates: `pnpm check`, `pnpm typecheck`, `pnpm test` (matches CI).
- Never renumber existing baseline steps — step 16 is **appended** after step 15.

## File structure

**workouts (create):**
- `src/components/ui/toast.tsx` — `ToastHost` wrapper (Base UI Toast provider + viewport + list) + `useToast()` hook
- `src/components/ui/toast.test.tsx`
- `src/components/ui/confirm-dialog.tsx` — `ConfirmDialogProvider` + `useConfirm()` (promise-based, Base UI AlertDialog)
- `src/components/ui/confirm-dialog.test.tsx`
- `src/components/ui/skeleton.tsx` — `Skeleton` primitive
- `src/components/ui/empty-state.tsx` — `EmptyState` component
- `src/components/ui/empty-state.test.tsx`
- `src/components/RouteErrorFallback.tsx` — shared route error component with retry
- `src/components/ui/button.test.tsx` — loading-prop tests

**workouts (modify):**
- `src/components/ui/button.tsx` — add `loading` prop
- `src/router.tsx` — `defaultErrorComponent`
- `src/routes/__root.tsx` — mount `ToastHost` + `ConfirmDialogProvider`
- `src/components/session/SessionSummary.tsx:71-75` — retrofit confirm + error toast
- `src/routes/log/$sessionId.tsx:114-121` — retrofit confirm + error toasts
- `src/components/hosted/HostedWorkoutDashboard.tsx:52-73,150` — retrofit confirm, `runAction` → toast
- `CLAUDE.md`, `AGENTS.md` — managed block refresh + Key Conventions line
- `appelent.json` — baseline `{ "version": 6, "steps": [6, 14, 15, 16] }`

**catalog (modify):**
- `skills/baseline/SKILL.md` — append step 16 after step 15; extend `## Managed block`
- `skills/baseline/FEATURE.md` — version 6, changelog, What/Architecture refresh
- `tests/catalog.test.mjs` — pinned version regex `5` → `6` + step-16 assertions
- `.claude-plugin/plugin.json` + `.codex-plugin/plugin.json` — two version bumps (Task 1: 0.1.7, Task 8: 0.1.8)

---

### Task 1: Catalog — land the pending v5 branch on main

The branch `claude/new-packages-a911bd` holds baseline v5 (step 14 mobile viewport, step 15 PWA, `.worktreeinclude`, `skills/CLAUDE.md` authoring conventions). Apps already record v5; catalog main is behind. Merge is verified conflict-free (`git merge-tree` reported 0 conflicts). The branch predates the plugin version-bump rule, so the merge needs a bump commit to pass validation.

**Files:**
- Modify (catalog): `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`

- [ ] **Step 1: Update local main and merge**

```bash
cd /d/Dev/appelent-packages
git checkout main
git pull origin main          # fast-forwards 2f626b5 -> de0d260
git merge --no-ff claude/new-packages-a911bd -m "Merge baseline v5 (mobile viewport + PWA steps, .worktreeinclude, skills authoring conventions)"
```

Expected: clean merge, no conflict markers. If conflicts appear (main moved since this plan was written), resolve favoring the branch for `skills/baseline/*` content and main for everything else, and re-verify with step 2.

- [ ] **Step 2: Run validation — expect the version-bump failure**

```bash
cd /d/Dev/appelent-packages && pnpm validate:catalog
```

Expected: FAIL with a message that `skills/` changed relative to `origin/main` but the plugin manifest version was not bumped. (If it passes instead, the branch already bumped the version — skip step 3.)

- [ ] **Step 3: Bump plugin version to 0.1.7 in both manifests**

In `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, change `"version": "0.1.6"` → `"version": "0.1.7"`. The two files must keep identical `name`/`version`/`description`/`repository` values.

- [ ] **Step 4: Validate and lint**

```bash
cd /d/Dev/appelent-packages && pnpm validate:catalog && pnpm lint
```

Expected: validate passes (node --test reports all tests pass — the merged `tests/catalog.test.mjs` pins `/^version: 5$/m`, matching the merged FEATURE.md), lint clean.

- [ ] **Step 5: Commit the bump and push**

```bash
cd /d/Dev/appelent-packages
git add .claude-plugin/plugin.json .codex-plugin/plugin.json
git commit -m "chore(plugin): bump to 0.1.7 for baseline v5 merge"
git push origin main
```

Expected: push succeeds. If push is rejected (remote moved), `git pull --rebase origin main`, re-run step 4, push again.

---

### Task 2: workouts — Toast mechanism (`ToastHost` + `useToast`)

**Files:**
- Create: `src/components/ui/toast.tsx`
- Test: `src/components/ui/toast.test.tsx`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/toast.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastHost, useToast } from "./toast";

function Harness() {
	const toast = useToast();
	return (
		<div>
			<button type="button" onClick={() => toast.error("Save failed", "Please try again.")}>
				fire error
			</button>
			<button type="button" onClick={() => toast.success("Workout saved")}>
				fire success
			</button>
		</div>
	);
}

describe("ToastHost / useToast", () => {
	it("shows an error toast with title and description", async () => {
		render(
			<ToastHost>
				<Harness />
			</ToastHost>,
		);
		fireEvent.click(screen.getByText("fire error"));
		expect(await screen.findByText("Save failed")).toBeTruthy();
		expect(screen.getByText("Please try again.")).toBeTruthy();
	});

	it("shows a success toast with title only", async () => {
		render(
			<ToastHost>
				<Harness />
			</ToastHost>,
		);
		fireEvent.click(screen.getByText("fire success"));
		expect(await screen.findByText("Workout saved")).toBeTruthy();
	});

	it("renders a dismiss control with an accessible name", async () => {
		render(
			<ToastHost>
				<Harness />
			</ToastHost>,
		);
		fireEvent.click(screen.getByText("fire error"));
		await screen.findByText("Save failed");
		expect(screen.getByLabelText("Dismiss notification")).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/ui/toast.test.tsx`
Expected: FAIL — `Cannot find module './toast'` (or equivalent resolution error).

- [ ] **Step 3: Implement `src/components/ui/toast.tsx`**

```tsx
import { Toast } from "@base-ui/react/toast";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "#/lib/utils";

type ToastType = "success" | "error" | "info";

const TOAST_ICONS = {
	success: CheckCircle2,
	error: AlertCircle,
	info: Info,
} satisfies Record<ToastType, typeof Info>;

/**
 * App-wide notification hook. Mutation errors must always surface through
 * `error()`; use `success()` sparingly — only when the result isn't already
 * visible on screen.
 */
export function useToast() {
	const manager = Toast.useToastManager();
	return {
		success: (title: string, description?: string) =>
			manager.add({ title, description, type: "success" }),
		error: (title: string, description?: string) =>
			manager.add({
				title,
				description,
				type: "error",
				priority: "high",
				timeout: 8000,
			}),
		info: (title: string, description?: string) =>
			manager.add({ title, description, type: "info" }),
	};
}

function ToastList() {
	const { toasts } = Toast.useToastManager();
	return toasts.map((toast) => {
		const type = (toast.type ?? "info") as ToastType;
		const Icon = TOAST_ICONS[type];
		return (
			<Toast.Root
				key={toast.id}
				toast={toast}
				className={cn(
					"pointer-events-auto flex items-start gap-3 rounded-xl border bg-[var(--surface)] p-4 shadow-xl",
					type === "error" && "border-[var(--danger)]/40",
					type === "success" && "border-[var(--success)]/40",
					type === "info" && "border-[var(--border)]",
				)}
			>
				<Icon
					size={16}
					aria-hidden="true"
					className={cn(
						"mt-0.5 shrink-0",
						type === "error" && "text-[var(--danger)]",
						type === "success" && "text-[var(--success)]",
						type === "info" && "text-[var(--text-muted)]",
					)}
				/>
				<div className="min-w-0 flex-1">
					<Toast.Title className="text-sm font-semibold text-white" />
					<Toast.Description className="mt-0.5 text-sm text-[var(--text-muted)]" />
				</div>
				<Toast.Close
					className="shrink-0 rounded p-1 text-[var(--text-muted)] transition-colors hover:text-white"
					aria-label="Dismiss notification"
				>
					<X size={14} />
				</Toast.Close>
			</Toast.Root>
		);
	});
}

/**
 * Mounts the Base UI toast provider and viewport. Wrap the app once (in
 * `__root.tsx`); `useToast()` works anywhere below it.
 */
export function ToastHost({ children }: { children: React.ReactNode }) {
	return (
		<Toast.Provider>
			{children}
			<Toast.Portal>
				{/* bottom-20 clears the mobile bottom tab bar; sm:bottom-6 on desktop */}
				<Toast.Viewport className="fixed right-4 bottom-20 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:bottom-6">
					<ToastList />
				</Toast.Viewport>
			</Toast.Portal>
		</Toast.Provider>
	);
}
```

Notes for the implementer:
- `Toast.Title`/`Toast.Description` with no children render `toast.title`/`toast.description` automatically — that's Base UI behavior, don't pass children.
- `Toast.Root` requires the `toast` object prop.
- If jsdom errors about missing browser APIs, add the same `ResizeObserver`/`scrollIntoView` polyfill `beforeAll` block used in `src/components/ui/Select.test.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/ui/toast.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount `ToastHost` in the root route**

In `src/routes/__root.tsx`, add the import and wrap the app content (inside `AuthConfigProvider`, around `AppContent`):

```tsx
import { ToastHost } from "#/components/ui/toast";
```

Change `RootLayout`'s return from:

```tsx
		<AppClerkProvider>
			<AppConvexProvider>
				<AuthConfigProvider config={AUTH_CONFIG}>
					<AppContent />
					{import.meta.env.DEV && <TanStackRouterDevtools />}
				</AuthConfigProvider>
			</AppConvexProvider>
		</AppClerkProvider>
```

to:

```tsx
		<AppClerkProvider>
			<AppConvexProvider>
				<AuthConfigProvider config={AUTH_CONFIG}>
					<ToastHost>
						<AppContent />
					</ToastHost>
					{import.meta.env.DEV && <TanStackRouterDevtools />}
				</AuthConfigProvider>
			</AppConvexProvider>
		</AppClerkProvider>
```

- [ ] **Step 6: Gates and commit**

```bash
pnpm check && pnpm typecheck && pnpm exec vitest run src/components/ui/toast.test.tsx
git add src/components/ui/toast.tsx src/components/ui/toast.test.tsx src/routes/__root.tsx
git commit -m "feat(ui): add toast notification mechanism on Base UI Toast"
```

Expected: all three commands clean, commit created.

---

### Task 3: workouts — `ConfirmDialogProvider` + `useConfirm()`

**Files:**
- Create: `src/components/ui/confirm-dialog.tsx`
- Test: `src/components/ui/confirm-dialog.test.tsx`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/confirm-dialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialogProvider, useConfirm } from "./confirm-dialog";

// Base UI dialogs rely on browser APIs jsdom doesn't implement (same
// polyfills as Select.test.tsx).
beforeAll(() => {
	if (!("ResizeObserver" in globalThis)) {
		globalThis.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
	}
	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}
});

function Harness({ onResult }: { onResult: (value: boolean) => void }) {
	const confirm = useConfirm();
	return (
		<button
			type="button"
			onClick={async () => {
				onResult(
					await confirm({
						title: "Delete this workout?",
						description: "This cannot be undone.",
						confirmLabel: "Delete workout",
						destructive: true,
					}),
				);
			}}
		>
			trigger
		</button>
	);
}

function setup() {
	const onResult = vi.fn();
	render(
		<ConfirmDialogProvider>
			<Harness onResult={onResult} />
		</ConfirmDialogProvider>,
	);
	fireEvent.click(screen.getByText("trigger"));
	return onResult;
}

describe("useConfirm", () => {
	it("opens a dialog with title, description, and verb-specific labels", () => {
		setup();
		expect(screen.getByText("Delete this workout?")).toBeTruthy();
		expect(screen.getByText("This cannot be undone.")).toBeTruthy();
		expect(screen.getByText("Delete workout")).toBeTruthy();
		expect(screen.getByText("Cancel")).toBeTruthy();
	});

	it("resolves true on confirm", async () => {
		const onResult = setup();
		fireEvent.click(screen.getByText("Delete workout"));
		await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
	});

	it("resolves false on cancel", async () => {
		const onResult = setup();
		fireEvent.click(screen.getByText("Cancel"));
		await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
	});

	it("resolves false on Escape", async () => {
		const onResult = setup();
		fireEvent.keyDown(document.activeElement ?? document.body, {
			key: "Escape",
		});
		await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
	});

	it("throws when used outside the provider", () => {
		function Bare() {
			useConfirm();
			return null;
		}
		expect(() => render(<Bare />)).toThrow(/ConfirmDialogProvider/);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/ui/confirm-dialog.test.tsx`
Expected: FAIL — cannot resolve `./confirm-dialog`.

- [ ] **Step 3: Implement `src/components/ui/confirm-dialog.tsx`**

```tsx
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "#/components/ui/button";

export interface ConfirmOptions {
	title: string;
	description?: string;
	/** Verb-specific, e.g. "Delete workout" — never "OK" or "Yes". */
	confirmLabel: string;
	cancelLabel?: string;
	destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based confirmation for destructive actions. Drop-in shaped like
 * `window.confirm`:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, confirmLabel: "Delete workout", destructive: true }))) return;
 */
export function useConfirm(): ConfirmFn {
	const confirm = useContext(ConfirmContext);
	if (!confirm) {
		throw new Error("useConfirm must be used within <ConfirmDialogProvider>");
	}
	return confirm;
}

export function ConfirmDialogProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [options, setOptions] = useState<ConfirmOptions | null>(null);
	const resolveRef = useRef<((value: boolean) => void) | null>(null);

	const confirm = useCallback<ConfirmFn>((opts) => {
		return new Promise<boolean>((resolve) => {
			// A second confirm while one is open settles the first as cancelled.
			resolveRef.current?.(false);
			resolveRef.current = resolve;
			setOptions(opts);
		});
	}, []);

	function settle(value: boolean) {
		resolveRef.current?.(value);
		resolveRef.current = null;
		setOptions(null);
	}

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<AlertDialog.Root
				open={options !== null}
				onOpenChange={(open) => {
					if (!open) settle(false);
				}}
			>
				<AlertDialog.Portal>
					<AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
					<AlertDialog.Popup className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
						<div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
							<AlertDialog.Title className="text-sm font-semibold text-white">
								{options?.title}
							</AlertDialog.Title>
							{options?.description && (
								<AlertDialog.Description className="mt-2 text-sm text-[var(--text-muted)]">
									{options.description}
								</AlertDialog.Description>
							)}
							<div className="mt-5 flex justify-end gap-2">
								<Button variant="outline" onClick={() => settle(false)}>
									{options?.cancelLabel ?? "Cancel"}
								</Button>
								<Button
									variant={options?.destructive ? "destructive" : "default"}
									onClick={() => settle(true)}
								>
									{options?.confirmLabel}
								</Button>
							</div>
						</div>
					</AlertDialog.Popup>
				</AlertDialog.Portal>
			</AlertDialog.Root>
		</ConfirmContext.Provider>
	);
}
```

Notes for the implementer:
- Structure (Backdrop + Popup-as-overlay + inner card) mirrors the app's proven `AddExerciseModal.tsx` Dialog usage.
- Base UI AlertDialog intentionally does **not** close on outside-press (alert semantics); Escape does close it, which flows through `onOpenChange(false)` → `settle(false)`. If the Escape test fails because this Base UI version keeps the dialog open on Escape, keep the test but drive it through the Cancel path and note the deviation in the commit message — do not delete the assertion silently.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/ui/confirm-dialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Mount the provider in the root route**

In `src/routes/__root.tsx`:

```tsx
import { ConfirmDialogProvider } from "#/components/ui/confirm-dialog";
```

Wrap inside `ToastHost` (from Task 2):

```tsx
					<ToastHost>
						<ConfirmDialogProvider>
							<AppContent />
						</ConfirmDialogProvider>
					</ToastHost>
```

- [ ] **Step 6: Gates and commit**

```bash
pnpm check && pnpm typecheck && pnpm exec vitest run src/components/ui/confirm-dialog.test.tsx
git add src/components/ui/confirm-dialog.tsx src/components/ui/confirm-dialog.test.tsx src/routes/__root.tsx
git commit -m "feat(ui): add promise-based useConfirm dialog on Base UI AlertDialog"
```

---

### Task 4: workouts — `Skeleton` + `EmptyState`

**Files:**
- Create: `src/components/ui/skeleton.tsx`, `src/components/ui/empty-state.tsx`
- Test: `src/components/ui/empty-state.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/empty-state.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Dumbbell } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
	it("renders title, description, and action", () => {
		render(
			<EmptyState
				icon={Dumbbell}
				title="No workouts yet"
				description="Start your first session to see it here."
				action={<button type="button">Start workout</button>}
			/>,
		);
		expect(screen.getByText("No workouts yet")).toBeTruthy();
		expect(
			screen.getByText("Start your first session to see it here."),
		).toBeTruthy();
		expect(screen.getByText("Start workout")).toBeTruthy();
	});

	it("renders with title only", () => {
		render(<EmptyState title="Nothing here" />);
		expect(screen.getByText("Nothing here")).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/ui/empty-state.test.tsx`
Expected: FAIL — cannot resolve `./empty-state`.

- [ ] **Step 3: Implement both components**

`src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "#/lib/utils";

/**
 * Loading placeholder block. Compose per-view skeletons that match the final
 * layout (same heights/widths as the loaded content) so nothing shifts when
 * data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn("animate-pulse rounded-md bg-white/10", className)}
		/>
	);
}
```

`src/components/ui/empty-state.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "#/lib/utils";

interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}

/**
 * Designed empty state for list/dashboard views — an icon, an explanation,
 * and (usually) a call to action. Never leave a data view as an unexplained
 * blank region.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center",
				className,
			)}
		>
			{Icon && (
				<Icon size={24} aria-hidden="true" className="text-[var(--text-muted)]" />
			)}
			<p className="text-sm font-semibold text-white">{title}</p>
			{description && (
				<p className="max-w-sm text-sm text-[var(--text-muted)]">
					{description}
				</p>
			)}
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/ui/empty-state.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Gates and commit**

```bash
pnpm check && pnpm typecheck && pnpm exec vitest run src/components/ui/empty-state.test.tsx
git add src/components/ui/skeleton.tsx src/components/ui/empty-state.tsx src/components/ui/empty-state.test.tsx
git commit -m "feat(ui): add Skeleton and EmptyState primitives"
```

---

### Task 5: workouts — `Button` loading prop

**Files:**
- Modify: `src/components/ui/button.tsx:43-56`
- Test: `src/components/ui/button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button loading", () => {
	it("disables the button and shows a spinner while loading", () => {
		render(<Button loading>Save</Button>);
		const button = screen.getByRole("button") as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.querySelector(".animate-spin")).toBeTruthy();
	});

	it("stays enabled without loading", () => {
		render(<Button>Save</Button>);
		const button = screen.getByRole("button") as HTMLButtonElement;
		expect(button.disabled).toBe(false);
		expect(button.querySelector(".animate-spin")).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/ui/button.test.tsx`
Expected: FAIL — first test's `disabled` assertion fails (the `loading` prop doesn't exist yet; TypeScript may also error, which counts as the failing state).

- [ ] **Step 3: Implement the prop**

In `src/components/ui/button.tsx`, add the import:

```tsx
import { Loader2 } from "lucide-react";
```

Replace the `Button` function (currently lines 43-56) with:

```tsx
function Button({
	className,
	variant = "default",
	size = "default",
	loading = false,
	disabled,
	children,
	...props
}: ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants> & { loading?: boolean }) {
	return (
		<ButtonPrimitive
			data-slot="button"
			disabled={disabled || loading}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		>
			{loading && <Loader2 aria-hidden="true" className="animate-spin" />}
			{children}
		</ButtonPrimitive>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/ui/button.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Gates and commit**

```bash
pnpm check && pnpm typecheck && pnpm test
git add src/components/ui/button.tsx src/components/ui/button.test.tsx
git commit -m "feat(ui): add loading prop to Button (pending-action state)"
```

Note: `pnpm test` (full suite) here, since Button is used across the app — confirm nothing regressed.

---

### Task 6: workouts — route error fallback

**Files:**
- Create: `src/components/RouteErrorFallback.tsx`
- Modify: `src/router.tsx:4-13`

No unit test: the component needs a live router context (`useRouter`), and its behavior is covered by typecheck plus the live verify in Task 10.

- [ ] **Step 1: Implement `src/components/RouteErrorFallback.tsx`**

```tsx
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";

/**
 * Default route-level error boundary: explains the failure and offers a
 * retry instead of a white screen. `reset` clears the boundary;
 * `router.invalidate()` re-runs loaders so the retry actually refetches.
 */
export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	return (
		<div className="mx-auto max-w-md p-6">
			<EmptyState
				icon={AlertTriangle}
				title="Something went wrong"
				description={
					error instanceof Error && error.message
						? error.message
						: "An unexpected error occurred."
				}
				action={
					<Button
						variant="outline"
						onClick={() => {
							reset();
							void router.invalidate();
						}}
					>
						Try again
					</Button>
				}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Wire it as the router default**

In `src/router.tsx`, add the import and option:

```tsx
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { RouteErrorFallback } from "#/components/RouteErrorFallback";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: RouteErrorFallback,
	});

	return router;
}
```

(Keep the existing `declare module` block below unchanged.)

- [ ] **Step 3: Gates and commit**

```bash
pnpm check && pnpm typecheck && pnpm test
git add src/components/RouteErrorFallback.tsx src/router.tsx
git commit -m "feat(ui): add default route error fallback with retry"
```

---

### Task 7: workouts — bounded retrofit (3 confirm sites + error toasts)

**Files:**
- Modify: `src/components/session/SessionSummary.tsx` (handler at lines 71-75; hooks near line 31)
- Modify: `src/routes/log/$sessionId.tsx` (handlers at lines 114-121)
- Modify: `src/components/hosted/HostedWorkoutDashboard.tsx` (lines 29, 52-73, 150)

- [ ] **Step 1: Retrofit `SessionSummary.tsx`**

Add imports:

```tsx
import { useConfirm } from "#/components/ui/confirm-dialog";
import { useToast } from "#/components/ui/toast";
import { getConvexErrorMessage } from "#/lib/convexError";
```

Inside the `SessionSummary` component, alongside the existing hooks (`const navigate = useNavigate();` block), add:

```tsx
	const confirm = useConfirm();
	const toast = useToast();
```

Replace `handleDelete` (lines 71-75):

```tsx
	async function handleDelete() {
		const ok = await confirm({
			title: "Delete this workout?",
			description: "This cannot be undone.",
			confirmLabel: "Delete workout",
			destructive: true,
		});
		if (!ok) return;
		try {
			await removeSession({ id: session._id });
		} catch (err) {
			toast.error(
				"Couldn't delete workout",
				getConvexErrorMessage(err, "Please try again."),
			);
			return;
		}
		void navigate({ to: "/log" });
	}
```

- [ ] **Step 2: Retrofit `src/routes/log/$sessionId.tsx`**

Add the same three imports as step 1. Inside the route component, alongside its existing hooks, add:

```tsx
	const confirm = useConfirm();
	const toast = useToast();
```

Replace `handleFinish` and `handleCancel` (lines 114-121):

```tsx
	async function handleFinish() {
		try {
			await finishSession({ id: sessionId as Id<"workoutSessions"> });
		} catch (err) {
			toast.error(
				"Couldn't finish workout",
				getConvexErrorMessage(err, "Please try again."),
			);
		}
	}

	async function handleCancel() {
		const ok = await confirm({
			title: "Cancel this workout?",
			description: "All logged sets will be kept.",
			confirmLabel: "Cancel workout",
			cancelLabel: "Keep going",
			destructive: true,
		});
		if (!ok) return;
		try {
			await cancelSession({ id: sessionId as Id<"workoutSessions"> });
		} catch (err) {
			toast.error(
				"Couldn't cancel workout",
				getConvexErrorMessage(err, "Please try again."),
			);
		}
	}
```

- [ ] **Step 3: Retrofit `HostedWorkoutDashboard.tsx`**

Add imports:

```tsx
import { useConfirm } from "#/components/ui/confirm-dialog";
import { useToast } from "#/components/ui/toast";
```

(`getConvexErrorMessage` is already imported in this file.)

Changes inside the component:

1. Add hooks next to `const navigate = useNavigate();`:

```tsx
	const confirm = useConfirm();
	const toast = useToast();
```

2. Delete the error state (line 29): remove `const [error, setError] = useState<string | null>(null);` and drop `useState` from the React import if now unused.

3. Replace `runAction` (lines 52-59) — errors now surface as toasts instead of inline text:

```tsx
	async function runAction(action: () => Promise<unknown>) {
		try {
			await action();
		} catch (err) {
			toast.error(
				"Action failed",
				getConvexErrorMessage(err, "Something went wrong."),
			);
		}
	}
```

4. Replace `handleDelete` (lines 61-73):

```tsx
	async function handleDelete() {
		const ok = await confirm({
			title: "Delete this hosted workout?",
			description: "Its scores and participants will be removed.",
			confirmLabel: "Delete hosted workout",
			destructive: true,
		});
		if (!ok) return;
		void runAction(async () => {
			await removeHostedWorkout({ id });
			await navigate({ to: "/hosted-workouts" });
		});
	}
```

5. Remove the inline error render (line 150): delete the line `{error && <p className="mt-3 text-sm text-red-400">{error}</p>}`.

- [ ] **Step 4: Confirm no native confirm remains**

Run: `grep -rn "window\.confirm\|!confirm(" src --include="*.tsx"`
Expected: no matches — all three former call sites (`SessionSummary`, `$sessionId`, `HostedWorkoutDashboard`) now go through the `useConfirm()` hook's `await confirm({...})` shape instead.

- [ ] **Step 5: Gates and commit**

```bash
pnpm check && pnpm typecheck && pnpm test
git add src/components/session/SessionSummary.tsx 'src/routes/log/$sessionId.tsx' src/components/hosted/HostedWorkoutDashboard.tsx
git commit -m "refactor: replace window.confirm with useConfirm and surface mutation errors as toasts"
```

---

### Task 8: Catalog — write step 16, bump baseline to v6

**Files:**
- Modify (catalog): `skills/baseline/SKILL.md` — append after step 15 (ends ~line 970, before `## Persistence`), extend `## Managed block`
- Modify (catalog): `skills/baseline/FEATURE.md` — frontmatter + What + Architecture + Changelog
- Modify (catalog): `tests/catalog.test.mjs` — version pin + content assertions
- Modify (catalog): `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` — 0.1.7 → 0.1.8

- [ ] **Step 1: Append step 16 to `skills/baseline/SKILL.md`**

Insert the following between the end of step 15 and `## Persistence`. The component code is the implementation proven in workouts (Tasks 2-6) — if the workouts code diverged during implementation (e.g. the Escape-key note in Task 3), capture what actually shipped, not what this plan predicted:

````markdown
### 16. UI hygiene (loading, confirm, notifications, empty/error states)

Every baseline app ships the same small set of UI-hygiene mechanisms and
follows the same conventions (stamped into the managed block, see the
"Managed block" section). Everything builds on `@base-ui/react` (already in
the stack — it exports `./toast` and `./alert-dialog`) + Tailwind: **zero
new dependencies**. Reference implementation: workouts
(`src/components/ui/toast.tsx`, `confirm-dialog.tsx`, `skeleton.tsx`,
`empty-state.tsx`, `RouteErrorFallback.tsx`). Merge, don't clobber — if the
app already has a toast/confirm/skeleton mechanism, align it with the
contracts below rather than adding a duplicate.

- **Detect existing state first.** Search for `window.confirm`/`confirm(`
  call sites, any existing toast/notification library (`react-toastify`,
  `sonner`, `notistack`), and skeleton/empty-state components before
  scaffolding. An existing third-party toast lib is a flag-and-discuss,
  not a silent replacement.

- **Notifications (`src/components/ui/toast.tsx`).** Base UI `Toast`
  provider + viewport mounted once in the root layout, plus a `useToast()`
  hook exposing `success`/`error`/`info` helpers. Contract:

  ```ts
  useToast(): {
  	success: (title: string, description?: string) => string;
  	error: (title: string, description?: string) => string;   // priority "high", longer timeout
  	info: (title: string, description?: string) => string;
  }
  ```

  Style with the app's own design tokens. `Toast.Title`/`Toast.Description`
  with no children auto-render the toast's `title`/`description`. Position
  the viewport clear of the app's mobile nav (workouts uses `bottom-20
  sm:bottom-6` to clear its bottom tab bar).

- **Destructive-action confirm (`src/components/ui/confirm-dialog.tsx`).**
  Base UI `AlertDialog` wrapped in a provider + promise-based `useConfirm()`
  so call sites read like `window.confirm`:

  ```ts
  const confirm = useConfirm();
  const ok = await confirm({
  	title: "Delete this workout?",
  	description: "This cannot be undone.",
  	confirmLabel: "Delete workout", // verb-specific — never "OK"/"Yes"
  	cancelLabel: "Cancel",          // optional, defaults to "Cancel"
  	destructive: true,              // red styling on the confirm button
  }); // Promise<boolean> — false on cancel, Escape, or dismiss
  ```

  Implementation shape: context provider holding `ConfirmOptions | null`
  state + a resolve ref; `onOpenChange(false)` settles `false`; a second
  `confirm()` while one is open settles the first as `false`. AlertDialog
  (not Dialog) is deliberate: no close-on-outside-press, focus trap and
  Escape handling for free.

- **Skeleton (`src/components/ui/skeleton.tsx`).** A tiny `animate-pulse`
  primitive (`<Skeleton className="h-4 w-32" />`, `aria-hidden`). Per-view
  skeletons are composed from it and must match the final layout so nothing
  shifts when data arrives. Convention, not enforcement: new async views
  render a skeleton, never a blank page or spinner-only screen.

- **Empty state (`src/components/ui/empty-state.tsx`).** `EmptyState` with
  `icon?` (Lucide), `title`, `description?`, `action?` (CTA node). Every
  list/dashboard view renders one when it has no data.

- **Route error fallback.** A shared error component (icon + message +
  "Try again" button calling the boundary's `reset()` and
  `router.invalidate()`), wired as the router's `defaultErrorComponent`.
  Route errors render this, never a white screen.

- **Pending actions.** The app's `Button` gets a `loading?: boolean` prop
  (disabled + spinner while a mutation is in flight, preventing
  double-submit). Forms keep the user's input on failure.

- **Page titles & a11y.** Per-route document titles via the route `head`
  option; `aria-label` on icon-only buttons; dialogs/popovers via Base UI
  primitives only.

- **Bounded retrofit when applying this step to an existing app** (the rest
  lands opportunistically under the stamped conventions):
  1. Replace every `window.confirm`/bare `confirm()` call site with
     `useConfirm()` (verb-specific labels, `destructive: true` where it is).
  2. Sweep the retrofitted handlers' mutation calls so failures surface via
     `toast.error(...)` — including converting inline error-text state to
     toasts where that leaves the UI more consistent.
  3. Mount `ToastHost` + `ConfirmDialogProvider` once in the root layout.

- **Tests.** Unit-test the mechanisms with the app's test setup (Vitest +
  Testing Library in this stack): `useConfirm` resolves true/false on
  confirm/cancel/Escape and throws outside its provider; toasts render
  title + description with an accessible dismiss control; `Button loading`
  disables the button. Base UI needs the jsdom
  `ResizeObserver`/`scrollIntoView` polyfills (copy the pattern from the
  app's existing Base UI tests).
````

- [ ] **Step 2: Extend the `## Managed block` template in the same file**

Inside the managed block template (between the `appelent-managed` markers, after the "Before adding functionality…" paragraph and before `<!-- appelent-managed:end -->`), add:

```markdown
### UI hygiene

- Async views render a skeleton (`ui/skeleton.tsx`) matching the final
  layout — never a blank page or a spinner-only screen.
- Destructive actions go through `useConfirm()` (`ui/confirm-dialog.tsx`) —
  never `window.confirm`. Confirm buttons use verb-specific labels
  ("Delete workout", not "OK").
- Mutations: the trigger button shows a pending state (`Button loading`);
  errors always surface an error toast (`useToast().error`); success toasts
  only when the result isn't already visible on screen. Forms keep the
  user's input on failure.
- List/dashboard views define an `EmptyState` (`ui/empty-state.tsx`) —
  never an unexplained blank region.
- Every route defines a document title (route `head`); route errors render
  the shared error fallback with retry, not a white screen.
- Icon-only buttons get an `aria-label`. Dialogs/popovers use Base UI
  primitives only.
```

- [ ] **Step 3: Bump `skills/baseline/FEATURE.md` to version 6**

- Frontmatter: `version: 5` → `version: 6`.
- `## What`: extend the summary sentence to include UI hygiene, e.g. append "…, and shared UI-hygiene mechanisms (toasts, confirm dialogs, skeletons, empty/error states)" to the existing feature list.
- `## Architecture`: no structural change needed (SKILL.md remains the executable form) — leave as is unless the merged v5 text says otherwise.
- `## Changelog`: add at the top:

```markdown
- 6 — UI hygiene step (16): Base UI toast notifications, promise-based
  `useConfirm()` destructive-action dialog, skeleton + empty-state
  primitives, default route error fallback, Button pending state, and
  title/a11y conventions; the managed block gains a UI-hygiene checklist
```

- [ ] **Step 4: Update the pinned test in `tests/catalog.test.mjs`**

Find the baseline assertion block (search for `version: 5`). Change:

```js
	assert.match(feature, /^version: 5$/m);
```

to:

```js
	assert.match(feature, /^version: 6$/m);
```

and add step-16 content assertions alongside the existing baseline ones (e.g. after the `assert.match(skill, ...)` lines in that block):

```js
	assert.match(skill, /### 16\. UI hygiene/);
	assert.match(skill, /useConfirm/);
	assert.match(skill, /never `window\.confirm`/);
```

- [ ] **Step 5: Bump plugin manifests to 0.1.8**

In `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`: `"version": "0.1.7"` → `"version": "0.1.8"`.

- [ ] **Step 6: Validate, lint, commit, push**

```bash
cd /d/Dev/appelent-packages && pnpm validate:catalog && pnpm lint
git add skills/baseline/SKILL.md skills/baseline/FEATURE.md tests/catalog.test.mjs .claude-plugin/plugin.json .codex-plugin/plugin.json
git commit -m "feat(baseline): add UI hygiene step 16 (v6) — toasts, useConfirm, skeletons, empty/error states"
git push origin main
```

Expected: validate + lint clean (all `node --test` tests pass), push succeeds.

---

### Task 9: workouts — record the applied feature

**Files:**
- Modify: `appelent.json`
- Modify: `CLAUDE.md` (managed block + Key Conventions)
- Modify: `AGENTS.md` (managed block)

- [ ] **Step 1: Update `appelent.json`**

Change the baseline entry:

```json
{
  "features": {
    "baseline": { "version": 6, "steps": [6, 14, 15, 16] },
    "auth": { "version": 1 },
    "cli": { "version": 1 },
    "mcp": { "version": 1 }
  }
}
```

- [ ] **Step 2: Stamp the updated managed block**

In both `CLAUDE.md` and `AGENTS.md`, replace everything between
`<!-- appelent-managed:start -->` and `<!-- appelent-managed:end -->` with the
updated template from Task 8 Step 2 (the existing "Appelent Managed Project"
text plus the new `### UI hygiene` checklist). The block content must be
identical in both files and identical to the catalog template.

- [ ] **Step 3: Add a Key Conventions pointer in `CLAUDE.md`**

In the `## Key Conventions` bullet list, add:

```markdown
- **UI hygiene**: Shared mechanisms live in `src/components/ui/` — `useToast()` (toast.tsx), `useConfirm()` (confirm-dialog.tsx), `Skeleton`, `EmptyState` — plus `RouteErrorFallback` as the router's `defaultErrorComponent` and `Button`'s `loading` prop. The rules for when to use them are in the managed block's "UI hygiene" checklist at the end of this file (baseline step 16).
```

- [ ] **Step 4: Gates and commit**

```bash
pnpm check && pnpm typecheck
git add appelent.json CLAUDE.md AGENTS.md
git commit -m "chore: record baseline step 16 (UI hygiene) and stamp updated managed block"
```

---

### Task 10: Full verification (static + live)

- [ ] **Step 1: Full static gates on workouts**

```bash
pnpm check && pnpm typecheck && pnpm test
```

Expected: all clean. `pnpm test` includes the four new test files (toast, confirm-dialog, empty-state, button) plus the pre-existing suite.

- [ ] **Step 2: Live verify via the `verify` skill**

Invoke the project's `verify` skill (dev server + Convex, test-user login). Exercise:

1. Open a completed workout's summary (`/log/<sessionId>` for a finished session) → click the delete control → the styled confirm dialog appears (title "Delete this workout?", red "Delete workout" button) → **Cancel** first (nothing deleted), then re-open and **confirm** → session deletes, navigates to `/log`.
2. In an active session, "Cancel workout" shows the confirm with "Keep going" / "Cancel workout".
3. Force a mutation failure (e.g. temporarily stop `convex dev`, or delete the same session from a second tab first, then retry the action) → the error toast appears bottom-right with a dismiss button.
4. Screenshot the confirm dialog and an error toast as proof.

- [ ] **Step 3: Report**

Summarize: catalog commits pushed (v5 merge + step 16/v6), workouts commits on `claude/appelent-plugin-hygiene-256bb8`, test counts, and the live-verify evidence. Remind the user of the two manual follow-ups:
- Update the locally installed `appelent` plugin (cache is at 0.1.5; catalog now 0.1.8) so future sessions read the new baseline.
- Other registered apps (`projects.json` in the catalog) can catch up via `/appelent:feature apply baseline --step 16` per app.

---

## Self-review notes (already applied)

- Spec coverage: skeletons (Task 4 + step-16 conventions), confirm (Tasks 3, 7), notifications (Tasks 2, 7), empty states (Task 4), error handling (Tasks 6, 7), pending actions (Task 5), titles/a11y (conventions in Task 8 — deliberately no mass retrofit, per the approved "mechanisms + small retrofit" scope), catalog step + managed block (Task 8), appelent.json + CLAUDE.md (Task 9), prerequisite merge (Task 1), tests (Tasks 2-5), live verify (Task 10).
- The `steps: [6, 14, 15, 16]` record keeps the existing partial-apply semantics (this app never ran a full bootstrap pass under the current record shape).
- Type consistency: `useToast()` returns `success/error/info`; `useConfirm()` takes `ConfirmOptions` and returns `Promise<boolean>` — identical names in Tasks 2/3 (workouts) and Task 8 (catalog step text).
