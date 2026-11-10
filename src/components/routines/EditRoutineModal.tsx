import { Modal, ModalHeader } from "#/components/ui/Modal";
import {
	RoutineEditor,
	type RoutinePayload,
	type RoutineWithNames,
} from "./RoutineEditor";

export function EditRoutineModal({
	routine,
	open,
	onClose,
	onSave,
}: {
	routine: RoutineWithNames;
	open: boolean;
	onClose: () => void;
	onSave: (payload: RoutinePayload) => Promise<unknown>;
}) {
	return (
		<Modal
			open={open}
			onOpenChange={(next) => !next && onClose()}
			className="sm:max-w-lg"
		>
			<ModalHeader title="Edit Routine" />
			<div className="p-5">
				<RoutineEditor
					initial={routine}
					submitLabel="Save"
					onSubmit={onSave}
					onCancel={onClose}
				/>
			</div>
		</Modal>
	);
}
