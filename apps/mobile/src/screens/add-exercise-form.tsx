/**
 * Create a custom exercise. Ported from the web's
 * `src/components/exercises/AddExerciseForm.tsx`.
 *
 * The web uses TanStack Form + Zod; this uses plain state. Six fields with one
 * required string and one conditional number does not need a form library, and
 * the phone has neither dependency today — validation that fits in a boolean
 * is not worth two packages and a native rebuild.
 *
 * `weightIncrement` only appears for equipment that is actually loaded. A
 * bodyweight movement or a band has no plate step to configure, and offering
 * the field there invites a number that means nothing.
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
import { api } from "../convex/api";
import { colors, radius, spacing } from "../theme";
import { Chip, Eyebrow } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

const CATEGORIES = ["compound", "isolation"] as const;
type Category = (typeof CATEGORIES)[number];

const EQUIPMENT = [
	"barbell",
	"dumbbell",
	"cable",
	"bodyweight",
	"machine",
	"kettlebell",
	"band",
	"other",
] as const;
type Equipment = (typeof EQUIPMENT)[number];

/** Equipment whose load is chosen in discrete steps worth configuring. */
const LOADED: ReadonlySet<Equipment> = new Set<Equipment>([
	"barbell",
	"dumbbell",
	"cable",
	"machine",
	"kettlebell",
	"other",
]);

export function AddExerciseForm({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const toast = useToast();
	const insets = useSafeAreaInsets();
	const createExercise = useMutation(api.exercises.create);

	const [name, setName] = useState("");
	const [muscleGroups, setMuscleGroups] = useState("");
	const [category, setCategory] = useState<Category>("compound");
	const [equipment, setEquipment] = useState<Equipment>("barbell");
	const [increment, setIncrement] = useState("");
	const [notes, setNotes] = useState("");
	const [busy, setBusy] = useState(false);

	const reset = () => {
		setName("");
		setMuscleGroups("");
		setCategory("compound");
		setEquipment("barbell");
		setIncrement("");
		setNotes("");
	};

	const close = () => {
		reset();
		onClose();
	};

	const submit = async () => {
		const trimmed = name.trim();
		if (trimmed === "" || busy) return;

		// Free text, split on commas — same as the web. There is no canonical
		// muscle-group list to validate against, so a typo makes a new group
		// rather than an error. Worth knowing when the chip filters miss a row.
		const groups = muscleGroups
			.split(",")
			.map((g) => g.trim().toLowerCase())
			.filter((g) => g !== "");

		const parsedIncrement = Number.parseFloat(increment);
		const weightIncrement =
			LOADED.has(equipment) &&
			Number.isFinite(parsedIncrement) &&
			parsedIncrement > 0
				? parsedIncrement
				: undefined;

		setBusy(true);
		try {
			await createExercise({
				name: trimmed,
				muscleGroups: groups,
				category,
				equipment,
				notes: notes.trim() === "" ? undefined : notes.trim(),
				weightIncrement,
			});
			// The new row appears in the list behind this sheet, so no success
			// toast — the result is already on screen.
			close();
		} catch (error) {
			// Keep the user's input: retyping six fields to fix one is a punishment.
			toast.error(convexErrorMessage(error, "Could not create the exercise."));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={close}>
			<View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
				<View style={styles.header}>
					<AppText variant="heading">New exercise</AppText>
					<Pressable
						onPress={close}
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
						placeholder="Bulgarian split squat"
						placeholderTextColor={colors.textFaint}
						style={styles.input}
						autoFocus
					/>

					<Eyebrow>Muscle groups</Eyebrow>
					<TextInput
						value={muscleGroups}
						onChangeText={setMuscleGroups}
						placeholder="quads, glutes"
						placeholderTextColor={colors.textFaint}
						style={styles.input}
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<AppText variant="caption">Separate with commas.</AppText>

					<Eyebrow>Category</Eyebrow>
					<View style={styles.chipRow}>
						{CATEGORIES.map((c) => (
							<Pressable key={c} onPress={() => setCategory(c)}>
								<Chip label={c} active={category === c} />
							</Pressable>
						))}
					</View>

					<Eyebrow>Equipment</Eyebrow>
					<View style={styles.chipWrap}>
						{EQUIPMENT.map((e) => (
							<Pressable key={e} onPress={() => setEquipment(e)}>
								<Chip label={e} active={equipment === e} />
							</Pressable>
						))}
					</View>

					{LOADED.has(equipment) ? (
						<>
							<Eyebrow>Weight step (optional)</Eyebrow>
							<TextInput
								value={increment}
								onChangeText={setIncrement}
								placeholder="2.5"
								placeholderTextColor={colors.textFaint}
								style={styles.input}
								keyboardType="decimal-pad"
							/>
							<AppText variant="caption">
								How much the load jumps by. Defaults to the usual step for{" "}
								{equipment}.
							</AppText>
						</>
					) : null}

					<Eyebrow>Notes (optional)</Eyebrow>
					<TextInput
						value={notes}
						onChangeText={setNotes}
						placeholder="Cues, setup, anything worth remembering"
						placeholderTextColor={colors.textFaint}
						style={[styles.input, styles.multiline]}
						multiline
					/>

					<Pressable
						onPress={() => void submit()}
						disabled={busy || name.trim() === ""}
						style={[
							styles.submit,
							(busy || name.trim() === "") && styles.dimmed,
						]}
					>
						<AppText style={styles.submitText}>
							{busy ? "Creating…" : "Create exercise"}
						</AppText>
					</Pressable>
				</ScrollView>
			</View>
		</Modal>
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
	multiline: {
		minHeight: 88,
		paddingTop: spacing.sm,
		textAlignVertical: "top",
	},
	chipRow: { flexDirection: "row", gap: spacing.xs + 2 },
	chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
	submit: {
		height: 48,
		marginTop: spacing.md,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	submitText: { fontSize: 15, fontWeight: "800", color: colors.onAccent },
	dimmed: { opacity: 0.5 },
});
