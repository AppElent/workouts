import {
	rankNutrientSources,
	roundForDisplay,
	totalNutrients,
} from "@workouts/core/nutrition";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, View } from "react-native";
import { formatLongDate } from "../../../data/calendar-day";
import {
	MEAL_SLOTS,
	type NutrientKey,
	nutrientUnit,
	useNutritionDay,
} from "../../../data/nutrition-day";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { FoodVisualView } from "../../../ui/food-visual";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { AppText } from "../../../ui/text";
import {
	groupGoals,
	localizedGoalStatus,
	outcome,
	targetLabel,
} from "../day-goals/goal-presentation";
import { NutrientSourceValue } from "./components/nutrient-source-value";
export function NutrientSourcesScreen({
	date,
	nutrient,
}: {
	date: string;
	nutrient: NutrientKey;
}) {
	const state = useNutritionDay(date);
	const { t, locale } = useI18n();
	const colors = useTokens();
	const entries =
		state.status === "ready"
			? MEAL_SLOTS.flatMap((meal) =>
					state.day.entries[meal].map((e) => ({ ...e, meal })),
				)
			: [];
	const sources = rankNutrientSources(entries, nutrient);
	const unit = nutrientUnit(nutrient);
	const rawTotal = totalNutrients(entries.map((e) => e.nutrients))[nutrient];
	const total = {
		...rawTotal,
		qualified:
			rawTotal.qualified ||
			entries.some(
				(e) => e.estimated && e.nutrients[nutrient].kind !== "absent",
			),
	};
	const group =
		state.status === "ready"
			? groupGoals(state.day.goals, [nutrient])[0]
			: undefined;
	const status = group ? outcome(colors, t, group, total) : undefined;
	return (
		<>
			<Stack.Screen
				options={{
					title: t.nutrition.nutrients[nutrient],
					headerTitleStyle: { color: colors.text },
					headerTitle: () => (
						<View style={{ alignItems: "center" }}>
							<AppText variant="navTitle">
								{t.nutrition.nutrients[nutrient]}
							</AppText>
							<AppText variant="caption">
								{formatLongDate(date, locale)}
							</AppText>
						</View>
					),
					headerRight: () => (
						<Pressable
							accessibilityLabel={t.nutrition.goals.edit}
							accessibilityRole="button"
							onPress={() =>
								router.push({
									pathname: "/nutrition-goals",
									params: { date, nutrient },
								})
							}
							style={{
								minWidth: 44,
								minHeight: 44,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<SymbolView
								name="slider.horizontal.3"
								size={20}
								tintColor={colors.text}
							/>
						</Pressable>
					),
					headerLeft: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t.nutrition.entryActions.close}
							onPress={() => router.back()}
							style={{
								minWidth: 44,
								minHeight: 44,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<SymbolView
								name="chevron.left"
								size={18}
								tintColor={colors.text}
							/>
						</Pressable>
					),
				}}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					padding: spacing.md,
					gap: spacing.md,
					paddingBottom: spacing.xxl,
				}}
			>
				{state.status === "loading" ? (
					<AppText>{t.diaryEntry.loading}</AppText>
				) : (
					<>
						<View
							style={{
								backgroundColor: colors.surface,
								borderRadius: 24,
								padding: spacing.md,
								gap: spacing.sm,
							}}
						>
							<AppText
								variant="quantityCompact"
								style={{
									textAlign: "center",
									fontWeight: "800",
									color:
										group?.max !== undefined && total.amount > group.max
											? colors.danger
											: colors.text,
								}}
							>
								{total.incomplete ? "≥ " : total.qualified ? "~ " : ""}
								{new Intl.NumberFormat(locale).format(
									roundForDisplay(nutrient, sources.total),
								)}
								<AppText variant="heading"> {unit}</AppText>
							</AppText>
							{group ? (
								<AppText style={{ textAlign: "center" }}>
									{targetLabel(group, unit)} ·{" "}
									{status ? localizedGoalStatus(status.label, locale) : ""}
								</AppText>
							) : null}
							<View
								style={{
									flexDirection: "row",
									gap: spacing.xs,
									height: 8,
									borderRadius: 4,
									overflow: "hidden",
								}}
							>
								{MEAL_SLOTS.map((meal, i) => {
									const amount = sources.ranked
										.filter((r) => r.entry.meal === meal)
										.reduce((sum, r) => sum + r.amount, 0);
									return (
										<View
											key={meal}
											style={{
												flex: sources.total ? amount / sources.total : 1,
												backgroundColor: [
													colors.accent,
													colors.success,
													colors.warn,
													colors.textMuted,
												][i],
											}}
										/>
									);
								})}
							</View>
							<View
								style={{
									flexDirection: "row",
									flexWrap: "wrap",
									gap: spacing.sm,
								}}
							>
								{MEAL_SLOTS.map((meal, i) => (
									<View
										key={meal}
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 4,
										}}
									>
										<View
											style={{
												width: 6,
												height: 6,
												borderRadius: 3,
												backgroundColor: [
													colors.accent,
													colors.success,
													colors.warn,
													colors.textMuted,
												][i],
											}}
										/>
										<AppText variant="caption">
											{t.nutrition.meals[meal]}{" "}
											{new Intl.NumberFormat(locale).format(
												roundForDisplay(
													nutrient,
													sources.ranked
														.filter((r) => r.entry.meal === meal)
														.reduce((sum, r) => sum + r.amount, 0),
												),
											)}{" "}
											{unit}
										</AppText>
									</View>
								))}
							</View>
						</View>
						{sources.missing.length ? (
							<>
								<AppText variant="heading">
									{locale === "nl" ? "Waarden ontbreken" : "Missing values"}
								</AppText>
								<AppText variant="caption">
									{t.nutrition.goals.incomplete}
								</AppText>
								<InsetList compact>
									{sources.missing.map((entry) => (
										<InsetRow
											key={entry.id}
											title={entry.name[locale]}
											secondary={`${t.nutrition.meals[entry.meal]}${entry.comboGroup ? ` · ${entry.comboGroup.name}` : ""}`}
											leading={
												<FoodVisualView
													visual={entry.visual}
													label={entry.name[locale]}
													size={38}
												/>
											}
											trailing={
												<View
													style={{
														backgroundColor: colors.accentDim,
														borderRadius: 16,
														paddingHorizontal: 10,
														paddingVertical: 7,
													}}
												>
													<AppText
														variant="label"
														style={{ color: colors.accent }}
													>
														{locale === "nl" ? "Aanvullen" : "Fill in"}
													</AppText>
												</View>
											}
											onPress={() =>
												router.push({
													pathname: "/nutrition-entry-correction",
													params: {
														id: entry.id,
														date,
														meal: entry.meal,
														nutrient,
													},
												})
											}
										/>
									))}
								</InsetList>
							</>
						) : null}
						<AppText variant="heading">
							{locale === "nl" ? "Grootste bronnen" : "Largest sources"}
						</AppText>
						{entries.length === 0 ? (
							<AppText>{t.nutrition.mealEmpty}</AppText>
						) : (
							<InsetList compact>
								{sources.ranked.map(({ entry, amount, trace, share }) => (
									<InsetRow
										key={entry.id}
										title={entry.name[locale]}
										secondary={`${t.nutrition.meals[entry.meal]} · ${entry.serving[locale]}${entry.comboGroup ? ` · ${entry.comboGroup.name}` : ""}`}
										trailing={
											<NutrientSourceValue
												label={
													trace
														? t.nutrition.foodBrowser.trace
														: `${entry.estimated ? "~ " : ""}${roundForDisplay(nutrient, amount)} ${unit}`
												}
												share={share}
												relativeShare={
													sources.ranked[0]?.amount
														? amount / sources.ranked[0].amount
														: 0
												}
											/>
										}
										leading={
											<FoodVisualView
												visual={entry.visual}
												label={entry.name[locale]}
												size={36}
											/>
										}
										onPress={() =>
											router.push({
												pathname: "/nutrition-entry",
												params: { id: entry.id, date, meal: entry.meal },
											})
										}
									/>
								))}
							</InsetList>
						)}
						<AppText variant="caption">
							{locale === "nl"
								? "Tik een item om de hoeveelheid aan te passen."
								: "Tap an item to adjust its amount."}
						</AppText>
					</>
				)}
			</ScrollView>
		</>
	);
}
