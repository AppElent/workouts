import type { Exercise, ExerciseId } from "@workouts/core/exercises";
/**
 * Build or change a routine. Ported from the web's
 * `src/components/routines/CreateRoutineForm.tsx` and `EditRoutineModal.tsx`,
 * which are two components because the web renders create inline on the page
 * and edit in a dialog. The phone has no room to do both, so this is one sheet
 * that either starts empty or starts full.
 *
 * `routines.update` replaces the whole `exercises` array rather than patching
 * it, so the editor holds the entire list in state and sends it back complete.
 * That also makes reordering and removal free.
 *
 * A weight of 0 is stored as "no default weight" (`undefined`), matching the
 * web — the distinction matters because 0 is a legitimate load for a bodyweight
 * movement, while "unset" means the session should ask.
 */
import { useMutation } from "convex/react";
import { useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { api } from "../convex/api";
import type { useRoutines } from "../data/session-data";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { spacing } from "../theme";
import { convexErrorMessage } from "../ui/confirm-dialog";
import {
	AddRow,
	FormScreen,
	FormSection,
	FormTextField,
	StepperField,
	TextAction,
} from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { AddExercisePicker } from "./add-exercise-picker";

type Entry = {
	exerciseId: ExerciseId;
	name: string;
	defaultSets: number;
	defaultReps: number;
	defaultWeight: number;
};

/**
 * The shape `routines.list` returns — the doc, but with each entry's
 * `exerciseName` resolved server-side. Derived from the query rather than
 * hand-written so it cannot drift from what Convex actually sends.
 */
type RoutineWithNames = NonNullable<ReturnType<typeof useRoutines>>[number];

export function RoutineEditor({
	visible = true,
	presentation = "modal",
	routine,
	exercises,
	onClose,
}: {
	visible?: boolean;
	presentation?: "modal" | "screen";
	/** Omit to create a new routine; pass one to edit it in place. */
	routine?: RoutineWithNames | null;
	exercises: Exercise[] | undefined;
	onClose: () => void;
}) {
	const toast = useToast();
	const reduceMotion = useReduceMotion();
	const createRoutine = useMutation(api.routines.create);
	const updateRoutine = useMutation(api.routines.update);

	const [name, setName] = useState(routine?.name ?? "");
	const [entries, setEntries] = useState<Entry[]>(
		() =>
			routine?.exercises.map((e) => ({
				exerciseId: e.exerciseId,
				name: e.exerciseName,
				defaultSets: e.defaultSets,
				defaultReps: e.defaultReps,
				defaultWeight: e.defaultWeight ?? 0,
			})) ?? [],
	);
	const [picking, setPicking] = useState(false);
	const [busy, setBusy] = useState(false);

	const patch = (index: number, changes: Partial<Entry>) => {
		setEntries((prev) =>
			prev.map((e, i) => (i === index ? { ...e, ...changes } : e)),
		);
	};

	const submit = async () => {
		const trimmed = name.trim();
		if (trimmed === "" || entries.length === 0 || busy) return;

		const payload = entries.map((e) => ({
			exerciseId: e.exerciseId,
			defaultSets: e.defaultSets,
			defaultReps: e.defaultReps,
			defaultWeight: e.defaultWeight > 0 ? e.defaultWeight : undefined,
		}));

		setBusy(true);
		try {
			if (routine) {
				await updateRoutine({
					id: routine._id,
					name: trimmed,
					exercises: payload,
				});
			} else {
				await createRoutine({ name: trimmed, exercises: payload });
			}
			onClose();
		} catch (error) {
			// Input is kept on failure — the sheet stays open with everything typed.
			toast.error(convexErrorMessage(error, "Could not save the routine."));
		} finally {
			setBusy(false);
		}
	};

	const canSave = name.trim() !== "" && entries.length > 0 && !busy;

	const content = (
		<>
			<FormScreen
				title={
					presentation === "modal"
						? routine
							? "Edit routine"
							: "New routine"
						: undefined
				}
				onCancel={presentation === "modal" && !busy ? onClose : undefined}
				primaryAction={{
					label: busy ? "Saving…" : routine ? "Save changes" : "Create routine",
					onPress: () => void submit(),
					loading: busy,
					disabled: !canSave,
				}}
			>
				<FormSection>
					<FormTextField
						label="Routine name"
						value={name}
						onChangeText={setName}
						placeholder="Push day"
						autoCorrect={false}
						returnKeyType="next"
					/>
				</FormSection>

				<FormSection
					title="Exercises"
					footer={
						entries.length === 0
							? "Add at least one exercise to save."
							: undefined
					}
				>
					{entries.map((entry, index) => (
						<View key={entry.exerciseId} style={styles.entry}>
							<View style={styles.entryHead}>
								<AppText style={styles.entryName}>{entry.name}</AppText>
								<TextAction
									label="Remove"
									tone="destructive"
									onPress={() =>
										setEntries((current) =>
											current.filter((_, itemIndex) => itemIndex !== index),
										)
									}
								/>
							</View>
							<View style={styles.numberRow}>
								<StepperField
									label="sets"
									value={entry.defaultSets}
									min={1}
									onChange={(value) => patch(index, { defaultSets: value })}
								/>
								<StepperField
									label="reps"
									value={entry.defaultReps}
									min={1}
									onChange={(value) => patch(index, { defaultReps: value })}
								/>
								<StepperField
									label="kg"
									value={entry.defaultWeight}
									step={2.5}
									onChange={(value) => patch(index, { defaultWeight: value })}
								/>
							</View>
						</View>
					))}
					<AddRow label="Add exercise" onPress={() => setPicking(true)} />
				</FormSection>
			</FormScreen>

			<AddExercisePicker
				visible={picking}
				exercises={exercises}
				onClose={() => setPicking(false)}
				onSelect={(id) => {
					const found = exercises?.find((e) => e._id === id);
					setEntries((prev) =>
						prev.some((e) => e.exerciseId === id)
							? prev
							: [
									...prev,
									{
										exerciseId: id,
										name: found?.name ?? "Exercise",
										defaultSets: 3,
										defaultReps: 8,
										defaultWeight: 0,
									},
								],
					);
					setPicking(false);
				}}
			/>
		</>
	);

	if (presentation === "screen") return content;

	return (
		<Modal
			presentationStyle="pageSheet"
			allowSwipeDismissal={!busy}
			visible={visible}
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			{content}
		</Modal>
	);
}

const styles = StyleSheet.create({
	entry: {
		gap: spacing.sm,
		padding: spacing.md,
	},
	entryHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	entryName: { fontWeight: "700" },
	numberRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
