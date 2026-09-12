import {
	editedGoalCount,
	GOAL_PRESET_KEYS,
	type GoalPresetKey,
	NUTRIENT_KEYS,
	NUTRITION_GOAL_PRESETS,
	type NutrientKey,
} from "@workouts/core/nutrition";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api } from "../convex/api";
import { type IsoDate, todayIsoDate } from "../data/calendar-day";
import {
	draftFromGoals,
	draftToGoals,
	emptyGoalDraft,
	enabledGoalNutrients,
	type GoalDraft,
	goalHistoryLabel,
} from "../data/nutrition-goal-history";
import { getNutritionGoalsCopy } from "../data/nutrition-goals-copy";
import { useStalledOffline } from "../data/stalled-offline";
import { fmt, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { NutritionCalendar } from "../ui/nutrition-calendar";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function NutritionGoalsScreen() {
	const { t, locale } = useI18n();
	const copy = getNutritionGoalsCopy(locale);
	const router = useRouter();
	const toast = useToast();
	const today = todayIsoDate();
	const [retryNonce, setRetryNonce] = useState(0);
	const queryArgs = retryNonce % 2 === 0 ? {} : "skip";
	const current = useQuery(api.nutritionGoals.list, queryArgs);
	const replace = useMutation(api.nutritionGoals.replace);
	const [effectiveFrom, setEffectiveFrom] = useState<IsoDate>(today);
	const selectedResponse = useQuery(
		api.nutritionGoals.forDate,
		retryNonce % 2 === 0 ? { date: effectiveFrom } : "skip",
	);
	const { isWebSocketConnected } = useConvexConnectionState();
	const serverGoals =
		selectedResponse?.goals ?? (effectiveFrom === today ? current : undefined);
	const stalledOffline = useStalledOffline(
		serverGoals === undefined,
		isWebSocketConnected,
	);
	const [draft, setDraft] = useState<GoalDraft>(emptyGoalDraft);
	const [sourcePresets, setSourcePresets] = useState<
		Record<string, GoalPresetKey | undefined>
	>({});
	const [revealedBounds, setRevealedBounds] = useState<Set<string>>(
		() => new Set(["energy.max"]),
	);
	const [dirty, setDirty] = useState(false);
	const [showExtras, setShowExtras] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pending, setPending] = useState(false);
	const [activePreset, setActivePreset] = useState<GoalPresetKey>();
	const saveInFlight = useRef(false);

	const retry = () => {
		setRetryNonce((value) => value + 1);
		setTimeout(() => setRetryNonce((value) => value + 1), 0);
	};

	useEffect(() => {
		if (!serverGoals || dirty) return;
		setDraft(draftFromGoals(serverGoals));
		const nextSources: Record<string, GoalPresetKey | undefined> = {};
		for (const goal of serverGoals) {
			nextSources[`${goal.nutrient}.${goal.direction}`] = goal.sourcePreset;
		}
		setSourcePresets(nextSources);
		setRevealedBounds(
			new Set([
				"energy.max",
				...serverGoals.map((goal) => `${goal.nutrient}.${goal.direction}`),
			]),
		);
		const sources = new Set(
			serverGoals.map((goal) => goal.sourcePreset).filter(Boolean),
		);
		setActivePreset(
			sources.size === 1
				? (serverGoals.find((goal) => goal.sourcePreset)
						?.sourcePreset as GoalPresetKey)
				: undefined,
		);
	}, [dirty, serverGoals]);

	const setBound = (
		nutrient: NutrientKey,
		direction: "min" | "max",
		target: string,
	) => {
		setDraft((currentDraft) => ({
			...currentDraft,
			[nutrient]: { ...currentDraft[nutrient], [direction]: target },
		}));
		setSourcePresets((currentSources) => ({
			...currentSources,
			[`${nutrient}.${direction}`]: undefined,
		}));
		setDirty(true);
		setErrors((currentErrors) => {
			const next = { ...currentErrors };
			delete next[`${nutrient}.${direction}`];
			delete next[`${nutrient}.range`];
			return next;
		});
	};

	const applyPreset = (key: GoalPresetKey) => {
		setActivePreset(key);
		const next = emptyGoalDraft();
		const nextSources: Record<string, GoalPresetKey | undefined> = {};
		for (const goal of NUTRITION_GOAL_PRESETS[key].goals) {
			next[goal.nutrient][goal.direction] = String(goal.target);
			nextSources[`${goal.nutrient}.${goal.direction}`] = key;
		}
		setDraft(next);
		setSourcePresets(nextSources);
		setRevealedBounds(
			new Set(
				NUTRIENT_KEYS.flatMap((nutrient) => [
					`${nutrient}.min`,
					`${nutrient}.max`,
				]),
			),
		);
		setDirty(true);
	};

	const addBound = (nutrient: NutrientKey, direction: "min" | "max") => {
		setRevealedBounds((currentBounds) =>
			new Set(currentBounds).add(`${nutrient}.${direction}`),
		);
		setDirty(true);
	};

	const save = async () => {
		if (saveInFlight.current) return;
		const parsed = draftToGoals(draft);
		if (parsed.errors.length > 0) {
			const nextErrors: Record<string, string> = {};
			for (const error of parsed.errors) {
				nextErrors[error.key] =
					error.message === "range" ? copy.range : copy.invalid;
			}
			setErrors(nextErrors);
			toast.error(
				parsed.errors.some((error) => error.message === "range")
					? copy.range
					: copy.invalid,
			);
			return;
		}
		const goals = parsed.goals.map((goal) => ({
			...goal,
			sourcePreset: sourcePresets[`${goal.nutrient}.${goal.direction}`],
		}));
		saveInFlight.current = true;
		setPending(true);
		try {
			await replace({ goals, effectiveFrom });
			setDirty(false);
			router.back();
		} catch {
			toast.error(t.nutrition.goalEditor.failure);
		} finally {
			saveInFlight.current = false;
			setPending(false);
		}
	};

	if (serverGoals === undefined && !dirty)
		return (
			<>
				{stalledOffline ? (
					<Card style={styles.offlineCard}>
						<EmptyState
							title={copy.offlineTitle}
							body={copy.offlineBody}
							action={{ label: copy.retry, onPress: retry }}
						/>
					</Card>
				) : (
					<SkeletonGroup label={t.nutrition.goalEditor.loading}>
						<SkeletonBlock height={160} />
						<SkeletonBlock height={220} />
						<SkeletonBlock height={220} />
					</SkeletonGroup>
				)}
			</>
		);
	const enabled = enabledGoalNutrients(draft);
	const hiddenNutrients = NUTRIENT_KEYS.filter(
		(nutrient) => !enabled.includes(nutrient),
	);
	const presetEditedCount = activePreset
		? editedGoalCount(
				activePreset,
				NUTRIENT_KEYS.flatMap((nutrient) =>
					(["min", "max"] as const).map((direction) => ({
						nutrient,
						direction,
						sourcePreset: sourcePresets[`${nutrient}.${direction}`],
					})),
				),
			)
		: 0;
	const preview = draftToGoals(draft).goals;
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			{stalledOffline ? (
				<Card style={styles.offlineCard}>
					<EmptyState
						title={copy.offlineTitle}
						body={copy.offlineBody}
						action={{ label: copy.retry, onPress: retry }}
					/>
				</Card>
			) : null}
			<Eyebrow>{t.nutrition.goals.heading}</Eyebrow>
			<AppText variant="title">{t.nutrition.goalEditor.title}</AppText>
			<AppText>{t.nutrition.goalEditor.intro}</AppText>
			<Card style={styles.dateCard}>
				<AppText variant="heading">{copy.applyFrom}</AppText>
				<AppText variant="caption">{copy.applyFromHint}</AppText>
				<AppText style={styles.dateValue}>{effectiveFrom}</AppText>
				<NutritionCalendar
					selectedDate={effectiveFrom}
					onSelect={setEffectiveFrom}
					locale={locale}
					labels={{ today: t.nutrition.day.goToToday }}
				/>
				{selectedResponse ? (
					<AppText variant="caption">
						{goalHistoryLabel({
							basis: selectedResponse.basis,
							effectiveFrom: selectedResponse.effectiveFrom,
							locale,
						})}
					</AppText>
				) : null}
			</Card>
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
			{activePreset && presetEditedCount > 0 ? (
				<AppText variant="caption">
					{fmt(t.nutrition.goalEditor.edited, {
						count: presetEditedCount,
					})}
				</AppText>
			) : null}
			{enabled.map((nutrient) => {
				const directions = (["min", "max"] as const).filter(
					(direction) =>
						nutrient === "energy" ||
						draft[nutrient][direction].trim() ||
						revealedBounds.has(`${nutrient}.${direction}`),
				);
				return (
					<Card key={nutrient} style={styles.row}>
						<AppText variant="heading">
							{t.nutrition.nutrients[nutrient]}
						</AppText>
						{directions.map((direction) => (
							<View key={direction} style={styles.bound}>
								<TextInput
									accessibilityLabel={`${t.nutrition.nutrients[nutrient]} ${t.nutrition.goalEditor.directions[direction]} ${t.nutrition.goalEditor.amount}`}
									keyboardType="decimal-pad"
									value={draft[nutrient][direction]}
									onChangeText={(target) =>
										setBound(nutrient, direction, target)
									}
									placeholder={t.nutrition.goalEditor.directions[direction]}
									placeholderTextColor={colors.textMuted}
									style={styles.input}
								/>
								<AppText variant="caption">
									{t.nutrition.goalEditor.directions[direction]}
								</AppText>
								<Pressable
									accessibilityRole="button"
									onPress={() => setBound(nutrient, direction, "")}
								>
									<AppText style={styles.remove}>{copy.removeBound}</AppText>
								</Pressable>
								{errors[`${nutrient}.${direction}`] ? (
									<AppText style={styles.error}>
										{errors[`${nutrient}.${direction}`]}
									</AppText>
								) : null}
							</View>
						))}
						{errors[`${nutrient}.range`] ? (
							<AppText style={styles.error}>
								{errors[`${nutrient}.range`]}
							</AppText>
						) : null}
						<View style={styles.addBounds}>
							{(["min", "max"] as const).map((direction) =>
								directions.includes(direction) ? null : (
									<Pressable
										key={direction}
										accessibilityRole="button"
										onPress={() => addBound(nutrient, direction)}
									>
										<AppText style={styles.add}>
											{direction === "min" ? copy.addMinimum : copy.addMaximum}
										</AppText>
									</Pressable>
								),
							)}
						</View>
					</Card>
				);
			})}
			{hiddenNutrients.length > 0 ? (
				<Card style={styles.extraCard}>
					<Pressable
						accessibilityRole="button"
						onPress={() => setShowExtras((value) => !value)}
					>
						<AppText style={styles.add}>
							{showExtras ? copy.showLessNutrients : copy.showMoreNutrients}
						</AppText>
					</Pressable>
					{showExtras ? (
						<View style={styles.extraList}>
							{hiddenNutrients.map((nutrient) => (
								<Pressable
									key={nutrient}
									accessibilityRole="button"
									onPress={() => {
										addBound(nutrient, "min");
										setDraft((currentDraft) => ({
											...currentDraft,
											[nutrient]: { ...currentDraft[nutrient], min: "" },
										}));
										setDirty(true);
									}}
								>
									<AppText>{t.nutrition.nutrients[nutrient]}</AppText>
								</Pressable>
							))}
						</View>
					) : null}
				</Card>
			) : null}
			<Card style={styles.preview}>
				<AppText variant="heading">{copy.preview}</AppText>
				{preview.length === 0 ? (
					<AppText variant="caption">{copy.previewEmpty}</AppText>
				) : (
					preview.map((goal) => (
						<AppText
							key={`${goal.nutrient}.${goal.direction}`}
							variant="caption"
						>
							{t.nutrition.nutrients[goal.nutrient]} · {goal.target}
						</AppText>
					))
				)}
			</Card>
			{dirty ? <AppText variant="caption">{copy.unsaved}</AppText> : null}
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
	dateCard: { gap: spacing.sm },
	dateValue: { color: colors.accent, fontWeight: "800" },
	row: { gap: spacing.sm },
	bound: { gap: spacing.xs },
	addBounds: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
	add: { color: colors.accent, fontWeight: "800" },
	remove: { color: colors.textMuted },
	error: { color: colors.danger },
	extraCard: { gap: spacing.sm },
	extraList: { gap: spacing.md },
	preview: { gap: spacing.xs },
	offlineCard: { gap: spacing.sm },
	input: {
		width: "100%",
		color: colors.text,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.md,
		padding: spacing.md,
	},
});
