import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "#/lib/utils";

/**
 * A bottom sheet on phones and a centered panel from `sm` up. Base UI owns
 * focus, Escape, outside presses and scroll locking; `onOpenChange(false)` is
 * a close request the owner may refuse (e.g. to confirm discarding a draft).
 */
export function Modal({
	open,
	onOpenChange,
	children,
	className,
	panelRef,
	panelStyle,
	backdropStyle,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
	className?: string;
	panelRef?: Ref<HTMLDivElement>;
	panelStyle?: CSSProperties;
	backdropStyle?: CSSProperties;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className="fixed inset-0 z-40 bg-black/70"
					style={backdropStyle}
				/>
				{/* The popup spans the screen to position the panel; clicks on its
				    empty area fall through to the backdrop and close the modal. */}
				<Dialog.Popup className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
					<div
						ref={panelRef}
						style={panelStyle}
						className={cn(
							"pointer-events-auto max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_-20px_50px_rgba(0,0,0,0.6)] sm:max-w-md sm:rounded-2xl",
							className,
						)}
					>
						{children}
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

export const ModalTitle = Dialog.Title;

export function ModalCloseButton({ className }: { className?: string }) {
	return (
		<Dialog.Close
			aria-label="Close"
			className={cn(
				"rounded p-1 text-[var(--text-muted)] transition-colors hover:text-white",
				className,
			)}
		>
			<X size={18} />
		</Dialog.Close>
	);
}

/** Title row with a close button, for modals without a custom header. */
export function ModalHeader({ title }: { title: ReactNode }) {
	return (
		<div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
			<ModalTitle className="text-sm font-semibold text-white">
				{title}
			</ModalTitle>
			<ModalCloseButton />
		</div>
	);
}
