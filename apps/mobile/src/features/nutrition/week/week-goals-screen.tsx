import { NUTRIENT_KEYS } from "@workouts/core/nutrition";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, View } from "react-native";
import { weekEndDate } from "../../../data/nutrition-weekly-review";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { WeekStatusMark } from "./components/week-status-mark";
import { useWeekReview } from "./use-week-review";
import {
	weekDayParts,
	weekGoalLabel,
	weekNumber,
	weekUnit,
} from "./week-format";
import { weekAverage, weekDayStatus, weekGoalCount } from "./week-summary";

/** Every goal over the week: its average and how many days stayed within it. */
export function WeekGoalsScreen({ startDate }: { startDate?: string }) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.week;
	const colors = useTokens();
	const { days, today, week } = useWeekReview(startDate);
	const range = `${weekDayParts(week, locale).dayMonth} – ${weekDayParts(weekEndDate(week), locale).dayMonth}`;
	const nutrients = NUTRIENT_KEYS.filter((nutrient) =>
		days?.some(
			(day) =>
				day.goalBasis === "effective" &&
				day.goals.some((goal) => goal.nutrient === nutrient),
		),
	);
	const lastGoals =
		days &&
		([...days]
			.reverse()
			.find((day) => day.date <= today && day.goalBasis === "effective")
			?.goals ??
			[]);
	return (
		<>
			<Stack.Screen
				options={{
					headerTitle: () => (
						<View style={{ alignItems: "center" }}>
							<AppText variant="navTitle">{copy.goalsTitle}</AppText>
							<AppText variant="caption">{range}</AppText>
						</View>
					),
					headerRight: () => (
						<Pressable
							accessibilityRole="button"
							onPress={() =>
								router.push({
									pathname: "/nutrition-goals",
									params: { date: today },
								})
							}
							style={{
								minHeight: 44,
								paddingHorizontal: spacing.sm,
								justifyContent: "center",
							}}
						>
							<AppText style={{ color: colors.accent, fontWeight: "700" }}>
								{copy.edit}
							</AppText>
						</Pressable>
					),
				}}
			/>
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					padding: spacing.md,
					gap: spacing.sm,
					paddingBottom: spacing.xxl,
				}}
			>
				{days === undefined || lastGoals === undefined ? (
					<SkeletonGroup label={copy.goalsTitle}>
						<SkeletonBlock height={360} />
					</SkeletonGroup>
				) : (
					<View
						style={{
							backgroundColor: colors.surface,
							borderRadius: radius.contentCard,
							overflow: "hidden",
						}}
					>
						{nutrients.map((nutrient, index) => {
							const average = weekAverage(days, nutrient, today);
							const count = weekGoalCount(days, nutrient, today);
							const countText = count
								? `${fmt(
										count.kind === "over"
											? copy.countOver
											: count.kind === "aboveMinimum"
												? copy.countAbove
												: copy.countWithin,
										{ count: count.count, of: count.of },
									)}${count.incomplete ? fmt(copy.incompleteSuffix, { count: count.incomplete }) : ""}`
								: undefined;
							const tone =
								count?.kind === "over"
									? colors.danger
									: count && count.count < count.of
										? colors.warn
										: colors.accent;
							const name = t.nutrition.nutrients[nutrient];
							const goal = weekGoalLabel(lastGoals, nutrient, locale, copy);
							return (
								<Pressable
									key={nutrient}
									accessibilityRole="button"
									accessibilityLabel={`${name}, ${goal ?? ""}, ${average ? `${weekNumber(average.value, locale)} ${weekUnit(nutrient)} ${copy.averageLabel}` : copy.noAverage}. ${countText ?? ""}`}
									onPress={() =>
										router.push({
											pathname: "/nutrition-week-sources",
											params: { startDate: week, nutrient },
										})
									}
									style={({ pressed }) => ({
										padding: spacing.md,
										gap: 6,
										borderTopWidth: index ? 0.5 : 0,
										borderTopColor: colors.separator,
										backgroundColor: pressed ? colors.surface2 : undefined,
									})}
								>
									<View
										style={{
											flexDirection: "row",
											alignItems: "baseline",
											gap: 6,
										}}
									>
										<AppText variant="secondary" style={{ color: colors.text }}>
											{name}
										</AppText>
										<AppText variant="caption" style={{ flex: 1 }}>
											{goal}
										</AppText>
										<AppText
											variant="secondary"
											style={{
												color:
													count?.kind === "over" ? colors.danger : colors.text,
											}}
										>
											<AppText
												style={{
													fontWeight: "800",
													color:
														count?.kind === "over"
															? colors.danger
															: colors.text,
												}}
											>
												{average ? weekNumber(average.value, locale) : "–"}
											</AppText>
											<AppText variant="caption">
												{" "}
												{weekUnit(nutrient)} {copy.averageLabel}
											</AppText>
										</AppText>
										<SymbolView
											name={{
												ios: "chevron.right",
												android: "chevron_right",
												web: "chevron_right",
											}}
											size={12}
											weight="semibold"
											tintColor={colors.textMuted}
										/>
									</View>
									<View style={{ flexDirection: "row", gap: 5 }}>
										{days.map((day) => (
											<WeekStatusMark
												key={day.date}
												status={weekDayStatus(day, nutrient, today)}
											/>
										))}
									</View>
									{countText ? (
										<AppText variant="caption" style={{ color: tone }}>
											{countText}
										</AppText>
									) : null}
								</Pressable>
							);
						})}
					</View>
				)}
				<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
					{copy.goalsFooter}
				</AppText>
			</ScrollView>
		</>
	);
}
