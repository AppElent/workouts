import { NUTRIENT_KEYS, totalNutrients } from "@workouts/core/nutrition";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, View } from "react-native";
import {
	MEAL_SLOTS,
	nutrientUnit,
	useNutritionDay,
} from "../../../data/nutrition-day";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import { NutritionGoalCard } from "./components/nutrition-goal-card";
import { displayAmount } from "./goal-presentation";
export function DayGoalsScreen({ date }: { date: string }) {
	const { t, locale } = useI18n();
	const state = useNutritionDay(date);
	const colors = useTokens();
	const entries =
		state.status === "ready"
			? MEAL_SLOTS.flatMap((m) => state.day.entries[m])
			: [];
	const totals = {
		...totalNutrients(entries.map((e) => e.nutrients)),
		...(state.status === "ready" ? state.day.totals : {}),
	};
	for (const n of NUTRIENT_KEYS)
		if (entries.some((e) => e.estimated && e.nutrients[n].kind !== "absent"))
			totals[n] = { ...totals[n], qualified: true };
	const withoutGoals = NUTRIENT_KEYS.filter(
		(n) =>
			state.status === "ready" &&
			!state.day.goals.some((g) => g.nutrient === n),
	);
	return (
		<>
			<Stack.Screen
				options={{
					title: locale === "nl" ? "Dagdoelen" : "Daily goals",
					headerTitleStyle: { color: colors.text },
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
							<SymbolView name="xmark" size={18} tintColor={colors.text} />
						</Pressable>
					),
					headerRight: () => (
						<Pressable
							accessibilityRole="button"
							onPress={() =>
								router.push({ pathname: "/nutrition-goals", params: { date } })
							}
							style={{
								minWidth: 44,
								minHeight: 44,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<AppText style={{ color: colors.accent }}>
								{locale === "nl" ? "Bewerk" : "Edit"}
							</AppText>
						</Pressable>
					),
				}}
			/>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
			>
				{state.status === "loading" ? (
					<AppText>{t.diaryEntry.loading}</AppText>
				) : (
					<>
						<NutritionGoalCard
							t={t}
							goals={state.day.goals}
							totals={totals}
							displayOrder={state.day.displayOrder}
							showAll
							onEdit={(nutrient) =>
								router.push({
									pathname: "/nutrition-goals",
									params: { date, ...(nutrient ? { nutrient } : {}) },
								})
							}
							onSources={(nutrient) =>
								router.push({
									pathname: "/nutrition-nutrient-sources",
									params: { date, nutrient },
								})
							}
						/>
						{withoutGoals.length ? (
							<>
								<AppText variant="label">
									{locale === "nl" ? "Zonder doel" : "Without a goal"}
								</AppText>
								<View
									style={{ backgroundColor: colors.surface, borderRadius: 24 }}
								>
									{withoutGoals.map((n) => (
										<Pressable
											key={n}
											accessibilityRole="button"
											onPress={() =>
												router.push({
													pathname: "/nutrition-nutrient-sources",
													params: { date, nutrient: n },
												})
											}
											style={{
												padding: spacing.md,
												minHeight: 48,
												flexDirection: "row",
												justifyContent: "space-between",
											}}
										>
											<AppText>{t.nutrition.nutrients[n]}</AppText>
											<AppText>
												{displayAmount(n, totals[n])} {nutrientUnit(n)} ›
											</AppText>
										</Pressable>
									))}
								</View>
							</>
						) : null}
						<AppText variant="caption">
							{locale === "nl"
								? "≥ = ten minste: niet alle items hebben een waarde. ~ = bevat geschatte waarden."
								: "≥ = at least: some items have no value. ~ = includes estimated values."}
						</AppText>
					</>
				)}
			</ScrollView>
		</>
	);
}
