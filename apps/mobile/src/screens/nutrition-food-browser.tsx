import {
	allShippedFoods,
	formatServingSelection,
	NEVO_ATTRIBUTION,
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientValue,
	previewServing,
	roundForDisplay,
	SALT_DERIVATION_DISCLOSURE,
	type ServingOption,
	type ShippedFood,
	searchShippedFoods,
	servingOptions,
	shippedLibraryMeta,
} from "@workouts/core/nutrition";
import { useMutation } from "convex/react";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api } from "../convex/api";
import { formatLongDate } from "../data/calendar-day";
import type { MealSlot } from "../data/nutrition-day";
import type { PersonalFood } from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import { fmt, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { useConfirm } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { PersonalFoodEditor } from "./personal-food-editor";

const RESULT_PAGE_SIZE = 50;

type FoodSelection =
	| { readonly kind: "shipped"; readonly food: ShippedFood }
	| { readonly kind: "personal"; readonly food: PersonalFood };

export function NutritionFoodBrowser({
	meal,
	date,
	onClose,
}: {
	meal: MealSlot;
	date: string;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const personalFoods = usePersonalFoods();
	const confirm = useConfirm();
	const toast = useToast();
	const [query, setQuery] = useState("");
	const [searchAll, setSearchAll] = useState(false);
	const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
	const [selectedFood, setSelectedFood] = useState<FoodSelection>();
	const [editingFood, setEditingFood] = useState<PersonalFood>();
	const [creatingFood, setCreatingFood] = useState(false);
	const allResults = useMemo(() => {
		const local = personalFoods.search(query, locale).map((food) => ({
			kind: "personal" as const,
			food,
		}));
		if (searchAll && query.trim().length === 0) {
			const shipped = allShippedFoods()
				.filter((candidate) => !candidate.retired)
				.sort((a, b) =>
					a.sourceName[locale].localeCompare(b.sourceName[locale]),
				)
				.map((food) => ({ kind: "shipped" as const, food }));
			return [...local, ...shipped];
		}
		const shipped = searchShippedFoods(query, {
			locale,
			scope: searchAll ? "all" : "promoted",
			limit: searchAll ? 2328 : RESULT_PAGE_SIZE,
		}).map(({ food }) => ({ kind: "shipped" as const, food }));
		return [...local, ...shipped];
	}, [locale, personalFoods, query, searchAll]);
	const results = allResults.slice(0, visibleCount);

	if (creatingFood || editingFood) {
		return (
			<PersonalFoodEditor
				food={editingFood}
				onCancel={() => {
					setCreatingFood(false);
					setEditingFood(undefined);
				}}
				onSaved={(food) => {
					setCreatingFood(false);
					setEditingFood(undefined);
					setSelectedFood({ kind: "personal", food });
				}}
			/>
		);
	}

	if (selectedFood) {
		return (
			<ServingDetail
				selection={selectedFood}
				meal={meal}
				date={date}
				onBack={() => setSelectedFood(undefined)}
				onLogged={onClose}
				onEdit={
					selectedFood.kind === "personal"
						? () => setEditingFood(selectedFood.food)
						: undefined
				}
				onDelete={
					selectedFood.kind === "personal"
						? async () => {
								const approved = await confirm({
									title: t.nutrition.personalFood.deleteTitle,
									message: t.nutrition.personalFood.deleteBody,
									confirmLabel: t.nutrition.personalFood.delete,
									cancelLabel: t.nutrition.personalFood.cancel,
									destructive: true,
								});
								if (!approved) return;
								try {
									personalFoods.remove(selectedFood.food.id);
									setSelectedFood(undefined);
								} catch {
									toast.error(t.nutrition.personalFood.deleteFailure);
								}
							}
						: undefined
				}
			/>
		);
	}

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<Header backLabel={t.common.back} onBack={onClose} />
			<View style={styles.heading}>
				<Eyebrow>{t.nutrition.title}</Eyebrow>
				<AppText variant="title">
					{fmt(t.nutrition.foodBrowser.title, {
						meal: t.nutrition.meals[meal],
					})}
				</AppText>
				<AppText variant="caption">{formatLongDate(date, locale)}</AppText>
			</View>
			<View style={styles.findControls}>
				<TextInput
					value={query}
					onChangeText={(value) => {
						setQuery(value);
						setSearchAll(false);
						setVisibleCount(RESULT_PAGE_SIZE);
					}}
					placeholder={t.nutrition.foodBrowser.searchPlaceholder}
					placeholderTextColor={colors.textFaint}
					accessibilityLabel={t.nutrition.foodBrowser.searchPlaceholder}
					style={[styles.input, styles.flex]}
					autoCorrect={false}
				/>
				<GhostButton label={t.nutrition.foodBrowser.scanBarcode} />
			</View>
			<GhostButton
				label={t.nutrition.personalFood.createTitle}
				onPress={() => setCreatingFood(true)}
			/>
			{!searchAll ? (
				<GhostButton
					label={t.nutrition.foodBrowser.searchAll}
					onPress={() => {
						setSearchAll(true);
						setVisibleCount(RESULT_PAGE_SIZE);
					}}
				/>
			) : null}
			<AppText variant="label">
				{searchAll
					? t.nutrition.foodBrowser.allResults
					: t.nutrition.foodBrowser.promotedResults}
			</AppText>
			{results.length === 0 ? (
				<EmptyState body={t.nutrition.foodBrowser.empty} />
			) : (
				<Card style={styles.results}>
					{results.map((result) => (
						<Pressable
							key={`${result.kind}:${result.food.id}`}
							onPress={() => setSelectedFood(result)}
							accessibilityRole="button"
							style={({ pressed }) => [
								styles.foodRow,
								pressed && styles.pressed,
							]}
						>
							<AppText variant="heading">
								{result.kind === "shipped" ? (result.food.emoji ?? "•") : "◇"}
							</AppText>
							<View style={styles.flex}>
								<AppText style={styles.strong}>
									{result.kind === "personal"
										? result.food.name[locale]
										: (searchAll ? result.food.sourceName : result.food.name)[
												locale
											]}
								</AppText>
								<AppText variant="caption">
									{result.kind === "personal"
										? t.nutrition.personalFood.resultLabel
										: `${t.nutrition.foodBrowser.per100} ${result.food.baseUnit}`}
								</AppText>
							</View>
						</Pressable>
					))}
				</Card>
			)}
			{results.length < allResults.length ? (
				<GhostButton
					label={t.nutrition.foodBrowser.showMore}
					onPress={() => setVisibleCount((count) => count + RESULT_PAGE_SIZE)}
				/>
			) : null}
		</ScrollView>
	);
}

function ServingDetail({
	selection,
	meal,
	date,
	onBack,
	onLogged,
	onEdit,
	onDelete,
}: {
	selection: FoodSelection;
	meal: MealSlot;
	date: string;
	onBack: () => void;
	onLogged: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}) {
	const { t, locale } = useI18n();
	const toast = useToast();
	const log = useMutation(api.nutritionDiary.log);
	const [logging, setLogging] = useState(false);
	const food = selection.food;
	const choices = useMemo(() => servingChoices(selection), [selection]);
	const [selectedServing, setSelectedServing] = useState<ServingOption>(
		choices[0],
	);
	const [quantityText, setQuantityText] = useState("1");
	const parsed = Number(quantityText.replace(",", "."));
	const quantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
	const preview = servingPreview(selection, selectedServing, quantity, locale);
	const canLog = quantity > 0 && selection.kind === "shipped";

	async function logFood() {
		if (!canLog || logging) return;
		setLogging(true);
		try {
			if (selection.kind !== "shipped") return;
			const meta = shippedLibraryMeta();
			await log({
				date,
				meal,
				name: selection.food.name,
				serving: {
					en: formatServingSelection(selectedServing, quantity, "en"),
					nl: formatServingSelection(selectedServing, quantity, "nl"),
				},
				quantity,
				amount: preview.amount,
				baseUnit: selection.food.baseUnit,
				nutrients: Object.fromEntries(
					NUTRIENT_KEYS.map((key) => [key, preview.nutrients[key]]),
				) as Pick<ShippedFood["nutrients"], (typeof NUTRIENT_KEYS)[number]>,
				provenance: {
					source: "shipped",
					sourceId: selection.food.id,
					dataset: meta.dataset.name,
					edition: meta.dataset.edition,
					sourceCode: selection.food.code,
					sourceName: selection.food.sourceName,
					saltDerived: true,
				},
			});
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => undefined,
			);
			onLogged();
		} catch {
			toast.error(t.nutrition.foodBrowser.logFailure);
		} finally {
			setLogging(false);
		}
	}

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<Header backLabel={t.common.back} onBack={onBack} />
			<View style={styles.heading}>
				<AppText variant="display">
					{selection.kind === "shipped" ? (selection.food.emoji ?? "🍽️") : "◇"}
				</AppText>
				<AppText variant="title">{food.name[locale]}</AppText>
				<AppText variant="caption">
					{selection.kind === "shipped"
						? selection.food.sourceName[locale]
						: t.nutrition.personalFood.resultLabel}
				</AppText>
			</View>
			<AppText variant="label">{t.nutrition.foodBrowser.serving}</AppText>
			<View style={styles.options}>
				{choices.map((candidate) => (
					<Pressable
						key={candidate.kind === "authored" ? candidate.index : "base"}
						onPress={() => {
							setSelectedServing(candidate);
							setQuantityText(candidate.kind === "base-unit" ? "100" : "1");
						}}
						accessibilityRole="radio"
						accessibilityState={{ checked: selectedServing === candidate }}
						style={[
							styles.option,
							selectedServing === candidate && styles.optionSelected,
						]}
					>
						<AppText>{candidate.label[locale]}</AppText>
					</Pressable>
				))}
			</View>
			<AppText variant="label">{t.nutrition.foodBrowser.quantity}</AppText>
			<TextInput
				value={quantityText}
				onChangeText={setQuantityText}
				accessibilityLabel={t.nutrition.foodBrowser.quantity}
				keyboardType="decimal-pad"
				style={styles.input}
			/>
			<Card style={styles.preview}>
				<AppText variant="heading">{preview.label}</AppText>
				<AppText variant="caption">
					{preview.amount} {preview.baseUnit}
				</AppText>
				{NUTRIENT_KEYS.map((key) => (
					<View key={key} style={styles.nutrientRow}>
						<AppText style={styles.flex}>{t.nutrition.nutrients[key]}</AppText>
						<AppText style={styles.strong}>
							{formatNutrient(
								preview.nutrients[key],
								key,
								t.nutrition.foodBrowser,
							)}
						</AppText>
					</View>
				))}
			</Card>
			{selection.kind === "shipped" ? (
				<View style={styles.attribution}>
					<AppText variant="caption">{NEVO_ATTRIBUTION}</AppText>
					<AppText variant="caption">
						{SALT_DERIVATION_DISCLOSURE[locale]}
					</AppText>
				</View>
			) : (
				<View style={styles.options}>
					<GhostButton
						label={t.nutrition.personalFood.editTitle}
						onPress={onEdit}
					/>
					<GhostButton
						label={t.nutrition.personalFood.delete}
						onPress={onDelete}
					/>
				</View>
			)}
			<PrimaryButton
				label={
					logging
						? t.nutrition.foodBrowser.logging
						: t.nutrition.foodBrowser.log
				}
				onPress={logFood}
				loading={logging}
				disabled={!canLog}
			/>
		</ScrollView>
	);
}

function formatNutrient(
	value: NutrientValue,
	key: (typeof NUTRIENT_KEYS)[number],
	messages: { trace: string; absent: string },
): string {
	if (value.kind === "trace") return messages.trace;
	if (value.kind === "absent") return messages.absent;
	return `${roundForDisplay(key, value.amount)} ${NUTRIENT_UNITS[key]}`;
}

function servingChoices(selection: FoodSelection): ServingOption[] {
	if (selection.kind === "shipped") return servingOptions(selection.food);
	const options: ServingOption[] = selection.food.servings.map(
		(serving, index) => ({
			kind: "authored",
			index,
			label: serving.label,
			amount: serving.amount,
		}),
	);
	options.push({
		kind: "base-unit",
		label:
			selection.food.baseUnit === "g"
				? { en: "Gram (g)", nl: "Gram (g)" }
				: { en: "Millilitre (ml)", nl: "Milliliter (ml)" },
		amount: 1,
		unit: selection.food.baseUnit,
	});
	return options;
}

function scalePersonalValue(
	value: NutrientValue,
	factor: number,
): NutrientValue {
	return value.kind === "value"
		? { kind: "value", amount: value.amount * factor }
		: { kind: value.kind };
}

function servingPreview(
	selection: FoodSelection,
	option: ServingOption,
	quantity: number,
	locale: "en" | "nl",
) {
	if (selection.kind === "shipped") {
		return previewServing(selection.food, option, quantity, locale);
	}
	const amount = option.amount * quantity;
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		nutrients[key] = scalePersonalValue(
			selection.food.nutrients[key],
			amount / 100,
		);
	}
	return {
		amount,
		baseUnit: selection.food.baseUnit,
		label: formatServingSelection(option, quantity, locale),
		nutrients,
	};
}

function Header({
	backLabel,
	onBack,
}: {
	backLabel: string;
	onBack: () => void;
}) {
	return (
		<Pressable
			onPress={onBack}
			accessibilityRole="button"
			accessibilityLabel={backLabel}
			style={styles.back}
		>
			<AppText variant="heading" style={{ color: colors.accent }}>
				‹
			</AppText>
			<AppText>{backLabel}</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: spacing.md },
	flex: { flex: 1 },
	findControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	heading: { gap: spacing.xs },
	strong: { fontWeight: "700" },
	back: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	input: {
		minHeight: 48,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		paddingHorizontal: spacing.md,
		color: colors.text,
		fontSize: 15,
	},
	results: { paddingVertical: spacing.xs },
	foodRow: {
		minHeight: 56,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	pressed: { backgroundColor: colors.surface2 },
	options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	option: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.pill,
	},
	optionSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
	preview: { gap: spacing.sm },
	nutrientRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	attribution: { gap: spacing.xs },
});
