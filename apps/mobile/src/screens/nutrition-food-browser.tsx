import {
	allShippedFoods,
	NEVO_ATTRIBUTION,
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	previewServing,
	roundForDisplay,
	SALT_DERIVATION_DISCLOSURE,
	type ServingOption,
	type ShippedFood,
	searchShippedFoods,
	servingOptions,
} from "@workouts/core/nutrition";
import { useMemo, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { formatLongDate } from "../data/calendar-day";
import type { MealSlot } from "../data/nutrition-day";
import { fmt, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";

const RESULT_PAGE_SIZE = 50;

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
	const [query, setQuery] = useState("");
	const [searchAll, setSearchAll] = useState(false);
	const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
	const [selectedFood, setSelectedFood] = useState<ShippedFood>();
	const allResults = useMemo(() => {
		if (searchAll && query.trim().length === 0) {
			return allShippedFoods()
				.filter((candidate) => !candidate.retired)
				.sort((a, b) =>
					a.sourceName[locale].localeCompare(b.sourceName[locale]),
				)
				.map((candidate) => ({ food: candidate }));
		}
		return searchShippedFoods(query, {
			locale,
			scope: searchAll ? "all" : "promoted",
			limit: searchAll ? 2328 : RESULT_PAGE_SIZE,
		});
	}, [locale, query, searchAll]);
	const results = allResults.slice(0, visibleCount);

	if (selectedFood) {
		return (
			<ServingDetail
				food={selectedFood}
				onBack={() => setSelectedFood(undefined)}
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
				style={styles.input}
				autoCorrect={false}
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
					{results.map(({ food: result }) => (
						<Pressable
							key={result.id}
							onPress={() => setSelectedFood(result)}
							accessibilityRole="button"
							style={({ pressed }) => [
								styles.foodRow,
								pressed && styles.pressed,
							]}
						>
							<AppText variant="heading">{result.emoji ?? "•"}</AppText>
							<View style={styles.flex}>
								<AppText style={styles.strong}>
									{(searchAll ? result.sourceName : result.name)[locale]}
								</AppText>
								<AppText variant="caption">
									{t.nutrition.foodBrowser.per100} {result.baseUnit}
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
	food,
	onBack,
}: {
	food: ShippedFood;
	onBack: () => void;
}) {
	const { t, locale } = useI18n();
	const choices = useMemo(() => servingOptions(food), [food]);
	const [selectedServing, setSelectedServing] = useState<ServingOption>(
		choices[0],
	);
	const [quantityText, setQuantityText] = useState("1");
	const parsed = Number(quantityText.replace(",", "."));
	const quantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
	const preview = previewServing(food, selectedServing, quantity, locale);

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<Header backLabel={t.common.back} onBack={onBack} />
			<View style={styles.heading}>
				<AppText variant="display">{food.emoji ?? "🍽️"}</AppText>
				<AppText variant="title">{food.name[locale]}</AppText>
				<AppText variant="caption">{food.sourceName[locale]}</AppText>
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
			<View style={styles.attribution}>
				<AppText variant="caption">{NEVO_ATTRIBUTION}</AppText>
				<AppText variant="caption">
					{SALT_DERIVATION_DISCLOSURE[locale]}
				</AppText>
			</View>
		</ScrollView>
	);
}

function formatNutrient(
	value: ShippedFood["nutrients"][keyof ShippedFood["nutrients"]],
	key: (typeof NUTRIENT_KEYS)[number],
	messages: { trace: string; absent: string },
): string {
	if (value.kind === "trace") return messages.trace;
	if (value.kind === "absent") return messages.absent;
	return `${roundForDisplay(key, value.amount)} ${NUTRIENT_UNITS[key]}`;
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
