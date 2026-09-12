import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
	type WeeklyReviewDay,
	weekEndDate,
	weekStartMonday,
} from "../data/nutrition-weekly-review";
import { useStalledOffline } from "../data/stalled-offline";
import { useI18n } from "../i18n";
import { getNutritionAssistanceMessages } from "../i18n/messages/nutrition-assistance";
import { colors, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function NutritionWeeklyReviewScreen({
	startDate,
	onClose,
}: {
	startDate?: string;
	onClose: () => void;
}) {
	const { locale } = useI18n();
	const messages = getNutritionAssistanceMessages(locale);
	const toast = useToast();
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const initial = isDate(startDate)
		? weekStartMonday(startDate)
		: weekStartMonday(todayIsoDate());
	const [week, setWeek] = useState(initial);
	const [pendingDate, setPendingDate] = useState<string>();
	const [retryNonce, setRetryNonce] = useState(0);
	const queryArgs = retryNonce % 2 === 0 ? { startDate: week } : "skip";
	const result = useQuery(api.nutritionReview.week, queryArgs);
	const toggleComplete = useMutation(api.nutritionReview.toggleComplete);
	const review = result;
	const subject = operations.getSubject();
	const hasPendingDeviceOperations = subject
		? operations
				.getOperations(subject)
				.some((operation) => operation.status !== "acknowledged")
		: false;
	const { isWebSocketConnected } = useConvexConnectionState();
	const stalledOffline = useStalledOffline(
		review === undefined,
		isWebSocketConnected,
	);
	const range = useMemo(
		() =>
			`${formatLongDate(week, locale)} – ${formatLongDate(weekEndDate(week), locale)}`,
		[locale, week],
	);

	async function toggle(day: WeeklyReviewDay) {
		if (pendingDate) return;
		setPendingDate(day.date);
		try {
			await toggleComplete({ date: day.date, completed: !day.markedComplete });
		} catch {
			toast.error(messages.completeFailure);
		} finally {
			setPendingDate(undefined);
		}
	}

	return (
		<ScrollView
			style={styles.root}
			contentInsetAdjustmentBehavior="automatic"
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			<Eyebrow>{messages.weeklyTitle}</Eyebrow>
			<AppText variant="title">{range}</AppText>
			<View style={styles.nav}>
				<GhostButton
					label={messages.previousWeek}
					onPress={() => setWeek((date) => shiftIsoDate(date, -7))}
				/>
				<GhostButton
					label={messages.nextWeek}
					onPress={() => setWeek((date) => shiftIsoDate(date, 7))}
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
								setRetryNonce((value) => value + 1);
								setTimeout(() => setRetryNonce((value) => value + 1), 0);
							},
						}}
					/>
				</Card>
			) : review === undefined ? (
				<WeeklySkeleton label={messages.loading} />
			) : (
				<>
					{hasPendingDeviceOperations ? (
						<Card style={styles.summary}>
							<AppText variant="caption">{messages.pendingNotice}</AppText>
						</Card>
					) : null}
					<Card style={styles.summary}>
						<AppText variant="heading">{messages.coverage}</AppText>
						<AppText>
							{review.coverage.loggedDayCount} {messages.loggedDays} ·{" "}
							{review.coverage.markedCompleteCount} {messages.completeDays}
						</AppText>
						<AppText variant="caption">{messages.missingUnknown}</AppText>
					</Card>
					<Card style={styles.summary}>
						<AppText variant="heading">{messages.averages}</AppText>
						<AppText>
							{messages.averageEnergy}:{" "}
							{review.averages.energy === undefined
								? messages.notEnoughKnown
								: `${numberText(review.averages.energy, locale)} kcal (${review.averages.energyDays} ${messages.days})`}
						</AppText>
						<AppText>
							{messages.averageProtein}:{" "}
							{review.averages.protein === undefined
								? messages.notEnoughKnown
								: `${numberText(review.averages.protein, locale)} g (${review.averages.proteinDays} ${messages.days})`}
						</AppText>
						<AppText variant="caption">{messages.factualOnly}</AppText>
					</Card>
					{review.days.map((day) => (
						<ReviewDayCard
							key={day.date}
							day={day}
							locale={locale}
							messages={messages}
							pending={pendingDate === day.date}
							onToggle={() => toggle(day)}
						/>
					))}
					{review.coverage.loggedDayCount === 0 ? (
						<EmptyState body={messages.noEntries} />
					) : null}
				</>
			)}
			<PrimaryButton label={messages.close} onPress={onClose} />
		</ScrollView>
	);
}

function ReviewDayCard({
	day,
	locale,
	messages,
	pending,
	onToggle,
}: {
	day: WeeklyReviewDay;
	locale: "en" | "nl";
	messages: ReturnType<typeof getNutritionAssistanceMessages>;
	pending: boolean;
	onToggle: () => void;
}) {
	const entryNames = day.entries
		.map((entry) => entry.name?.[locale])
		.filter(Boolean)
		.join(", ");
	return (
		<Card style={styles.dayCard}>
			<View style={styles.dayHeader}>
				<View style={styles.flex}>
					<AppText variant="heading">
						{formatLongDate(day.date, locale)}
					</AppText>
					{day.entries.length > 0 ? (
						<AppText variant="caption">
							{day.entries.length} {messages.entries}
							{entryNames ? ` · ${entryNames}` : ""}
						</AppText>
					) : (
						<AppText variant="caption">{messages.dayUnknown}</AppText>
					)}
				</View>
				<GhostButton
					label={
						day.markedComplete ? messages.markIncomplete : messages.markComplete
					}
					loading={pending}
					onPress={onToggle}
					accessibilityRole="checkbox"
					accessibilityState={{ checked: day.markedComplete, busy: pending }}
				/>
			</View>
			{day.entries.length > 0 ? (
				<View style={styles.totals}>
					<ReviewTotal
						label={messages.energy}
						amount={day.totals.energy.amount}
						unit="kcal"
						incomplete={
							day.totals.energy.incomplete || day.totals.energy.qualified
						}
					/>
					<ReviewTotal
						label={messages.protein}
						amount={day.totals.protein.amount}
						unit="g"
						incomplete={
							day.totals.protein.incomplete || day.totals.protein.qualified
						}
					/>
				</View>
			) : null}
		</Card>
	);
}

function ReviewTotal({
	label,
	amount,
	unit,
	incomplete,
}: {
	label: string;
	amount: number;
	unit: string;
	incomplete: boolean;
}) {
	return (
		<AppText variant="caption">
			{label}: {numberText(amount, "en")} {unit}
			{incomplete ? " · incomplete" : ""}
		</AppText>
	);
}

function WeeklySkeleton({ label }: { label: string }) {
	return (
		<SkeletonGroup label={label}>
			<SkeletonBlock height={72} />
			<SkeletonBlock height={72} />
			<SkeletonBlock height={72} />
		</SkeletonGroup>
	);
}

function numberText(value: number, locale: "en" | "nl") {
	const rounded = Math.round(value * 10) / 10;
	const text = String(rounded);
	return locale === "nl" ? text.replace(".", ",") : text;
}

function isDate(value: string | undefined): value is IsoDate {
	return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingBottom: 48, gap: spacing.md },
	nav: { flexDirection: "row", gap: spacing.sm },
	summary: { gap: spacing.xs },
	dayCard: { gap: spacing.sm },
	dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	flex: { flex: 1 },
	totals: {
		gap: spacing.xs,
		borderTopWidth: 1,
		borderTopColor: colors.border,
		paddingTop: spacing.sm,
	},
});
