import * as Dialog from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { AddExerciseForm } from "./AddExerciseForm";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AddExerciseModal({ open, onOpenChange }: Props) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog.Portal>
				<Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
				<Dialog.Popup className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
					<div className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden shadow-xl">
						<div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
							<Dialog.Title className="text-sm font-semibold text-white">
								Add Exercise
							</Dialog.Title>
							<Dialog.Close
								className="p-1 text-[var(--text-muted)] hover:text-white transition-colors rounded"
								aria-label="Close"
							>
								<X size={18} />
							</Dialog.Close>
						</div>
						<div className="p-5">
							<AddExerciseForm onSuccess={() => onOpenChange(false)} />
						</div>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
