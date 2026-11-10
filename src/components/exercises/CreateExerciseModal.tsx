import { Modal, ModalHeader } from "#/components/ui/Modal";
import { AddExerciseForm } from "./AddExerciseForm";

export function CreateExerciseModal({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Modal open={open} onOpenChange={onOpenChange} className="sm:max-w-lg">
			<ModalHeader title="Add Exercise" />
			<div className="p-5">
				<AddExerciseForm onSuccess={() => onOpenChange(false)} />
			</div>
		</Modal>
	);
}
