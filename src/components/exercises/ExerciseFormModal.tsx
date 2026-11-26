import type { Exercise } from "@foundry/core/exercises";
import { Modal, ModalHeader } from "#/components/ui/Modal";
import { useMessages } from "#/lib/i18n";
import { ExerciseForm } from "./ExerciseForm";

/** Adds a Personal Exercise, or edits `exercise` when given. */
export function ExerciseFormModal({
	open,
	onOpenChange,
	exercise,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	exercise?: Exercise;
}) {
	const copy = useMessages().exercise.form;
	return (
		<Modal open={open} onOpenChange={onOpenChange} className="sm:max-w-lg">
			<ModalHeader title={exercise ? copy.editTitle : copy.addTitle} />
			<div className="p-5">
				<ExerciseForm
					exercise={exercise}
					onSuccess={() => onOpenChange(false)}
				/>
			</div>
		</Modal>
	);
}
