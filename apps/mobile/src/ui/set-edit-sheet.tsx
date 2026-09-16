import { useMutation } from "convex/react";
import { useState } from "react";
import { api, type Doc } from "../convex/api";
import { convexErrorMessage, useConfirm } from "./confirm-dialog";
import { SetEditSheetPresentation } from "./set-edit-sheet-presentation";
import type { SetType } from "./set-edit-sheet-presentation.types";
import { useToast } from "./toast";

export function SetEditSheet({
	set,
	weightStep,
	exerciseName,
	onClose,
}: {
	set: Doc<"sets">;
	weightStep: number;
	exerciseName: string;
	onClose: () => void;
}) {
	const toast = useToast();
	const confirm = useConfirm();
	const updateSet = useMutation(api.sets.update);
	const duplicateSet = useMutation(api.sets.duplicate);
	const removeSet = useMutation(api.sets.remove);
	const [weight, setWeight] = useState(set.weight);
	const [reps, setReps] = useState(set.reps);
	const [setType, setSetType] = useState<SetType>(set.setType);
	const [busy, setBusy] = useState(false);
	const dirty =
		weight !== set.weight || reps !== set.reps || setType !== set.setType;

	const requestClose = async () => {
		if (busy) return;
		if (dirty) {
			const discard = await confirm({
				title: "Discard changes?",
				message: "Your edits to this set won't be saved.",
				confirmLabel: "Discard",
				cancelLabel: "Keep editing",
				destructive: true,
			});
			if (!discard) return;
		}
		onClose();
	};

	const save = async () => {
		if (!dirty || busy) return;
		setBusy(true);
		try {
			await updateSet({ id: set._id, weight, reps, setType });
			onClose();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not save the set."));
		} finally {
			setBusy(false);
		}
	};

	const duplicate = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await duplicateSet({ id: set._id });
			onClose();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not duplicate the set."));
		} finally {
			setBusy(false);
		}
	};

	const remove = async () => {
		const confirmed = await confirm({
			title: "Delete this set?",
			message: "Your 1RM for this exercise is recalculated without it.",
			confirmLabel: "Delete set",
			destructive: true,
		});
		if (!confirmed) return;
		setBusy(true);
		try {
			await removeSet({ id: set._id });
			onClose();
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the set."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<SetEditSheetPresentation
			setNumber={set.setNumber}
			exerciseName={exerciseName}
			weight={weight}
			reps={reps}
			setType={setType}
			weightStep={weightStep}
			busy={busy}
			dirty={dirty}
			onWeightChange={setWeight}
			onRepsChange={setReps}
			onSetTypeChange={setSetType}
			onRequestClose={() => void requestClose()}
			onSave={() => void save()}
			onDuplicate={() => void duplicate()}
			onDelete={() => void remove()}
		/>
	);
}
