import type { NutrientTotal } from "@workouts/core/nutrition";
import { useConvexConnectionState, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import {
	type DimensionValue,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { api } from "../convex/api";
import {
	formatLongDate,
	type IsoDate,
	shiftIsoDate,
	todayIsoDate,
} from "../data/calendar-day";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../data/nutrition-operation-service";
import {
	canGoToNextWeek,
	evaluateNutrientGoal,
	isRealIsoDate,
	type WeeklyGoal,
	type WeeklyGoalStatus,
	type WeeklyReviewDay,
	weekDates,
	weekEndDate,
	weekStartMonday,
} from "../data/nutrition-weekly-review";
import { useStalledOffline } from "../data/stalled-offline";
import { useI18n } from "../i18n";
import {
	type AssistanceMessages,
	getNutritionAssistanceMessages,
} from "../i18n/messages/nutrition-assistance";
import { colors, radius, spacing } from "../theme";
import { GhostButton } from "../ui/button";
import { Card } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";

const FEATURED_NUTRIENTS = ["energy", "protein", "carbs", "fat"] as const;

export function NutritionWeeklyReviewScreen({
	startDate,
	today: todayProp,
	onSelectDay,
}: {
	startDate?: string;
	today?: IsoDate;
	onSelectDay: (date: IsoDate) => void;
}) {
	const { locale } = useI18n();
	const messages = getNutritionAssistanceMessages(locale);
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const today = todayProp ?? todayIsoDate();
	const currentWeek = weekStartMonday(today);
	const requestedWeek = isDate(startDate)
		? weekStartMonday(startDate)
		: currentWeek;
	const [week, setWeek] = useState<IsoDate>(
		requestedWeek > currentWeek ? currentWeek : requestedWeek,
	);
	const [retrying, setRetrying] = useState(false);
	const result = useQuery(
		api.nutritionReview.week,
		retrying ? "skip" : { startDate: week, today },
	);
	const subject = operations.getSubject();
	const hasPendingDeviceOperations = subject
		? operations
				.getOperations(subject)
				.some((operation) => operation.status !== "acknowledged")
		: false;
	const { isWebSocketConnected } = useConvexConnectionState();
	const stalledOffline = useStalledOffline(
		result === undefined,
		isWebSocketConnected,
	);
	const range = useMemo(
		() =>
			`${formatLongDate(week, locale)} – ${formatLongDate(weekEndDate(week), locale)}`,
		[locale, week],
	);

	return (
		<ScrollView
			style={styles.root}
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<AppText variant="title">{messages.weeklyTitle}</AppText>
			<AppText variant="caption">{range}</AppText>
			<View style={styles.nav}>
				<GhostButton
					label={messages.previousWeek}
					accessibilityRole="button"
					accessibilityLabel={messages.previousWeek}
					onPress={() => setWeek((date) => shiftIsoDate(date, -7))}
					style={styles.navButton}
				/>
				<GhostButton
					label={messages.nextWeek}
					accessibilityRole="button"
					accessibilityLabel={messages.nextWeek}
					disabled={!canGoToNextWeek(week, today)}
					onPress={() => setWeek((date) => shiftIsoDate(date, 7))}
					style={styles.navButton}
				/>
			</View>
			{stalledOffline ? (
				<Card style={styles.summary}>
					<EmptyState
						title={messages.offlineTitle}
						body={messages.offlineBody}
						action={{
							label: messages.retry,
							onPress: () => {
								setRetrying(true);
								setTimeout(() => setRetrying(false), 0);
							},
						}}
					/>
				</Card>
			) : result === undefined ? (
				<WeeklySkeleton label={messages.loading} week={week} today={today} />
			) : (
				<>
					{hasPendingDeviceOperations ? (
						<Card style={styles.summary}>
							<AppText variant="caption">{messages.pendingNotice}</AppText>
						</Card>
					) : null}
					<WeeklyAverages review={result} locale={locale} messages={messages} />
					{result.days.map((day) => (
						<ReviewDayCard
							key={day.date}
							day={day}
							today={today}
							locale={locale}
							messages={messages}
							onPress={() => onSelectDay(day.date)}
						/>
					))}
					<AppText variant="caption">{messages.factualOnly}</AppText>
				</>
			)}
		</ScrollView>
	);
}

function WeeklyAverages({
	review,
	locale,
	messages,
}: {
	review: {
		averages: {
			energy?: number;
			protein?: number;
			energyDays: number;
			proteinDays: number;
			energyQualified: boolean;
			proteinQualified: boolean;
		};
	};
	locale: "en" | "nl";
	messages: AssistanceMessages;
}) {
	return (
		<View style={styles.averageRow}>
			<AverageCard
				label={messages.averageEnergy}
				value={review.averages.energy}
				unit="kcal"
				dayCount={review.averages.energyDays}
				qualified={review.averages.energyQualified}
				locale={locale}
				messages={messages}
			/>
			<AverageCard
				label={messages.averageProtein}
				value={review.averages.protein}
				unit="g"
				dayCount={review.averages.proteinDays}
				qualified={review.averages.proteinQualified}
				locale={locale}
				messages={messages}
			/>
		</View>
	);
}

function AverageCard({
	label,
	value,
	unit,
	dayCount,
	qualified,
	locale,
	messages,
}: {
	label: string;
	value?: number;
	unit: string;
	dayCount: number;
	qualified: boolean;
	locale: "en" | "nl";
	messages: AssistanceMessages;
}) {
	const daysLabel = dayCount === 1 ? messages.day : messages.days;
	return (
		<Card style={styles.averageCard}>
			<AppText variant="caption">{label}</AppText>
			<AppText variant="heading">
				{value === undefined
					? messages.noAverage
					: `${qualified ? "~ " : ""}${numberText(value, locale)} ${unit} · ${dayCount} ${daysLabel}`}
			</AppText>
		</Card>
	);
}

function ReviewDayCard({
	day,
	today,
	locale,
	messages,
	onPress,
}: {
	day: WeeklyReviewDay;
	today: IsoDate;
	locale: "en" | "nl";
	messages: AssistanceMessages;
	onPress: () => void;
}) {
	const isToday = day.date === today;
	const isUpcoming = day.date > today;
	const dateLabel = formatLongDate(day.date, locale);
	const entryLabel =
		day.entryCount === 0
			? messages.noEntries
			: `${day.entryCount} ${day.entryCount === 1 ? messages.entry : messages.entries}`;
	const stateLabel = isToday
		? messages.today
		: isUpcoming
			? messages.upcoming
			: undefined;
	const comparisonGoals = day.goalBasis === "effective" ? day.goals : [];
	const nutrientSummary =
		day.entryCount > 0 && !isUpcoming
			? ` ${FEATURED_NUTRIENTS.map((nutrient) =>
					nutrientAccessibilityLabel({
						nutrient,
						total: day.totals[nutrient],
						goals: comparisonGoals.filter((goal) => goal.nutrient === nutrient),
						locale,
						messages,
					}),
				).join(" ")}`
			: "";
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${messages.openDay} ${dateLabel}. ${stateLabel ? `${stateLabel}. ` : ""}${entryLabel}.${nutrientSummary}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.dayCard,
				isToday && styles.todayCard,
				isUpcoming && styles.upcomingCard,
				pressed && styles.pressedCard,
			]}
		>
			<View style={styles.dayHeader} accessible={false}>
				<View style={styles.flex}>
					<AppText variant="heading">{dateLabel}</AppText>
					<AppText variant="caption">{entryLabel}</AppText>
				</View>
				{stateLabel ? (
					<View style={[styles.badge, isToday && styles.todayBadge]}>
						<AppText
							variant="caption"
							style={isToday ? styles.todayBadgeText : undefined}
						>
							{stateLabel}
						</AppText>
					</View>
				) : null}
			</View>
			{day.entryCount > 0 && !isUpcoming ? (
				<View style={styles.nutrients} accessible={false}>
					{FEATURED_NUTRIENTS.map((nutrient) => (
						<NutrientVisual
							key={nutrient}
							nutrient={nutrient}
							total={day.totals[nutrient]}
							goals={comparisonGoals.filter(
								(goal) => goal.nutrient === nutrient,
							)}
							locale={locale}
							messages={messages}
							prominent={nutrient === "energy"}
						/>
					))}
				</View>
			) : null}
		</Pressable>
	);
}

function NutrientVisual({
	nutrient,
	total,
	goals,
	locale,
	messages,
	prominent,
}: {
	nutrient: (typeof FEATURED_NUTRIENTS)[number];
	total: NutrientTotal;
	goals: readonly WeeklyGoal[];
	locale: "en" | "nl";
	messages: AssistanceMessages;
	prominent: boolean;
}) {
	const evaluation = evaluateNutrientGoal(
		total.amount,
		total.incomplete,
		goals,
	);
	const label = messages[nutrient];
	const unit = nutrient === "energy" ? "kcal" : "g";
	const amount = `${total.incomplete ? "≥ " : total.qualified ? "~ " : ""}${numberText(total.amount, locale)} ${unit}`;
	const goal = goalText(evaluation, unit, locale, messages);
	const status = statusText(evaluation.status, messages);
	const scale = Math.max(
		total.amount,
		evaluation.maximum ?? 0,
		evaluation.minimum ?? 0,
		1,
	);
	const progress =
		evaluation.status === "noGoal"
			? 0
			: Math.min(100, (total.amount / scale) * 100);
	return (
		<View
			accessible
			accessibilityLabel={nutrientAccessibilityLabel({
				nutrient,
				total,
				goals,
				locale,
				messages,
			})}
			style={[styles.nutrient, prominent && styles.energyNutrient]}
		>
			<View style={styles.nutrientHeader} accessible={false}>
				<AppText variant={prominent ? "body" : "caption"}>{label}</AppText>
				<AppText variant={prominent ? "heading" : "caption"}>{amount}</AppText>
			</View>
			<View
				style={[
					styles.track,
					prominent && styles.energyTrack,
					total.incomplete && styles.incompleteTrack,
				]}
				accessible={false}
			>
				<View
					style={[
						styles.progress,
						{ width: `${progress}%` as DimensionValue },
						{ backgroundColor: statusColor(evaluation.status) },
					]}
				/>
				{evaluation.minimum !== undefined &&
				evaluation.maximum !== undefined ? (
					<View
						style={[
							styles.targetBand,
							{
								left: `${(evaluation.minimum / scale) * 100}%`,
								width: `${((evaluation.maximum - evaluation.minimum) / scale) * 100}%`,
							},
						]}
					/>
				) : null}
			</View>
			<View style={styles.nutrientFooter} accessible={false}>
				<AppText variant="caption">{goal}</AppText>
				{evaluation.status === "noGoal" ? null : (
					<AppText
						variant="caption"
						style={{ color: statusColor(evaluation.status) }}
					>
						{status}
					</AppText>
				)}
			</View>
		</View>
	);
}

function nutrientAccessibilityLabel({
	nutrient,
	total,
	goals,
	locale,
	messages,
}: {
	nutrient: (typeof FEATURED_NUTRIENTS)[number];
	total: NutrientTotal;
	goals: readonly WeeklyGoal[];
	locale: "en" | "nl";
	messages: AssistanceMessages;
}) {
	const evaluation = evaluateNutrientGoal(
		total.amount,
		total.incomplete,
		goals,
	);
	const unit = nutrient === "energy" ? "kcal" : "g";
	const amount = `${total.incomplete ? "≥ " : total.qualified ? "~ " : ""}${numberText(total.amount, locale)} ${unit}`;
	const goal = goalText(evaluation, unit, locale, messages);
	const status =
		evaluation.status === "noGoal"
			? ""
			: ` ${statusText(evaluation.status, messages)}.`;
	return `${messages[nutrient]}: ${amount}. ${goal}.${status}`;
}

function goalText(
	evaluation: ReturnType<typeof evaluateNutrientGoal>,
	unit: string,
	locale: "en" | "nl",
	messages: AssistanceMessages,
) {
	if (evaluation.minimum !== undefined && evaluation.maximum !== undefined) {
		return `${numberText(evaluation.minimum, locale)}–${numberText(evaluation.maximum, locale)} ${unit}`;
	}
	if (evaluation.minimum !== undefined) {
		return `${messages.atLeast} ${numberText(evaluation.minimum, locale)} ${unit}`;
	}
	if (evaluation.maximum !== undefined) {
		return `${messages.upTo} ${numberText(evaluation.maximum, locale)} ${unit}`;
	}
	return messages.noGoal;
}

function statusText(status: WeeklyGoalStatus, messages: AssistanceMessages) {
	const labels: Record<WeeklyGoalStatus, string> = {
		noGoal: messages.noGoal,
		below: messages.below,
		met: messages.met,
		within: messages.within,
		exceeded: messages.exceeded,
		incomplete: messages.incomplete,
	};
	return labels[status];
}

function statusColor(status: WeeklyGoalStatus) {
	if (status === "met" || status === "within") return colors.success;
	if (status === "exceeded") return colors.danger;
	if (status === "below") return colors.warn;
	return colors.textMuted;
}

function WeeklySkeleton({
	label,
	week,
	today,
}: {
	label: string;
	week: IsoDate;
	today: IsoDate;
}) {
	return (
		<SkeletonGroup label={label}>
			<View style={styles.averageRow}>
				<SkeletonBlock height={82} style={styles.flex} />
				<SkeletonBlock height={82} style={styles.flex} />
			</View>
			{weekDates(week).map((date) => (
				<SkeletonBlock key={date} height={date > today ? 76 : 184} />
			))}
		</SkeletonGroup>
	);
}

function numberText(value: number, locale: "en" | "nl") {
	const rounded = Math.round(value * 10) / 10;
	const text = String(rounded);
	return locale === "nl" ? text.replace(".", ",") : text;
}

function isDate(value: string | undefined): value is IsoDate {
	return value !== undefined && isRealIsoDate(value);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingBottom: 48, gap: spacing.md },
	nav: { flexDirection: "row", gap: spacing.sm },
	navButton: { flex: 1, minHeight: 44 },
	summary: { gap: spacing.xs },
	averageRow: { flexDirection: "row", gap: spacing.sm },
	averageCard: { flex: 1, gap: spacing.xs, minHeight: 82 },
	dayCard: {
		backgroundColor: colors.surface,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: 18,
		padding: spacing.md,
		gap: spacing.md,
		minHeight: 76,
	},
	todayCard: { borderColor: colors.accent },
	upcomingCard: { opacity: 0.58 },
	pressedCard: { backgroundColor: colors.surface2 },
	dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	flex: { flex: 1 },
	badge: {
		borderRadius: radius.pill,
		backgroundColor: colors.surface2,
		paddingVertical: spacing.xs,
		paddingHorizontal: spacing.sm,
	},
	todayBadge: { backgroundColor: colors.accentDim },
	todayBadgeText: { color: colors.accent },
	nutrients: {
		gap: spacing.sm,
		borderTopWidth: 1,
		borderTopColor: colors.border,
		paddingTop: spacing.sm,
	},
	nutrient: { gap: spacing.xs },
	energyNutrient: { gap: spacing.sm },
	nutrientHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "baseline",
		gap: spacing.sm,
	},
	track: {
		height: 6,
		borderRadius: radius.pill,
		backgroundColor: colors.surface2,
		overflow: "hidden",
	},
	energyTrack: { height: 10 },
	incompleteTrack: {
		borderWidth: 1,
		borderStyle: "dashed",
		borderColor: colors.textMuted,
	},
	progress: { height: "100%", borderRadius: radius.pill },
	targetBand: {
		position: "absolute",
		top: 0,
		bottom: 0,
		backgroundColor: colors.accentDim,
		borderLeftWidth: 1,
		borderRightWidth: 1,
		borderColor: colors.accent,
	},
	nutrientFooter: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
});
