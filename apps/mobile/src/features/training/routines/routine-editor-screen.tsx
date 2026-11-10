import type { Exercise, ExerciseId } from "@foundry/core/exercises";
/**
 * Build or change a routine: one screen that starts empty or starts full.
 *
 * `routines.update` replaces the whole `exercises` array rather than patching
 * it, so the editor holds the entire list in state and sends it back complete.
 * That also makes reordering and removal free.
 *
 * A weight of 0 is stored as "no default weight" (`undefined`) — the distinction matters because 0 is a legitimate load for a bodyweight
 * movement, while "unset" means the session should ask.
 */
import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api, type Id } from "../../../convex/api";
import { useExercises } from "../../../data/exercises";
import { useRoutines } from "../../../data/session-data";
import { useI18n } from "../../../i18n";
import { useConvexErrorMessage } from "../../../i18n/errors";
import { spacing } from "../../../theme";
import {
	AddRow,
	FormScreen,
	FormSection,
	FormTextField,
	StepperField,
	TextAction,
} from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { EditorStatus } from "../components/editor-status";
import { ExercisePicker } from "../exercises/exercise-picker";

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

/** Omit `routineId` to create a new routine; pass one to edit it in place. */
export function RoutineEditorScreen({
	routineId,
	onClose,
}: {
	routineId?: Id<"routines">;
	onClose: () => void;
}) {
	const copy = useI18n().t.workoutTools.routineEditor;
	const routines = useRoutines();
	const exercises = useExercises();
	const routine = routineId
		? routines?.find((candidate) => candidate._id === routineId)
		: null;
	if (routineId && routines === undefined)
		return <EditorStatus label={copy.loading} />;
	if (routineId && !routine) return <EditorStatus label={copy.notFound} />;
	return (
		<RoutineEditorForm
			routine={routine ?? null}
			exercises={exercises}
			onClose={onClose}
		/>
	);
}

function RoutineEditorForm({
	routine,
	exercises,
	onClose,
}: {
	routine: RoutineWithNames | null;
	exercises: Exercise[];
	onClose: () => void;
}) {
	const errorMessage = useConvexErrorMessage();
	const toast = useToast();
	const copy = useI18n().t.workoutTools.routineEditor;
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
			toast.error(errorMessage(error, copy.saveError));
		} finally {
			setBusy(false);
		}
	};

	const canSave = name.trim() !== "" && entries.length > 0 && !busy;

	return (
		<>
			<FormScreen
				primaryAction={{
					label: busy ? copy.saving : routine ? copy.save : copy.create,
					onPress: () => void submit(),
					loading: busy,
					disabled: !canSave,
				}}
			>
				<FormSection>
					<FormTextField
						label={copy.name}
						value={name}
						onChangeText={setName}
						placeholder={copy.namePlaceholder}
						autoCorrect={false}
						returnKeyType="next"
					/>
				</FormSection>

				<FormSection
					title={copy.exercises}
					footer={entries.length === 0 ? copy.needsExercise : undefined}
				>
					{entries.map((entry, index) => (
						<View key={entry.exerciseId} style={styles.entry}>
							<View style={styles.entryHead}>
								<AppText style={styles.entryName}>{entry.name}</AppText>
								<TextAction
									label={copy.remove}
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
									label={copy.sets}
									value={entry.defaultSets}
									min={1}
									onChange={(value) => patch(index, { defaultSets: value })}
								/>
								<StepperField
									label={copy.reps}
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
					<AddRow label={copy.addExercise} onPress={() => setPicking(true)} />
				</FormSection>
			</FormScreen>

			<ExercisePicker
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
										name: found?.name ?? copy.exercise,
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
