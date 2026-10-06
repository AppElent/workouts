import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import type { IsoDate } from "../../../data/calendar-day";
import { useNutritionDrafts } from "../../../data/nutrition-drafts";
import { weekEndDate } from "../../../data/nutrition-weekly-review";
import { fmt, useI18n } from "../../../i18n";
import { getNutritionAssistanceMessages } from "../../../i18n/messages/nutrition-assistance";
import { radius, spacing, useTokens } from "../../../theme";
import { EmptyState } from "../../../ui/empty-state";
import { GlassSurface } from "../../../ui/glass-surface";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import { SkeletonBlock, SkeletonGroup } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { WeekBars } from "./components/week-bars";
import { WeekDatePicker } from "./components/week-date-picker";
import { WeekMenu } from "./components/week-menu";
import { WeekStatusGrid } from "./components/week-status-grid";
import { WeekStatusMark } from "./components/week-status-mark";
import { WeekStrip } from "./components/week-strip";
import { useWeekReview } from "./use-week-review";
import {
	weekDayParts,
	weekGoalLabel,
	weekNumber,
	weekUnit,
} from "./week-format";
import {
	isoWeekNumber,
	WEEK_NUTRIENTS,
	weekAverage,
	weekDayStatus,
	weekGoalChanges,
	weekStripWeeks,
	weekTitleKind,
	worstGoal,
} from "./week-summary";

export function WeekScreen({ startDate }: { startDate?: string }) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.week;
	const offlineCopy = getNutritionAssistanceMessages(locale);
	const colors = useTokens();
	const drafts = useNutritionDrafts();
	const review = useWeekReview(startDate);
	const { today, week, days } = review;
	const number = isoWeekNumber(week);
	const titleKind = weekTitleKind(week, today);
	const title =
		titleKind === "numbered"
			? fmt(copy.title.numbered, { number })
			: copy.title[titleKind];
	const range = fmt(copy.range, {
		from: weekDayParts(week, locale).dayMonth,
		to: weekDayParts(weekEndDate(week), locale).dayMonth,
		number,
	});
	const openDay = (date: IsoDate) =>
		router.dismissTo({ pathname: "/nutrition", params: { date } });
	const picker = (
		<WeekDatePicker
			weekStart={week}
			today={today}
			locale={locale}
			label={copy.chooseWeek}
			hint={copy.calendarHint}
			todayLabel={copy.thisWeek}
			onSelect={review.setWeek}
		/>
	);
	const menu = (
		<WeekMenu
			label={copy.more}
			openTodayLabel={copy.openToday}
			goalsLabel={copy.goals}
			onOpenToday={() => openDay(today)}
			onOpenGoals={() =>
				router.push({ pathname: "/nutrition-goals", params: { date: today } })
			}
		/>
	);

	return (
		<>
			<Stack.Screen
				options={{
					title,
					headerLargeTitleEnabled: true,
					headerLargeTitleStyle: { color: colors.text },
					headerTitleStyle: { color: colors.text },
					headerRight: () =>
						Platform.OS === "ios" ? null : (
							<View style={{ flexDirection: "row", alignItems: "center" }}>
								{picker}
								{menu}
							</View>
						),
				}}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.View hidesSharedBackground>
						<GlassSurface capsule>{picker}</GlassSurface>
					</Stack.Toolbar.View>
					<Stack.Toolbar.Spacer width={8} />
					<Stack.Toolbar.View hidesSharedBackground>
						<GlassSurface capsule>{menu}</GlassSurface>
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingHorizontal: spacing.md,
					paddingBottom: spacing.xxl,
					gap: spacing.md,
				}}
			>
				<AppText variant="footnote" style={{ marginTop: -spacing.sm }}>
					{range}
				</AppText>
				<WeekStrip
					weeks={weekStripWeeks(week, today)}
					selected={week}
					onSelect={review.setWeek}
					trailing={picker}
				/>
				{days === undefined ? (
					review.stalledOffline ? (
						<Card>
							<EmptyState
								title={offlineCopy.offlineTitle}
								body={offlineCopy.offlineBody}
								action={{ label: offlineCopy.retry, onPress: review.retry }}
							/>
						</Card>
					) : (
						<SkeletonGroup label={offlineCopy.loading}>
							<View style={{ gap: spacing.md }}>
								<SkeletonBlock height={220} />
								<SkeletonBlock height={24} style={{ width: 90 }} />
								<SkeletonBlock height={320} />
							</View>
						</SkeletonGroup>
					)
				) : days.every((day) => day.entryCount === 0) ? (
					<Card>
						<EmptyState
							title={copy.emptyTitle}
							body={copy.emptyBody}
							action={{ label: copy.emptyAction, onPress: () => openDay(week) }}
						/>
					</Card>
				) : (
					<WeekContent
						days={days}
						today={today}
						week={week}
						pending={review.pending}
						noteCount={(date) => drafts.listForDate(date).length}
						onOpenDay={openDay}
					/>
				)}
			</ScrollView>
		</>
	);
}

function WeekContent({
	days,
	today,
	week,
	pending,
	noteCount,
	onOpenDay,
}: {
	days: NonNullable<ReturnType<typeof useWeekReview>["days"]>;
	today: IsoDate;
	week: IsoDate;
	pending: boolean;
	noteCount: (date: IsoDate) => number;
	onOpenDay: (date: IsoDate) => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.week;
	const colors = useTokens();
	const hasGoals = days.some(
		(day) => day.goalBasis === "effective" && day.goals.length,
	);
	const lastGoals =
		[...days]
			.reverse()
			.find((day) => day.date <= today && day.goalBasis === "effective")
			?.goals ?? [];
	const energyAverage = weekAverage(days, "energy", today);
	const worst = worstGoal(days, today);
	const changes = weekGoalChanges(days);
	const parts = days.map((day) => weekDayParts(day.date, locale));
	const statusText = (nutrient: (typeof WEEK_NUTRIENTS)[number]) =>
		days
			.map(
				(day, index) =>
					`${parts[index].long} ${copy.status[weekDayStatus(day, nutrient, today)]}`,
			)
			.join(", ");
	const averageText = (nutrient: (typeof WEEK_NUTRIENTS)[number]) => {
		const average = weekAverage(days, nutrient, today);
		return average
			? `${copy.averageLabel} ${weekNumber(average.value, locale)} ${weekUnit(nutrient)}`
			: undefined;
	};
	return (
		<>
			{pending ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
						padding: spacing.md,
						borderRadius: radius.contentCard,
						backgroundColor: colors.surface2,
					}}
				>
					<SymbolView
						name={{ ios: "icloud", android: "cloud", web: "cloud" }}
						size={16}
						tintColor={colors.textMuted}
					/>
					<View style={{ flex: 1 }}>
						<AppText variant="footnote" style={{ color: colors.text }}>
							{copy.pending}
						</AppText>
						<AppText variant="caption">{copy.pendingBody}</AppText>
					</View>
				</View>
			) : null}
			<Card>
				<View style={{ padding: spacing.md, gap: spacing.md }}>
					<View style={{ flexDirection: "row", alignItems: "baseline" }}>
						<AppText variant="caption" style={{ flex: 1 }}>
							{copy.energyPerDay}
							{weekGoalLabel(lastGoals, "energy", locale, copy, false)
								? ` · ${weekGoalLabel(lastGoals, "energy", locale, copy, false)}`
								: ""}
						</AppText>
						{energyAverage ? (
							<AppText variant="secondary" style={{ color: colors.text }}>
								<AppText style={{ fontWeight: "800" }}>
									{fmt(copy.average, {
										value: weekNumber(energyAverage.value, locale),
									})}
								</AppText>{" "}
								<AppText variant="caption">kcal</AppText>
							</AppText>
						) : null}
					</View>
					<WeekBars
						today={today}
						onPressDay={(date) =>
							router.push({
								pathname: "/nutrition-nutrient-sources",
								params: { date, nutrient: "energy" },
							})
						}
						bars={days.map((day, index) => {
							const goals = day.goalBasis === "effective" ? day.goals : [];
							const status = weekDayStatus(day, "energy", today);
							return {
								date: day.date,
								label: parts[index].short,
								amount: day.totals.energy.amount,
								status,
								minimum: goals.find(
									(goal) =>
										goal.nutrient === "energy" && goal.direction === "min",
								)?.target,
								maximum: goals.find(
									(goal) =>
										goal.nutrient === "energy" && goal.direction === "max",
								)?.target,
								accessibilityLabel: `${parts[index].long}, ${weekNumber(day.totals.energy.amount, locale)} kcal, ${copy.status[status]}`,
							};
						})}
					/>
					{changes.map((change) => (
						<View
							key={change.date}
							style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
						>
							<SymbolView
								name={{ ios: "target", android: "adjust", web: "adjust" }}
								size={12}
								tintColor={colors.textMuted}
							/>
							<AppText variant="caption" style={{ flex: 1 }}>
								{fmt(
									change.kind === "started" ? copy.goalsFrom : copy.goalChanged,
									{
										date: `${weekDayParts(change.date, locale).long} ${weekDayParts(change.date, locale).dayMonth}`,
									},
								)}
							</AppText>
						</View>
					))}
				</View>
				<Separator />
				{hasGoals ? (
					<>
						<View style={{ padding: spacing.md }}>
							<WeekStatusGrid
								weekdayInitials={parts.map((part) => part.short.slice(0, 1))}
								rows={(["protein", "carbs", "fat"] as const).map(
									(nutrient) => ({
										key: nutrient,
										label: t.nutrition.nutrients[nutrient],
										average: averageText(nutrient),
										statuses: days.map((day) =>
											weekDayStatus(day, nutrient, today),
										),
										accessibilityLabel: `${t.nutrition.nutrients[nutrient]}, ${averageText(nutrient) ?? copy.noAverage}. ${statusText(nutrient)}`,
									}),
								)}
							/>
						</View>
						<Separator />
						<Pressable
							accessibilityRole="button"
							onPress={() =>
								router.push({
									pathname: "/nutrition-week-goals",
									params: { startDate: week },
								})
							}
							style={({ pressed }) => ({
								minHeight: 50,
								paddingHorizontal: spacing.md,
								flexDirection: "row",
								alignItems: "center",
								gap: spacing.sm,
								backgroundColor: pressed ? colors.surface2 : undefined,
							})}
						>
							<AppText
								variant="secondary"
								style={{ flex: 1, color: colors.text }}
							>
								{copy.allGoals}
							</AppText>
							{worst ? (
								<View
									style={{
										paddingHorizontal: 8,
										paddingVertical: 2,
										borderRadius: radius.pill,
										backgroundColor:
											worst.kind === "over"
												? colors.dangerSoft
												: colors.warnSoft,
									}}
								>
									<AppText
										variant="caption"
										style={{
											fontWeight: "700",
											color:
												worst.kind === "over" ? colors.danger : colors.warn,
										}}
									>
										{fmt(
											worst.kind === "over" ? copy.badgeOver : copy.badgeBelow,
											{
												nutrient: t.nutrition.nutrients[worst.nutrient],
												count: worst.count,
											},
										)}
									</AppText>
								</View>
							) : null}
							<SymbolView
								name={{
									ios: "chevron.right",
									android: "chevron_right",
									web: "chevron_right",
								}}
								size={13}
								weight="semibold"
								tintColor={colors.textMuted}
							/>
						</Pressable>
					</>
				) : (
					<AppText variant="caption" style={{ padding: spacing.md }}>
						{fmt(copy.averages, {
							values: (["protein", "carbs", "fat"] as const)
								.map((nutrient) => {
									const average = weekAverage(days, nutrient, today);
									return average
										? `${t.nutrition.nutrients[nutrient].toLowerCase()} ${weekNumber(average.value, locale)} g`
										: undefined;
								})
								.filter(Boolean)
								.join(" · "),
						})}
					</AppText>
				)}
			</Card>
			{hasGoals ? null : (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
						padding: spacing.md,
						borderRadius: radius.contentCard,
						borderWidth: 1,
						borderStyle: "dashed",
						borderColor: colors.borderStrong,
					}}
				>
					<SymbolView
						name={{ ios: "target", android: "adjust", web: "adjust" }}
						size={18}
						tintColor={colors.text}
					/>
					<View style={{ flex: 1 }}>
						<AppText variant="secondary" style={{ color: colors.text }}>
							{copy.noGoalsTitle}
						</AppText>
						<AppText variant="caption">{copy.noGoalsBody}</AppText>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={() =>
							router.push({
								pathname: "/nutrition-goals",
								params: { date: today },
							})
						}
						style={{
							minHeight: 40,
							paddingHorizontal: spacing.md,
							borderRadius: radius.pill,
							backgroundColor: colors.accentFill,
							justifyContent: "center",
						}}
					>
						<AppText
							variant="footnote"
							style={{ color: colors.onAccent, fontWeight: "700" }}
						>
							{copy.noGoalsAction}
						</AppText>
					</Pressable>
				</View>
			)}
			<View
				style={{
					flexDirection: "row",
					alignItems: "baseline",
					marginTop: spacing.xs,
				}}
			>
				<AppText
					variant="heading"
					accessibilityRole="header"
					style={{ flex: 1 }}
				>
					{copy.days}
				</AppText>
				<AppText variant="caption">{copy.columns}</AppText>
			</View>
			<InsetList compact>
				{days
					.filter((day) => day.date <= today)
					.map((day) => {
						const part = weekDayParts(day.date, locale);
						const notes = noteCount(day.date);
						const items =
							day.entryCount === 1
								? copy.itemsOne
								: fmt(copy.items, { count: day.entryCount });
						const noteLabel =
							notes === 0
								? ""
								: ` · ${notes === 1 ? t.nutrition.drafts.countOne : fmt(t.nutrition.drafts.countMany, { count: notes })}`;
						const statuses = WEEK_NUTRIENTS.map((nutrient) =>
							weekDayStatus(day, nutrient, today),
						);
						const name =
							day.date === today ? copy.today : capitalize(part.long);
						return (
							<InsetRow
								key={day.date}
								id={day.date}
								leading={
									<View style={{ width: 34, alignItems: "center" }}>
										<AppText variant="caption" style={{ fontWeight: "700" }}>
											{part.short}
										</AppText>
										<AppText variant="heading">{part.day}</AppText>
									</View>
								}
								title={name}
								secondary={`${items}${noteLabel}`}
								trailing={
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 10,
										}}
									>
										{hasGoals ? (
											<View style={{ flexDirection: "row", gap: 3 }}>
												{statuses.map((status, index) => (
													<WeekStatusMark
														// biome-ignore lint/suspicious/noArrayIndexKey: fixed nutrient columns.
														key={index}
														status={status}
														size={9}
														round
													/>
												))}
											</View>
										) : null}
										<AppText variant="secondary" style={{ color: colors.text }}>
											<AppText style={{ fontWeight: "700" }}>
												{weekNumber(day.totals.energy.amount, locale)}
											</AppText>{" "}
											<AppText variant="caption">kcal</AppText>
										</AppText>
									</View>
								}
								chevron
								accessibilityLabel={`${name} ${part.dayMonth}, ${items}${noteLabel}, ${weekNumber(day.totals.energy.amount, locale)} kcal. ${WEEK_NUTRIENTS.map((nutrient, index) => `${t.nutrition.nutrients[nutrient]} ${copy.status[statuses[index]]}`).join(", ")}`}
								onPress={() => onOpenDay(day.date)}
								actions={[
									{
										key: "open",
										label: copy.openInDiary,
										systemImage: "fork.knife",
										swipe: false,
										onPress: () => onOpenDay(day.date),
									},
									{
										key: "goals",
										label: copy.dayGoals,
										systemImage: "target",
										swipe: false,
										onPress: () =>
											router.push({
												pathname: "/nutrition-day-goals",
												params: { date: day.date },
											}),
									},
								]}
							/>
						);
					})}
			</InsetList>
		</>
	);
}

function capitalize(text: string) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function Card({ children }: { children: ReactNode }) {
	const colors = useTokens();
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderRadius: radius.contentCard,
				borderCurve: "continuous",
				overflow: "hidden",
			}}
		>
			{children}
		</View>
	);
}

function Separator() {
	const colors = useTokens();
	return (
		<View
			style={{
				height: 0.5,
				marginHorizontal: spacing.md,
				backgroundColor: colors.separator,
			}}
		/>
	);
}
