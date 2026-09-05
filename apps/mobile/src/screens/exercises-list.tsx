/**
 * The exercise library, ported from the web's `src/routes/exercises/index.tsx`.
 *
 * All four filters are client-side and compose with AND, exactly as on the web:
 * `exercises.list` returns the whole catalog in one subscription (defaults plus
 * the user's own), so filtering here costs nothing and filtering server-side
 * would cost a round trip per keystroke.
 *
 * Default exercises are shared and cannot be deleted — the backend enforces
 * that, and the row hides the affordance rather than offering a button that
 * always fails.
 */
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	FlatList,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api, type Doc } from "../convex/api";
import { useShellData } from "../data/session-data";
import { colors, radius, spacing } from "../theme";
import { Chip } from "../ui/coach";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { Screen } from "../ui/screen";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { AddExerciseForm } from "./add-exercise-form";

/**
 * Muscle-group shortcuts, transcribed from the web. Several map to more than
 * one raw group — "Back" has to catch lats and traps or it misses most rows —
 * and traps deliberately appear under both Back and Shoulders, since which one
 * a person means depends on the exercise.
 */
const CHIP_FILTERS: { label: string; groups: string[] | null }[] = [
	{ label: "All", groups: null },
	{ label: "Chest", groups: ["chest"] },
	{ label: "Back", groups: ["back", "lats", "traps"] },
	{ label: "Legs", groups: ["quads", "hamstrings", "glutes", "calves"] },
	{
		label: "Shoulders",
		groups: ["shoulders", "front delts", "side delts", "rear delts", "traps"],
	},
	{ label: "Arms", groups: ["biceps", "triceps", "forearms"] },
	{ label: "Core", groups: ["core"] },
];

const CATEGORIES = ["compound", "isolation"] as const;
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

export function ExercisesScreen({ showBack }: { showBack: boolean }) {
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const { exercises } = useShellData();
	const removeExercise = useMutation(api.exercises.remove);

	const [search, setSearch] = useState("");
	const [chip, setChip] = useState("All");
	const [category, setCategory] = useState<string | null>(null);
	const [equipment, setEquipment] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		const groups = CHIP_FILTERS.find((c) => c.label === chip)?.groups ?? null;

		return (exercises ?? [])
			.filter((ex) => {
				if (term && !ex.name.toLowerCase().includes(term)) return false;
				if (groups && !ex.muscleGroups.some((mg) => groups.includes(mg))) {
					return false;
				}
				if (category && ex.category !== category) return false;
				if (equipment && ex.equipment !== equipment) return false;
				return true;
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [exercises, search, chip, category, equipment]);

	const remove = async (exercise: Doc<"exercises">) => {
		const confirmed = await confirm({
			title: `Delete ${exercise.name}?`,
			message: "Every set and 1RM logged against it goes too.",
			confirmLabel: "Delete exercise",
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await removeExercise({ id: exercise._id });
		} catch (error) {
			toast.error(convexErrorMessage(error, "Could not delete the exercise."));
		}
	};

	return (
		<Screen edges={showBack ? ["top", "bottom"] : ["top"]}>
			<View style={styles.header}>
				{showBack ? (
					<Pressable
						onPress={() => router.back()}
						hitSlop={12}
						accessibilityRole="button"
						accessibilityLabel="Go back"
					>
						<AppText variant="heading" style={{ color: colors.accent }}>
							‹
						</AppText>
					</Pressable>
				) : null}
				<AppText variant="title" style={styles.flex}>
					Exercises
				</AppText>
				<Pressable
					onPress={() => setCreating(true)}
					hitSlop={12}
					accessibilityRole="button"
					accessibilityLabel="Add exercise"
				>
					<AppText variant="heading" style={{ color: colors.accent }}>
						+
					</AppText>
				</Pressable>
			</View>

			<View style={styles.filters}>
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search exercises"
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					autoCorrect={false}
				/>

				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View style={styles.chipRow}>
						{CHIP_FILTERS.map((c) => (
							<Pressable key={c.label} onPress={() => setChip(c.label)}>
								<Chip label={c.label} active={c.label === chip} />
							</Pressable>
						))}
					</View>
				</ScrollView>

				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View style={styles.chipRow}>
						{CATEGORIES.map((c) => (
							<Pressable
								key={c}
								onPress={() => setCategory(category === c ? null : c)}
							>
								<Chip label={c} active={category === c} />
							</Pressable>
						))}
						{EQUIPMENT.map((e) => (
							<Pressable
								key={e}
								onPress={() => setEquipment(equipment === e ? null : e)}
							>
								<Chip label={e} active={equipment === e} />
							</Pressable>
						))}
					</View>
				</ScrollView>
			</View>

			{exercises === undefined ? (
				<AppText variant="caption" style={styles.status}>
					Loading…
				</AppText>
			) : (
				<FlatList
					data={filtered}
					keyExtractor={(item) => item._id}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					ListEmptyComponent={
						<View style={styles.empty}>
							<AppText variant="heading" style={{ color: colors.textMuted }}>
								Nothing matches
							</AppText>
							<AppText variant="caption" style={styles.centered}>
								{exercises.length === 0
									? "The library is empty — add your first exercise."
									: "Try clearing a filter or two."}
							</AppText>
						</View>
					}
					renderItem={({ item }) => (
						<Pressable
							onPress={() =>
								router.push({
									pathname: "/exercise/[id]",
									params: { id: item._id },
								})
							}
							style={({ pressed }) => [
								styles.row,
								pressed && { backgroundColor: colors.surface2 },
							]}
						>
							<View style={styles.flex}>
								<AppText variant="body" style={styles.name}>
									{item.name}
								</AppText>
								<AppText variant="caption" style={styles.meta}>
									{item.category} · {item.equipment}
								</AppText>
							</View>
							{item.isDefault ? null : (
								<Pressable
									onPress={() => void remove(item)}
									hitSlop={12}
									accessibilityRole="button"
									accessibilityLabel={`Delete ${item.name}`}
								>
									<AppText variant="body" style={styles.delete}>
										Delete
									</AppText>
								</Pressable>
							)}
						</Pressable>
					)}
				/>
			)}

			<AddExerciseForm visible={creating} onClose={() => setCreating(false)} />
		</Screen>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
	},
	flex: { flex: 1 },
	filters: { paddingHorizontal: spacing.md, gap: spacing.sm },
	input: {
		minHeight: 44,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 15,
	},
	chipRow: { flexDirection: "row", gap: spacing.xs + 2 },
	status: { paddingHorizontal: spacing.md },
	list: {
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
		paddingBottom: spacing.xxl * 2,
		gap: spacing.sm,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
	},
	name: { fontWeight: "700" },
	meta: { marginTop: 2, textTransform: "capitalize" },
	delete: { color: colors.danger, fontWeight: "700" },
	empty: { alignItems: "center", gap: 4, paddingVertical: spacing.xl },
	centered: { textAlign: "center" },
});
