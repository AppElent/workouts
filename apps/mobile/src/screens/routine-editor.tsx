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
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Doc, type Id } from "../convex/api";
import type { useRoutines } from "../data/session-data";
import { colors, radius, spacing } from "../theme";
import { Eyebrow } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { AddExercisePicker } from "./add-exercise-picker";

type Entry = {
	exerciseId: Id<"exercises">;
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
	visible,
	routine,
	exercises,
	onClose,
}: {
	visible: boolean;
	/** Omit to create a new routine; pass one to edit it in place. */
	routine?: RoutineWithNames | null;
	exercises: Doc<"exercises">[] | undefined;
	onClose: () => void;
}) {
	const toast = useToast();
	const insets = useSafeAreaInsets();
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

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
			<View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
				<View style={styles.header}>
					<AppText variant="heading">
						{routine ? "Edit routine" : "New routine"}
					</AppText>
					<Pressable
						onPress={onClose}
						hitSlop={12}
						accessibilityRole="button"
						accessibilityLabel="Cancel"
					>
						<AppText variant="body" style={styles.cancel}>
							Cancel
						</AppText>
					</Pressable>
				</View>

				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<Eyebrow>Name</Eyebrow>
					<TextInput
						value={name}
						onChangeText={setName}
						placeholder="Push day"
						placeholderTextColor={colors.textFaint}
						style={styles.input}
					/>

					<Eyebrow>Exercises</Eyebrow>
					{entries.length === 0 ? (
						<AppText variant="caption">
							Add at least one exercise to save.
						</AppText>
					) : (
						entries.map((entry, index) => (
							<View key={entry.exerciseId} style={styles.entry}>
								<View style={styles.entryHead}>
									<AppText variant="body" style={styles.entryName}>
										{entry.name}
									</AppText>
									<Pressable
										onPress={() =>
											setEntries((prev) => prev.filter((_, i) => i !== index))
										}
										hitSlop={12}
										accessibilityRole="button"
										accessibilityLabel={`Remove ${entry.name}`}
									>
										<AppText variant="caption" style={styles.remove}>
											Remove
										</AppText>
									</Pressable>
								</View>
								<View style={styles.numberRow}>
									<NumberField
										label="sets"
										value={entry.defaultSets}
										min={1}
										onChange={(v) => patch(index, { defaultSets: v })}
									/>
									<NumberField
										label="reps"
										value={entry.defaultReps}
										min={1}
										onChange={(v) => patch(index, { defaultReps: v })}
									/>
									<NumberField
										label="kg"
										value={entry.defaultWeight}
										step={2.5}
										onChange={(v) => patch(index, { defaultWeight: v })}
									/>
								</View>
							</View>
						))
					)}

					<Pressable onPress={() => setPicking(true)} style={styles.addBtn}>
						<AppText style={styles.addBtnText}>+ Add exercise</AppText>
					</Pressable>

					<Pressable
						onPress={() => void submit()}
						disabled={!canSave}
						style={[styles.submit, !canSave && styles.dimmed]}
					>
						<AppText style={styles.submitText}>
							{busy ? "Saving…" : routine ? "Save changes" : "Create routine"}
						</AppText>
					</Pressable>
				</ScrollView>
			</View>

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
		</Modal>
	);
}

function NumberField({
	label,
	value,
	step = 1,
	min = 0,
	onChange,
}: {
	label: string;
	value: number;
	step?: number;
	min?: number;
	onChange: (v: number) => void;
}) {
	const round = (n: number) => Math.round(n * 10) / 10;

	return (
		<View style={styles.numberField}>
			<Pressable
				onPress={() => onChange(round(Math.max(min, value - step)))}
				hitSlop={6}
				style={styles.numberBtn}
				accessibilityRole="button"
				accessibilityLabel={`Decrease ${label}`}
			>
				<AppText style={styles.numberGlyph}>–</AppText>
			</Pressable>
			<View style={styles.numberValueWrap}>
				<AppText style={styles.numberValue}>{value}</AppText>
				<AppText style={styles.numberLabel}>{label}</AppText>
			</View>
			<Pressable
				onPress={() => onChange(round(value + step))}
				hitSlop={6}
				style={styles.numberBtn}
				accessibilityRole="button"
				accessibilityLabel={`Increase ${label}`}
			>
				<AppText style={styles.numberGlyph}>+</AppText>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: 44,
	},
	cancel: { color: colors.accent, fontWeight: "700" },
	content: { gap: spacing.sm, paddingBottom: spacing.xxl },
	input: {
		minHeight: 48,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 15,
	},
	entry: {
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		padding: spacing.sm + 2,
	},
	entryHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	entryName: { fontWeight: "700" },
	remove: { color: colors.danger, fontWeight: "700" },
	numberRow: { flexDirection: "row", gap: spacing.xs + 2 },
	numberField: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		height: 48,
		paddingHorizontal: 2,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
	},
	numberBtn: {
		width: 36,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	numberGlyph: { fontSize: 18, fontWeight: "800", color: colors.textMuted },
	numberValueWrap: { alignItems: "center" },
	numberValue: { fontSize: 16, fontWeight: "800", color: colors.text },
	numberLabel: { fontSize: 9, color: colors.textMuted },
	addBtn: {
		minHeight: 44,
		borderRadius: radius.pill,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	addBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
	submit: {
		height: 48,
		marginTop: spacing.sm,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	submitText: { fontSize: 15, fontWeight: "800", color: colors.onAccent },
	dimmed: { opacity: 0.5 },
});
