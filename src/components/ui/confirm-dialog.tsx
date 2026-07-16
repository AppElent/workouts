import { AlertDialog } from "@base-ui/react/alert-dialog";
import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
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
