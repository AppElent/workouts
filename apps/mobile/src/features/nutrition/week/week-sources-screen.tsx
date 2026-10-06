import { type NutrientKey, roundForDisplay } from "@workouts/core/nutrition";
import { router, Stack } from "expo-router";
import {
	ActionSheetIOS,
	Alert,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import type { IsoDate } from "../../../data/calendar-day";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { FoodVisualView } from "../../../ui/food-visual";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { NutrientSourceValue } from "../nutrient-sources/components/nutrient-source-value";
import { WeekBars } from "./components/week-bars";
import { useWeekEntries, type WeekEntry } from "./use-week-entries";
import { useWeekReview } from "./use-week-review";
import {
	weekDayParts,
	weekGoalLabel,
	weekNumber,
	weekUnit,
} from "./week-format";
import { groupWeekSources } from "./week-sources";
import {
	isoWeekNumber,
	weekAverage,
	weekDayStatus,
	weekGoalCount,
	weekTitleKind,
} from "./week-summary";

/** One nutrient over the week: per-day bars, days that don't count, and its biggest sources. */
export function WeekSourcesScreen({
	startDate,
	nutrient,
}: {
	startDate?: string;
	nutrient: NutrientKey;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.week;
	const colors = useTokens();
	const { days, today, week } = useWeekReview(startDate);
	const entries = useWeekEntries(week);
	const unit = weekUnit(nutrient);
	const name = t.nutrition.nutrients[nutrient];
	const openEntry = (entry: WeekEntry) =>
		router.push({
			pathname: "/nutrition-entry",
			params: { id: entry.id, date: entry.date, meal: entry.meal },
		});
	const chooseDay = (options: WeekEntry[]) => {
		const labels = options.map(
			(entry) =>
				`${weekDayParts(entry.date, locale).long} ${weekDayParts(entry.date, locale).dayMonth} · ${t.nutrition.meals[entry.meal]}`,
		);
		if (Platform.OS === "ios") {
			ActionSheetIOS.showActionSheetWithOptions(
				{
					title: copy.chooseDay,
					options: [...labels, t.diaryEntry.cancel],
					cancelButtonIndex: labels.length,
				},
				(index) => {
					if (index < options.length) openEntry(options[index]);
				},
			);
			return;
		}
		Alert.alert(copy.chooseDay, undefined, [
			...options.map((entry, index) => ({
				text: labels[index],
				onPress: () => openEntry(entry),
			})),
			{ text: t.diaryEntry.cancel, style: "cancel" as const },
		]);
	};
	return (
		<>
			<Stack.Screen
				options={{
					headerTitle: () => (
						<View style={{ alignItems: "center" }}>
							<AppText variant="navTitle">{name}</AppText>
							<AppText variant="caption">
								{weekTitleKind(week, today) === "numbered"
									? fmt(copy.title.numbered, { number: isoWeekNumber(week) })
									: copy.title[weekTitleKind(week, today) as "current"]}
							</AppText>
						</View>
					),
				}}
			/>
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					padding: spacing.md,
					gap: spacing.md,
					paddingBottom: spacing.xxl,
				}}
			>
				{days === undefined || entries === undefined ? (
					<SkeletonGroup label={name}>
						<View style={{ gap: spacing.md }}>
							<SkeletonBlock height={240} />
							<SkeletonBlock height={300} />
						</View>
					</SkeletonGroup>
				) : (
					(() => {
						const counted = new Set(
							days
								.filter(
									(day) =>
										day.date < today &&
										day.entryCount > 0 &&
										!day.totals[nutrient].incomplete,
								)
								.map((day) => day.date),
						);
						const sources = groupWeekSources(
							entries.filter((entry) => counted.has(entry.date)),
							nutrient,
						);
						const missing = groupWeekSources(
							entries.filter((entry) => entry.date <= today),
							nutrient,
						).missingByDate;
						const average = weekAverage(days, nutrient, today);
						const count = weekGoalCount(days, nutrient, today);
						const lastGoals =
							[...days]
								.reverse()
								.find(
									(day) => day.date <= today && day.goalBasis === "effective",
								)?.goals ?? [];
						const goal = weekGoalLabel(lastGoals, nutrient, locale, copy);
						const countedDates = [...counted].sort();
						return (
							<>
								<View
									style={{
										backgroundColor: colors.surface,
										borderRadius: radius.contentCard,
										padding: spacing.md,
										gap: spacing.md,
									}}
								>
									<View style={{ alignItems: "center", gap: 2 }}>
										<AppText
											variant="quantityCompact"
											style={{
												fontWeight: "800",
												color:
													count?.kind === "over" ? colors.danger : colors.text,
											}}
										>
											{average ? weekNumber(average.value, locale) : "–"}
											<AppText variant="heading"> {unit}</AppText>
										</AppText>
										<AppText variant="footnote" style={{ textAlign: "center" }}>
											{[
												copy.sourcesAverage,
												goal,
												count
													? fmt(
															count.kind === "over"
																? copy.countOver
																: count.kind === "aboveMinimum"
																	? copy.countAbove
																	: copy.countWithin,
															{ count: count.count, of: count.of },
														)
													: undefined,
											]
												.filter(Boolean)
												.join(" · ")}
										</AppText>
									</View>
									<WeekBars
										today={today}
										onPressDay={(date: IsoDate) =>
											router.push({
												pathname: "/nutrition-nutrient-sources",
												params: { date, nutrient },
											})
										}
										bars={days.map((day) => {
											const part = weekDayParts(day.date, locale);
											const goals =
												day.goalBasis === "effective" ? day.goals : [];
											const status = weekDayStatus(day, nutrient, today);
											return {
												date: day.date,
												label: part.short,
												amount: day.totals[nutrient].amount,
												status,
												minimum: goals.find(
													(item) =>
														item.nutrient === nutrient &&
														item.direction === "min",
												)?.target,
												maximum: goals.find(
													(item) =>
														item.nutrient === nutrient &&
														item.direction === "max",
												)?.target,
												accessibilityLabel: `${part.long}, ${weekNumber(day.totals[nutrient].amount, locale)} ${unit}, ${copy.status[status]}`,
											};
										})}
									/>
								</View>
								{Object.entries(missing)
									.filter(([date]) => date < today)
									.map(([date, missingCount]) => {
										const part = weekDayParts(date, locale);
										return (
											<View
												key={date}
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: spacing.md,
													padding: spacing.md,
													borderRadius: radius.contentCard,
													borderWidth: 1,
													borderStyle: "dashed",
													borderColor: colors.borderStrong,
												}}
											>
												<View style={{ alignItems: "center", width: 34 }}>
													<AppText
														variant="caption"
														style={{ fontWeight: "700" }}
													>
														{part.short}
													</AppText>
													<AppText variant="heading">{part.day}</AppText>
												</View>
												<View style={{ flex: 1 }}>
													<AppText
														variant="secondary"
														style={{ color: colors.text }}
													>
														{copy.notCounting}
													</AppText>
													<AppText variant="caption">
														{missingCount === 1
															? copy.missingValuesOne
															: fmt(copy.missingValues, {
																	count: missingCount,
																})}
													</AppText>
												</View>
												<Pressable
													accessibilityRole="button"
													accessibilityLabel={`${copy.complete}, ${part.long}`}
													onPress={() =>
														router.push({
															pathname: "/nutrition-nutrient-sources",
															params: { date, nutrient },
														})
													}
													style={{
														minHeight: 36,
														paddingHorizontal: 12,
														borderRadius: radius.pill,
														backgroundColor: colors.surface2,
														justifyContent: "center",
													}}
												>
													<AppText
														variant="footnote"
														style={{ fontWeight: "700", color: colors.text }}
													>
														{copy.complete}
													</AppText>
												</Pressable>
											</View>
										);
									})}
								<View style={{ flexDirection: "row", alignItems: "baseline" }}>
									<AppText
										variant="heading"
										accessibilityRole="header"
										style={{ flex: 1 }}
									>
										{copy.biggest}
									</AppText>
									<AppText variant="caption">
										{countedDates.length
											? `${weekDayParts(countedDates[0], locale).short.toLowerCase()}–${weekDayParts(countedDates[countedDates.length - 1], locale).short.toLowerCase()}, `
											: ""}
										{copy.highestFirst}
									</AppText>
								</View>
								{sources.ranked.length === 0 ? (
									<AppText variant="secondary">{copy.noSources}</AppText>
								) : (
									<InsetList compact>
										{sources.ranked.map((source) => {
											const first = source.entries[0];
											const dates = [
												...new Set(source.entries.map((entry) => entry.date)),
											];
											const where =
												dates.length > 3
													? fmt(copy.dayCount, { count: dates.length })
													: dates
															.map((date) =>
																weekDayParts(date, locale).short.toLowerCase(),
															)
															.join(", ");
											return (
												<InsetRow
													key={source.key}
													id={source.key}
													title={source.name[locale]}
													secondary={where}
													leading={
														<FoodVisualView
															visual={first.visual}
															label={source.name[locale]}
															size={36}
														/>
													}
													trailing={
														<NutrientSourceValue
															label={`${roundForDisplay(nutrient, source.amount)} ${unit}`}
															share={source.share}
															relativeShare={
																sources.ranked[0]?.amount
																	? source.amount / sources.ranked[0].amount
																	: 0
															}
														/>
													}
													onPress={() =>
														source.entries.length === 1
															? openEntry(first)
															: chooseDay(source.entries)
													}
												/>
											);
										})}
									</InsetList>
								)}
								<AppText variant="caption">{copy.sourcesFooter}</AppText>
							</>
						);
					})()
				)}
			</ScrollView>
		</>
	);
}
