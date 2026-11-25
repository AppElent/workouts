import { formatClock, primaryMuscleGroup } from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import { useRouter } from "expo-router";
/**
 * The end of a session, before it is saved (APP-255): what you did, how it
 * compares with last time, and the records first. Back to session reopens it.
 */
import { SymbolView } from "expo-symbols";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Doc } from "../../../convex/api";
import { formatSessionDate } from "../../../data/session-data";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { MuscleIcon } from "../../training/exercises/muscle-icon";
import {
	type SessionTotals,
	totalsOf,
	usePreviousSession,
} from "../data/previous-session";
import { formatNumber, formatScore, formatSetFull } from "../session-format";
import {
	allRows,
	type PlanFacts,
	type RecapRow,
	type recapOf,
	type SessionPlan,
} from "../session-plan";

/** Under this many seconds apart, two sessions took as long. */
const SAME_SECONDS = 30;
/** Below this height, the stats share a row and the buttons do too. */
const COMPACT_HEIGHT = 700;
type Copy = ReturnType<typeof useI18n>["t"]["strength"]["plan"]["finish"];
/** `short` fits a quarter-width tile on a small phone. */
type Delta = {
	text: string;
	short?: string;
	tone: "up" | "flat" | "down";
} | null;

function oneRm(value: number, measured: boolean, locale: string) {
	return formatNumber(
		measured ? Math.round(value * 10) / 10 : Math.round(value),
		locale,
	);
}

function statDeltas(
	today: SessionTotals,
	before: SessionTotals | null,
	copy: Copy,
	locale: string,
): Record<"duration" | "volume" | "sets" | "reps", Delta> {
	if (!before) return { duration: null, volume: null, sets: null, reps: null };
	const signed = (diff: number, text: string, short?: string): Delta =>
		diff === 0
			? { text: copy.sameAsLast, short: "=", tone: "flat" }
			: {
					text: fmt(diff > 0 ? copy.up : copy.down, { value: text }),
					short: fmt(diff > 0 ? copy.up : copy.down, { value: short ?? text }),
					tone: diff > 0 ? "up" : "down",
				};
	let duration: Delta = null;
	if (today.durationSeconds !== null && before.durationSeconds !== null) {
		const diff = today.durationSeconds - before.durationSeconds;
		const time = formatClock(Math.abs(diff));
		duration =
			Math.abs(diff) < SAME_SECONDS
				? { text: copy.sameAsLast, short: "=", tone: "flat" }
				: diff < 0
					? { text: fmt(copy.faster, { time }), short: `−${time}`, tone: "up" }
					: {
							text: fmt(copy.slower, { time }),
							short: `+${time}`,
							tone: "flat",
						};
	}
	const volumeDiff = Math.round(today.volume - before.volume);
	const percent =
		before.volume > 0 ? Math.round((volumeDiff / before.volume) * 100) : null;
	return {
		duration,
		volume:
			today.volume > 0 || before.volume > 0
				? signed(
						volumeDiff,
						percent === null
							? `${formatNumber(Math.abs(volumeDiff), locale)} kg`
							: `${Math.abs(percent)}% · ${formatNumber(Math.abs(volumeDiff), locale)} kg`,
						// Under half a percent reads as "0%", so say the kilograms instead.
						percent === null || percent === 0
							? `${formatNumber(Math.abs(volumeDiff), locale)} kg`
							: `${Math.abs(percent)}%`,
					)
				: null,
		sets: signed(
			today.workingSets - before.workingSets,
			String(Math.abs(today.workingSets - before.workingSets)),
		),
		reps: signed(
			today.reps - before.reps,
			String(Math.abs(today.reps - before.reps)),
		),
	};
}

function exerciseDelta(
	exerciseId: string,
	timed: boolean,
	today: SessionTotals,
	before: SessionTotals | null,
	copy: Copy,
	locale: string,
): Delta {
	if (!before) return null;
	const now = today.top[exerciseId];
	const was = before.top[exerciseId];
	if (!now) return null;
	if (!was) return { text: copy.deltaNew, tone: "flat" };
	// A timed set's reps are seconds; a "+n reps" chip would misread them.
	if (timed) return null;
	const kg = Math.round((now.kg - was.kg) * 100) / 100;
	if (kg > 0)
		return {
			text: fmt(copy.deltaKg, { value: formatNumber(kg, locale, 2) }),
			tone: "up",
		};
	if (kg === 0 && now.reps > was.reps)
		return {
			text: plural(locale, now.reps - was.reps, copy.deltaReps),
			tone: "up",
		};
	// Same top set: more work still counts.
	const sum = today.byExercise[exerciseId];
	const prior = before.byExercise[exerciseId];
	if (kg === 0 && now.reps === was.reps && sum && prior) {
		if (sum.sets > prior.sets)
			return {
				text: plural(locale, sum.sets - prior.sets, copy.deltaSets),
				tone: "up",
			};
		const volume = Math.round(sum.volume - prior.volume);
		if (volume > 0)
			return {
				text: fmt(copy.deltaVolume, { value: formatNumber(volume, locale) }),
				tone: "up",
			};
	}
	if (kg === 0 && now.reps === was.reps)
		return { text: copy.deltaEqual, tone: "flat" };
	return null;
}

export function SessionRecap({
	name,
	session,
	plan,
	elapsedSeconds,
	recap,
	getFacts,
	nameOf,
	exerciseOf,
	busy,
	onConfirm,
}: {
	name: string;
	session: Pick<
		Doc<"workoutSessions">,
		"_id" | "routineId" | "name" | "startTime"
	>;
	plan: SessionPlan;
	elapsedSeconds: number;
	recap: ReturnType<typeof recapOf>;
	getFacts: PlanFacts;
	nameOf: (exerciseId: string) => string;
	exerciseOf: (exerciseId: string) => Exercise | undefined;
	busy: boolean;
	onConfirm: () => void;
}) {
	const { locale, t } = useI18n();
	const copy = t.strength.plan.finish;
	const groupCopy = t.strength.plan.group;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const compact = useWindowDimensions().height < COMPACT_HEIGHT;
	const isTimed = (exerciseId: string) => getFacts(exerciseId).timed;
	const previous = usePreviousSession(session);
	const today = totalsOf(
		allRows(plan)
			.filter((row) => row.done)
			.map((row) => ({
				exerciseId: row.exerciseId,
				weight: row.kg,
				unit: "kg" as const,
				reps: row.reps,
				setType: row.kind,
			})),
		elapsedSeconds,
		isTimed,
	);
	const before = previous
		? totalsOf(previous.sets, previous.durationSeconds, isTimed)
		: null;
	const deltas = statDeltas(today, before, copy, locale);
	const records = recap.heroes;
	const scoreText = (rounds: number, sets: number) =>
		formatScore(groupCopy, locale, { rounds, sets });
	const stats: {
		key: string;
		label: string;
		value: string;
		unit?: string;
		delta: Delta;
	}[] = [
		{
			key: "duration",
			label: copy.statDuration,
			value: formatClock(elapsedSeconds),
			delta: deltas.duration,
		},
		{
			key: "volume",
			label: copy.statVolume,
			value: formatNumber(Math.round(today.volume), locale),
			unit: " kg",
			delta: deltas.volume,
		},
		{
			key: "sets",
			label: compact ? copy.statSetsShort : copy.statSets,
			value: String(today.workingSets),
			delta: deltas.sets,
		},
		{
			key: "reps",
			label: copy.statReps,
			value: String(today.reps),
			delta: deltas.reps,
		},
	];
	const deltaColor = (delta: Delta) =>
		delta?.tone === "up" ? colors.success : colors.textMuted;
	const subtitle = [
		formatSessionDate(session.startTime, locale),
		records.length > 0
			? plural(locale, records.length, copy.recordsCount)
			: null,
		before ? null : copy.firstTime,
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<View style={styles.screen}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={[styles.content, { paddingBottom: spacing.xl }]}
			>
				<View style={styles.hero}>
					<View style={styles.badge}>
						<SymbolView
							name={records.length > 0 ? "trophy.fill" : "checkmark"}
							size={28}
							weight="semibold"
							tintColor={colors.onAccent}
							fallback={
								<AppText variant="title" style={{ color: colors.onAccent }}>
									✓
								</AppText>
							}
						/>
					</View>
					<AppText
						variant="largeTitle"
						maxFontSizeMultiplier={1.5}
						accessibilityRole="header"
					>
						{fmt(copy.recapTitle, { name })}
					</AppText>
					<AppText variant="secondary" style={{ color: colors.textMuted }}>
						{subtitle}
					</AppText>
				</View>

				<View style={styles.grid}>
					{stats.map((stat) => (
						<View
							key={stat.key}
							style={[styles.stat, compact && styles.statCompact]}
							accessible
							accessibilityLabel={[
								stat.label,
								`${stat.value}${stat.unit ?? ""}`,
								stat.delta?.text,
							]
								.filter(Boolean)
								.join(", ")}
						>
							<AppText
								variant="eyebrow"
								numberOfLines={1}
								adjustsFontSizeToFit
								style={{ color: colors.textMuted }}
							>
								{stat.label}
							</AppText>
							<AppText
								variant={compact ? "heading" : "metric"}
								numberOfLines={1}
								adjustsFontSizeToFit
								style={styles.tabular}
							>
								{stat.value}
								{stat.unit ? (
									<AppText variant="label" style={{ color: colors.textMuted }}>
										{stat.unit}
									</AppText>
								) : null}
							</AppText>
							{stat.delta ? (
								<AppText
									variant={compact ? "caption" : "label"}
									numberOfLines={compact ? 2 : undefined}
									style={[styles.tabular, { color: deltaColor(stat.delta) }]}
								>
									{compact ? stat.delta.short : stat.delta.text}
								</AppText>
							) : null}
						</View>
					))}
				</View>

				{records.length > 0 ? (
					<View style={styles.section}>
						<AppText
							variant="eyebrow"
							accessibilityRole="header"
							style={styles.sectionHead}
						>
							{copy.records}
						</AppText>
						<View style={[styles.card, styles.recordCard]}>
							{records.map((row, index) => (
								<RecordRow
									key={row.exerciseId}
									row={row}
									first={index === 0}
									name={nameOf(row.exerciseId)}
									getFacts={getFacts}
								/>
							))}
						</View>
					</View>
				) : null}

				<View style={styles.section}>
					<AppText
						variant="eyebrow"
						accessibilityRole="header"
						style={styles.sectionHead}
					>
						{previous
							? fmt(copy.exercisesVs, {
									date: formatSessionDate(previous.date, locale),
								})
							: copy.exercises}
					</AppText>
					<View style={styles.card}>
						{recap.exercises.map((row, index) => {
							const facts = getFacts(row.exerciseId);
							const delta = exerciseDelta(
								row.exerciseId,
								facts.timed,
								today,
								before,
								copy,
								locale,
							);
							const line = [
								plural(locale, row.sets, copy.rowSets),
								row.topLoad ? formatSetFull(row.topLoad, facts, locale) : null,
							]
								.filter(Boolean)
								.join(" · ");
							return (
								<Pressable
									key={row.exerciseId}
									accessibilityRole="button"
									accessibilityLabel={[
										nameOf(row.exerciseId),
										line,
										delta?.text,
									]
										.filter(Boolean)
										.join(", ")}
									onPress={() =>
										router.push({
											pathname: "/exercise-sheet/[id]",
											// "‹ Sessie" back, as from the session itself (APP-624).
											params: { id: row.exerciseId, from: "session" },
										})
									}
									style={({ pressed }) => [
										styles.row,
										index > 0 && styles.rowLine,
										pressed && { opacity: opacity.pressed },
									]}
									testID="session-recap-exercise"
								>
									<View style={styles.iconTile}>
										<MuscleIcon
											group={(() => {
												const exercise = exerciseOf(row.exerciseId);
												return exercise
													? primaryMuscleGroup(exercise)
													: "other";
											})()}
											size={34}
										/>
									</View>
									<View style={styles.rowText}>
										<AppText variant="row" numberOfLines={2}>
											{nameOf(row.exerciseId)}
										</AppText>
										<AppText
											variant="footnote"
											style={[styles.tabular, { color: colors.textMuted }]}
										>
											{line}
										</AppText>
									</View>
									{delta ? (
										<View
											style={[
												styles.chip,
												delta.tone === "up"
													? { backgroundColor: colors.accentDim }
													: { backgroundColor: colors.surface2 },
											]}
										>
											<AppText
												variant="label"
												style={[
													styles.tabular,
													{
														color:
															delta.tone === "up"
																? colors.accentInk
																: colors.textMuted,
													},
												]}
											>
												{delta.text}
											</AppText>
										</View>
									) : null}
									<AppText variant="row" style={{ color: colors.textFaint }}>
										›
									</AppText>
								</Pressable>
							);
						})}
						{recap.groups.map((group) => (
							<View
								key={group.id}
								accessible
								style={[styles.row, styles.rowLine]}
							>
								<View style={styles.rowText}>
									<AppText variant="row">{copy.groupAmrap}</AppText>
									<AppText
										variant="footnote"
										style={{ color: colors.textMuted }}
									>
										{group.exercises.map(nameOf).join(" · ")}
									</AppText>
								</View>
								<AppText variant="row">
									{scoreText(group.rounds, group.sets)}
								</AppText>
							</View>
						))}
					</View>
				</View>
			</ScrollView>
			<View
				style={[
					styles.footer,
					compact && styles.footerCompact,
					{ paddingBottom: insets.bottom + spacing.sm },
				]}
			>
				<Pressable
					accessibilityRole="button"
					disabled={busy}
					onPress={onConfirm}
					style={[
						styles.primary,
						compact && styles.grow,
						busy && { opacity: opacity.disabled },
					]}
					testID="session-recap-confirm"
				>
					<AppText
						variant="control"
						style={{ color: colors.onAccent, fontWeight: "700" }}
					>
						{copy.save}
					</AppText>
				</Pressable>
			</View>
		</View>
	);
}

function RecordRow({
	row,
	first,
	name,
	getFacts,
}: {
	row: RecapRow;
	first: boolean;
	name: string;
	getFacts: PlanFacts;
}) {
	const { locale, t } = useI18n();
	const copy = t.strength.plan.finish;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	if (!row.best) return null;
	const measured = row.tag === "newMeasured";
	const set = row.topLoad
		? formatSetFull(row.topLoad, getFacts(row.exerciseId), locale)
		: "";
	const cap = fmt(measured ? copy.recordMeasured : copy.recordEstimated, {
		set,
	});
	const value = `${measured ? "" : "≈ "}${oneRm(row.best.value, measured, locale)} kg`;
	const was =
		row.was === null
			? null
			: fmt(copy.heroWas, { value: formatNumber(Math.round(row.was), locale) });
	return (
		<View
			accessible
			accessibilityLabel={[name, cap, value, was].filter(Boolean).join(", ")}
			style={[styles.row, !first && styles.rowLine]}
		>
			<View style={[styles.tile, { backgroundColor: colors.accentFill }]}>
				<SymbolView
					name="arrow.up"
					size={16}
					weight="bold"
					tintColor={colors.onAccent}
					fallback={
						<AppText variant="label" style={{ color: colors.onAccent }}>
							↑
						</AppText>
					}
				/>
			</View>
			<View style={styles.rowText}>
				<AppText variant="row" numberOfLines={2}>
					{name}
				</AppText>
				<AppText variant="footnote" style={{ color: colors.textMuted }}>
					{cap}
				</AppText>
			</View>
			<View style={styles.rowEnd}>
				<AppText
					variant="heading"
					style={[styles.tabular, { color: colors.accentInk }]}
				>
					{value}
				</AppText>
				{was ? (
					<AppText variant="caption" style={{ color: colors.textMuted }}>
						{was}
					</AppText>
				) : null}
			</View>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		content: { padding: spacing.md, gap: spacing.lg - 4 },
		hero: { gap: spacing.xs, paddingHorizontal: spacing.xs },
		badge: {
			width: 60,
			height: 60,
			marginBottom: spacing.sm,
			borderRadius: 18,
			borderCurve: "continuous",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.accentFill,
		},
		grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
		stat: {
			flexGrow: 1,
			flexBasis: "45%",
			gap: spacing.xs,
			padding: spacing.md - 2,
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
		},
		statCompact: { flexBasis: "22%", padding: spacing.sm, gap: 2 },
		tabular: { fontVariant: ["tabular-nums"] },
		iconTile: {
			width: 40,
			height: 40,
			borderRadius: 11,
			borderCurve: "continuous",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
		footerCompact: { flexDirection: "row-reverse", gap: spacing.sm },
		grow: { flex: 1 },
		section: { gap: spacing.sm },
		sectionHead: { color: colors.textMuted, paddingHorizontal: spacing.xs },
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		recordCard: { backgroundColor: colors.accentDim },
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md - 4,
			minHeight: 64,
			paddingHorizontal: spacing.md - 2,
			paddingVertical: spacing.sm + 2,
		},
		rowLine: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		rowText: { flex: 1, minWidth: 0, gap: 2 },
		rowEnd: { alignItems: "flex-end", gap: 1 },
		tile: {
			width: 36,
			height: 36,
			borderRadius: 10,
			borderCurve: "continuous",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
		chip: {
			minHeight: 28,
			paddingHorizontal: 10,
			borderRadius: radius.pill,
			justifyContent: "center",
		},
		footer: {
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
			gap: spacing.xs,
		},
		primary: {
			minHeight: 56,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
	});
