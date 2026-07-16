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
		const type: ToastType =
			toast.type && toast.type in TOAST_ICONS
				? (toast.type as ToastType)
				: "info";
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
