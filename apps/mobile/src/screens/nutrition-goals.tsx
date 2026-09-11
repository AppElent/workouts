import {
	editedGoalCount,
	GOAL_DIRECTIONS,
	GOAL_PRESET_KEYS,
	type GoalDirection,
	type GoalPresetKey,
	NUTRIENT_KEYS,
	NUTRITION_GOAL_PRESETS,
	type NutrientKey,
} from "@workouts/core/nutrition";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api } from "../convex/api";
import { fmt, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type DraftGoal = {
	nutrient: NutrientKey;
	direction: GoalDirection;
	target: string;
	sourcePreset?: GoalPresetKey;
};

export function NutritionGoalsScreen() {
	const { t } = useI18n();
	const router = useRouter();
	const toast = useToast();
	const current = useQuery(api.nutritionGoals.list, {});
	const replace = useMutation(api.nutritionGoals.replace);
	const [draft, setDraft] = useState<DraftGoal[]>(() =>
		NUTRIENT_KEYS.flatMap((nutrient) =>
			GOAL_DIRECTIONS.map((direction) => ({ nutrient, direction, target: "" })),
		),
	);
	const [pending, setPending] = useState(false);
	const [activePreset, setActivePreset] = useState<GoalPresetKey>();

	useEffect(() => {
		if (!current) return;
		const next = NUTRIENT_KEYS.flatMap((nutrient) =>
			GOAL_DIRECTIONS.map((direction) => {
				const goal = current.find(
					(item) => item.nutrient === nutrient && item.direction === direction,
				);
				return {
					nutrient,
					direction,
					target: goal ? String(goal.target) : "",
					sourcePreset: goal?.sourcePreset,
				};
			}),
		);
		setDraft(next);
		const sources = new Set(
			next.map((row) => row.sourcePreset).filter(Boolean),
		);
		setActivePreset(
			sources.size === 1
				? next.find((row) => row.sourcePreset)?.sourcePreset
				: undefined,
		);
	}, [current]);

	const applyPreset = (key: GoalPresetKey) => {
		setActivePreset(key);
		setDraft(
			NUTRIENT_KEYS.flatMap((nutrient) =>
				GOAL_DIRECTIONS.map((direction) => {
					const goal = NUTRITION_GOAL_PRESETS[key].goals.find(
						(item) =>
							item.nutrient === nutrient && item.direction === direction,
					);
					return {
						nutrient,
						direction,
						target: goal ? String(goal.target) : "",
						sourcePreset: goal ? key : undefined,
					};
				}),
			),
		);
	};
	const update = (
		nutrient: NutrientKey,
		direction: GoalDirection,
		change: Partial<DraftGoal>,
	) =>
		setDraft((rows) =>
			rows.map((row) =>
				row.nutrient === nutrient && row.direction === direction
					? { ...row, ...change, sourcePreset: undefined }
					: row,
			),
		);
	const save = async () => {
		const goals = draft
			.filter((row) => row.target.trim())
			.map((row) => ({
				nutrient: row.nutrient,
				direction: row.direction,
				target: Number(row.target),
				sourcePreset: row.sourcePreset,
			}));
		if (
			goals.some((goal) => !Number.isFinite(goal.target) || goal.target <= 0)
		) {
			toast.error(t.nutrition.goalEditor.validation);
			return;
		}
		setPending(true);
		try {
			await replace({ goals });
			router.back();
		} catch {
			toast.error(t.nutrition.goalEditor.failure);
		} finally {
			setPending(false);
		}
	};

	if (current === undefined)
		return (
			<SkeletonGroup label={t.nutrition.goalEditor.loading}>
				<SkeletonBlock height={100} />
				<SkeletonBlock height={300} />
			</SkeletonGroup>
		);
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			<Eyebrow>{t.nutrition.goals.heading}</Eyebrow>
			<AppText variant="title">{t.nutrition.goalEditor.title}</AppText>
			<AppText>{t.nutrition.goalEditor.intro}</AppText>
			<View style={styles.presets}>
				{GOAL_PRESET_KEYS.map((key) => (
					<Pressable
						key={key}
						accessibilityRole="button"
						onPress={() => applyPreset(key)}
					>
						<Card style={styles.preset}>
							<AppText variant="heading">
								{t.nutrition.goalEditor.presets[key].name}
							</AppText>
							<AppText variant="caption">
								{t.nutrition.goalEditor.presets[key].provenance}
							</AppText>
						</Card>
					</Pressable>
				))}
			</View>
			{activePreset ? (
				<AppText variant="caption">
					{fmt(t.nutrition.goalEditor.edited, {
						count: editedGoalCount(activePreset, draft),
					})}
				</AppText>
			) : null}
			{draft.map((row) => (
				<Card key={`${row.nutrient}-${row.direction}`} style={styles.row}>
					<AppText variant="heading">
						{t.nutrition.nutrients[row.nutrient]} ·{" "}
						{t.nutrition.goalEditor.directions[row.direction]}
					</AppText>
					<View style={styles.direction}>
						<TextInput
							accessibilityLabel={`${t.nutrition.nutrients[row.nutrient]} ${t.nutrition.goalEditor.directions[row.direction]} ${t.nutrition.goalEditor.amount}`}
							keyboardType="decimal-pad"
							value={row.target}
							onChangeText={(target) =>
								update(row.nutrient, row.direction, { target })
							}
							placeholder={t.nutrition.goalEditor.amount}
							placeholderTextColor={colors.textMuted}
							style={[styles.input, styles.flex]}
						/>
						<Pressable
							accessibilityRole="button"
							onPress={() =>
								update(row.nutrient, row.direction, { target: "" })
							}
						>
							<AppText style={{ color: colors.textMuted }}>
								{t.nutrition.goalEditor.remove}
							</AppText>
						</Pressable>
					</View>
				</Card>
			))}
			<PrimaryButton
				accessibilityRole="button"
				loading={pending}
				label={
					pending ? t.nutrition.goalEditor.saving : t.nutrition.goalEditor.save
				}
				onPress={save}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, gap: spacing.md, paddingBottom: 40 },
	presets: { gap: spacing.sm },
	preset: { gap: 4 },
	row: { gap: spacing.sm },
	flex: { flex: 1 },
	direction: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	choice: {
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.pill,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	selected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
	input: {
		color: colors.text,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.md,
		padding: spacing.md,
	},
});
