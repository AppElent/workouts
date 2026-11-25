/**
 * One exercise: what you can lift, and everything you have lifted.
 *
 * Per-row 1RM in History is computed here rather than read from
 * `oneRepMaxes`: the stored record is your
 * current best across all sets, whereas each row wants what *that* set was
 * worth on its own.
 *
 * The strength curve is the one chart worth explaining. For each rep count it
 * plots the heaviest set you have actually logged at exactly that many reps,
 * against what Epley says you *should* manage there given your current 1RM.
 * Points below the line are rep ranges you have not pushed; points above mean
 * your 1RM estimate is stale.
 */
import {
	convertLoad,
	exerciseRecords,
	isLoadedEquipment,
	isTimedExercise,
	primaryMuscleGroup,
	repMaxCurve,
	roundLoad,
} from "@foundry/core";
import type { ExerciseId } from "@foundry/core/exercises";
import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useExercise } from "../../../data/exercises";
import { dayLabel, formatSessionDate } from "../../../data/session-data";
import { dateLocale, fmt, type Locale, plural, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { BackLink } from "../../../ui/back-link";
import { TrendChart } from "../../../ui/chart";
import { Card, Eyebrow, StatBox } from "../../../ui/coach";
import { useConfirm } from "../../../ui/confirm-dialog";
import { DisclosureRow } from "../../../ui/form";
import { RowNote } from "../../../ui/row-note";
import { ScreenHeader } from "../../../ui/screen-header";
import { Segmented } from "../../../ui/segmented";
import { SkeletonBlock, SkeletonList } from "../../../ui/skeleton";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { TrendLine } from "../../../ui/trend-line";
import { useWriteFailureMessage } from "../../../ui/use-screen-write";
import {
	latestBodyweightKg,
	levelKey,
	levelOf,
	strengthLevels,
} from "../../strength-session/strength-levels";
import { spokenSet } from "../set-speech";
import { dailyBest, dayOf, exerciseInsight } from "./exercise-insight";
import { MuscleIcon } from "./muscle-icon";

type Tab = "Overview" | "History" | "Records";

/** Rep counts the strength curve covers — beyond ten, Epley stops meaning much. */
const CURVE_REPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** The rep counts "what you can lift now" answers for. */
const CAN_LIFT_REPS = [1, 3, 5, 8, 10];
const formatKg = (value: number, locale: string, digits = 1) =>
	value.toLocaleString(locale, { maximumFractionDigits: digits });
const shortDate = (time: number, locale: Locale) =>
	new Date(time).toLocaleDateString(dateLocale(locale), {
		day: "numeric",
		month: "short",
	});

export function ExerciseDetailScreen() {
	const errorMessage = useWriteFailureMessage();
	const colors = useTokens();
	const { t, locale } = useI18n();
	const router = useRouter();
	const confirm = useConfirm();
	const toast = useToast();
	const remove = useMutation(api.exercises.remove);
	const [deleting, setDeleting] = useState(false);
	const styles = useThemedStyles(createStyles);
	const params = useLocalSearchParams<{ id?: string; from?: string }>();
	const exerciseId = params.id as ExerciseId | undefined;

	const [tab, setTab] = useState<Tab>("Overview");

	const exercise = useExercise(exerciseId);
	const deleteExercise = async () => {
		if (!exercise || exercise.isDefault || deleting) return;
		if (
			!(await confirm({
				title: t.exercises.deleteTitle.replace("{name}", exercise.name),
				message: t.exercises.deleteBody,
				confirmLabel: t.exercises.delete,
				cancelLabel: t.exercises.cancel,
				destructive: true,
			}))
		)
			return;
		setDeleting(true);
		try {
			await remove({ id: exercise._id });
			router.back();
		} catch (error) {
			toast.error(errorMessage(error, t.exercises.deleteError));
		} finally {
			setDeleting(false);
		}
	};
	const history = useQuery(
		api.exercises.getHistory,
		exerciseId ? { exerciseId } : "skip",
	);
	const currentOrm = useQuery(
		api.oneRepMaxes.getCurrentForExercise,
		exerciseId ? { exerciseId } : "skip",
	);

	const timed = isTimedExercise(exerciseId);
	const records = useMemo(
		() =>
			history?.length ? exerciseRecords(history, exercise, CURVE_REPS) : null,
		[history, exercise],
	);
	const ormHistory = useQuery(
		api.oneRepMaxes.listForExercise,
		exerciseId ? { exerciseId } : "skip",
	);
	const bodyMetrics = useQuery(api.bodyMetrics.list, {});
	const insight = useMemo(
		() =>
			history
				? exerciseInsight(
						history,
						ormHistory ?? [],
						Date.now(),
						timed,
						currentOrm,
					)
				: null,
		[history, ormHistory, timed, currentOrm],
	);

	if (exercise === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<SkeletonList rows={3} />
			</View>
		);
	}

	if (exercise === null) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">{t.exercises.detail.notFound}</AppText>
				<AppText variant="caption" style={styles.centeredText}>
					{t.exercises.detail.notFoundHint}
				</AppText>
			</View>
		);
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
		>
			{params.from === "session" ? (
				<Stack.Toolbar placement="left">
					{Platform.OS === "ios" ? (
						// "‹ Sessie": an icon button would hide the label (APP-619).
						<Stack.Toolbar.View hidesSharedBackground>
							<BackLink
								label={t.exercises.backSession}
								spokenLabel={t.exercises.backSessionSpoken}
								onPress={() => router.back()}
								testID="exercise-back-session"
							/>
						</Stack.Toolbar.View>
					) : (
						<Stack.Toolbar.Button
							icon="chevron.left"
							accessibilityLabel={t.exercises.backSessionSpoken}
							onPress={() => router.back()}
						>
							{t.exercises.backSession}
						</Stack.Toolbar.Button>
					)}
				</Stack.Toolbar>
			) : null}
			<View style={styles.header}>
				<View style={styles.iconTile}>
					<MuscleIcon group={primaryMuscleGroup(exercise)} size={60} />
				</View>
				<View style={styles.flex}>
					{/* In the session sheet the big title below is the only one (APP-619). */}
					<ScreenHeader
						title={params.from === "session" ? "" : exercise.name}
					/>
					<Stack.Toolbar placement="right">
						<Stack.Toolbar.Menu
							icon="ellipsis"
							accessibilityLabel={t.exercises.actions}
							disabled={deleting}
						>
							{exercise.isDefault ? (
								<Stack.Toolbar.MenuAction
									icon="doc.on.doc"
									onPress={() =>
										router.push({
											pathname: "/exercise-new",
											params: { clone: exercise._id },
										})
									}
								>
									{t.exercises.clone}
								</Stack.Toolbar.MenuAction>
							) : (
								<Stack.Toolbar.Menu inline>
									<Stack.Toolbar.MenuAction
										icon="pencil"
										onPress={() =>
											router.push({
												pathname: "/exercise-new",
												params: { edit: exercise._id },
											})
										}
									>
										{t.exercises.edit}
									</Stack.Toolbar.MenuAction>
									<Stack.Toolbar.MenuAction
										icon="trash"
										destructive
										onPress={() => void deleteExercise()}
									>
										{t.exercises.delete}
									</Stack.Toolbar.MenuAction>
								</Stack.Toolbar.Menu>
							)}
						</Stack.Toolbar.Menu>
					</Stack.Toolbar>
					<AppText variant="title" numberOfLines={2}>
						{exercise.name}
					</AppText>
					<AppText variant="caption" style={{ color: colors.textMuted }}>
						{[
							t.exercises.groupNames[primaryMuscleGroup(exercise)],
							(t.exercises as Record<string, unknown>)[exercise.category] ??
								exercise.category,
							t.exercises.equipmentNames[exercise.equipment] ??
								exercise.equipment,
						].join(" · ")}
					</AppText>
				</View>
			</View>

			<Segmented
				value={tab}
				onChange={setTab}
				options={[
					{ value: "Overview", label: t.exercises.overview },
					{ value: "History", label: t.exercises.history },
					{ value: "Records", label: t.exercises.recordsTab },
				]}
			/>

			{tab === "Overview" ? (
				<OverviewInsight
					exerciseId={exercise._id}
					timed={timed}
					weighted={isLoadedEquipment(exercise.equipment)}
					currentOrm={currentOrm}
					insight={insight}
				/>
			) : tab === "Records" ? (
				<>
					{records ? (
						<>
							<Eyebrow>{t.exercises.detail.records}</Eyebrow>
							<View style={styles.statRow}>
								<StatBox
									value={
										records.heaviest
											? formatKg(records.heaviest.valueKg, locale, 2)
											: "—"
									}
									unit={records.heaviest ? "kg" : undefined}
									label={t.exercises.detail.heaviest}
								/>
								<StatBox
									value={records.mostReps ? String(records.mostReps.reps) : "—"}
									unit={timed && records.mostReps ? "s" : undefined}
									label={
										timed
											? t.exercises.detail.longestHold
											: t.exercises.detail.mostReps
									}
								/>
								<StatBox
									value={
										records.bestEstimate
											? formatKg(records.bestEstimate.valueKg, locale)
											: "—"
									}
									unit={records.bestEstimate ? "kg" : undefined}
									label={t.exercises.detail.bestEstimate}
									color={colors.accent}
								/>
							</View>
						</>
					) : null}

					<LevelCard
						exerciseId={exercise._id}
						timed={timed}
						currentOrm={currentOrm}
						bodyweightKg={latestBodyweightKg(bodyMetrics)}
					/>
					<ProgressTab
						exerciseId={exerciseId}
						repMaxes={records?.repMaxes ?? []}
						currentOrm={currentOrm ?? null}
					/>
					{exercise.notes ? (
						<>
							<Eyebrow>{t.exercises.detail.notes}</Eyebrow>
							<Card>
								<AppText variant="body">{exercise.notes}</AppText>
							</Card>
						</>
					) : null}

					{exercise.instructions && exercise.instructions.length > 0 ? (
						<>
							<Eyebrow>{t.exercises.detail.howTo}</Eyebrow>
							<Card style={styles.instructions}>
								{exercise.instructions.map((line, i) => (
									// Instructions are a fixed ordered list with no ids; the
									// index is the only stable key and the order never shifts.
									// biome-ignore lint/suspicious/noArrayIndexKey: static ordered list
									<AppText key={i} variant="body" style={styles.step}>
										{i + 1}. {line}
									</AppText>
								))}
							</Card>
						</>
					) : null}
				</>
			) : (
				<HistoryTab
					sessions={
						history === undefined ? undefined : (insight?.sessions ?? [])
					}
					timed={timed}
				/>
			)}
		</ScrollView>
	);
}

function ProgressTab({
	exerciseId,
	repMaxes,
	currentOrm,
}: {
	exerciseId: ExerciseId | undefined;
	repMaxes: readonly { reps: number; valueKg: number }[];
	currentOrm: { value: number } | null;
}) {
	const colors = useTokens();
	const { t, locale } = useI18n();
	const ormHistory = useQuery(
		api.oneRepMaxes.listForExercise,
		exerciseId ? { exerciseId } : "skip",
	);

	// One point per day: two records on one day drew a vertical spike.
	const ormPoints = useMemo(
		() =>
			dailyBest(ormHistory ?? []).map((point) => ({
				value: Math.round(point.kg * 10) / 10,
				label: shortDate(point.date, locale),
			})),
		[ormHistory, locale],
	);

	const actualCurve = useMemo(
		() =>
			CURVE_REPS.map((reps) => ({
				value: roundLoad(
					repMaxes.find((best) => best.reps === reps)?.valueKg ?? 0,
					0.1,
				),
				label: `${reps}`,
			})),
		[repMaxes],
	);

	const theoreticalCurve = useMemo(() => {
		if (!currentOrm) return [];
		return repMaxCurve(currentOrm.value, CURVE_REPS).map(
			({ reps, weight }) => ({
				value: Math.round(weight * 10) / 10,
				label: `${reps}`,
			}),
		);
	}, [currentOrm]);

	const hasCurve = actualCurve.some((p) => p.value > 0);

	return (
		<>
			<TrendChart
				title={t.exercises.detail.ormOverTime}
				points={ormPoints}
				note={
					ormHistory?.some(
						(record) => record.source !== "manual" && !record.sourceSetId,
					)
						? t.strength.unverifiedHistory
						: undefined
				}
			/>

			{hasCurve ? (
				<TrendChart
					title={t.exercises.detail.curveLogged}
					note={t.exercises.detail.curveLoggedNote}
					points={actualCurve.filter((p) => p.value > 0)}
				/>
			) : null}

			{theoreticalCurve.length > 0 ? (
				<TrendChart
					title={t.exercises.detail.curvePredicted}
					note={t.exercises.detail.curvePredictedNote}
					points={theoreticalCurve}
					color={colors.textMuted}
				/>
			) : null}
		</>
	);
}

type Insight = ReturnType<typeof exerciseInsight>;

type Orm = {
	value: number;
	unit: "kg" | "lbs";
	source: string;
	date: number;
};

/** A tile under the 1RM card: a label, a number, and what it is relative to. */
function Tile({
	label,
	value,
	unit,
	caption,
}: {
	label: string;
	value: string;
	unit?: string;
	caption?: string;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.tile} accessible>
			<AppText
				variant="overline"
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.7}
				style={{ color: colors.textMuted }}
			>
				{label}
			</AppText>
			<AppText
				variant="stat"
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.6}
				style={styles.tabular}
			>
				{value}
				{unit ? (
					<AppText variant="stat" style={{ color: colors.text }}>
						{` ${unit}`}
					</AppText>
				) : null}
			</AppText>
			{caption ? (
				<AppText
					variant="caption"
					numberOfLines={1}
					style={{ color: colors.textMuted }}
				>
					{caption}
				</AppText>
			) : null}
		</View>
	);
}

function OverviewInsight({
	exerciseId,
	timed,
	weighted,
	currentOrm,
	insight,
}: {
	exerciseId: string;
	timed: boolean;
	/** Loaded equipment: only these have a Krachtprofiel. */
	weighted: boolean;
	currentOrm: Orm | null | undefined;
	insight: Insight | null;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const { t, locale } = useI18n();
	const copy = t.exercises.detail;
	const ormKg = currentOrm
		? convertLoad(currentOrm.value, currentOrm.unit, "kg")
		: null;
	const trend = insight?.trend;
	const volume = insight?.volume ?? 0;
	const points = insight?.points ?? [];
	const first = insight?.sessions.at(-1)?.date ?? null;
	return (
		<>
			<View style={styles.ormCard}>
				<View style={styles.ormHead}>
					<View style={styles.flex}>
						<AppText variant="overline" style={{ color: colors.textMuted }}>
							{currentOrm?.source === "manual"
								? copy.manualOrm
								: currentOrm?.source === "actual"
									? copy.measuredOrm
									: copy.estimatedOrm}
						</AppText>
						{currentOrm === undefined ? (
							<SkeletonBlock height={40} />
						) : currentOrm === null ? (
							<AppText variant="caption">{copy.noOrm}</AppText>
						) : (
							<AppText variant="valueSmall" style={styles.tabular}>
								{formatKg(currentOrm.value, locale)}
								<AppText variant="stat" style={{ color: colors.textMuted }}>
									{` ${currentOrm.unit}`}
								</AppText>
							</AppText>
						)}
					</View>
					{trend && trend.kg !== 0 ? (
						<View
							style={[
								styles.trend,
								{
									backgroundColor:
										trend.kg > 0 ? colors.accentDim : colors.surface2,
								},
							]}
						>
							<AppText
								variant="label"
								style={{
									fontWeight: "700",
									color: trend.kg > 0 ? colors.accentInk : colors.textMuted,
								}}
							>
								{fmt(trend.kg > 0 ? copy.trendUp : copy.trendDown, {
									value: formatKg(Math.abs(trend.kg), locale),
									weeks: fmt(plural(locale, trend.weeks, copy.weeks), {
										count: trend.weeks,
									}),
								})}
							</AppText>
						</View>
					) : null}
				</View>
				{points.length >= 2 ? (
					<TrendLine
						height={150}
						summary={fmt(copy.trendSummary, {
							from: formatKg(points[0]?.kg ?? 0, locale),
							to: formatKg(points.at(-1)?.kg ?? 0, locale),
						})}
						points={points.map((point, index) => ({
							value: Math.round(point.kg * 10) / 10,
							label:
								index === points.length - 1 &&
								dayOf(point.date) === dayOf(Date.now())
									? copy.today
									: shortDate(point.date, locale),
						}))}
					/>
				) : currentOrm ? (
					<AppText variant="caption" style={{ color: colors.textMuted }}>
						{currentOrm.source === "calculated"
							? copy.calculated
							: currentOrm.source === "actual"
								? copy.actual
								: copy.manual}
					</AppText>
				) : null}
			</View>

			{insight && insight.sessionCount > 0 ? (
				<View style={styles.statRow}>
					<Tile
						label={copy.bestSet}
						value={
							insight.best
								? `${formatKg(insight.best.kg, locale, 2)} × ${insight.best.reps}`
								: "—"
						}
						caption={
							insight.best
								? dayLabel(insight.best.date, copy.today, (time) =>
										shortDate(time, locale),
									)
								: undefined
						}
					/>
					{timed ? null : (
						<Tile
							label={copy.volume4w}
							value={
								volume >= 1000
									? formatKg(volume / 1000, locale)
									: formatKg(volume, locale, 0)
							}
							unit={volume >= 1000 ? "t" : "kg"}
							caption={
								insight.volumeChange === null
									? undefined
									: `${insight.volumeChange >= 0 ? "▲" : "▼"} ${Math.abs(insight.volumeChange)}%`
							}
						/>
					)}
					<Tile
						label={copy.sessions}
						value={String(insight.sessionCount)}
						caption={
							first === null
								? undefined
								: fmt(copy.since, {
										month: new Date(first).toLocaleDateString(
											dateLocale(locale),
											{ month: "short" },
										),
									})
						}
					/>
				</View>
			) : null}

			{ormKg && !timed ? (
				<>
					<AppText
						variant="overline"
						style={[styles.sectionLabel, { color: colors.textMuted }]}
					>
						{copy.canLift}
					</AppText>
					<View style={styles.canLift}>
						{repMaxCurve(ormKg, CAN_LIFT_REPS).map(
							({ reps, weight }, index) => (
								<View
									key={reps}
									style={[styles.canLiftCell, index > 0 && styles.canLiftLine]}
									accessible
									accessibilityLabel={`${reps === 1 ? copy.reps1 : fmt(copy.repsN, { count: reps })}, ${formatKg(roundLoad(weight, 0.5), locale)} kg`}
								>
									<AppText
										variant="caption"
										style={{ color: colors.textMuted }}
									>
										{reps === 1 ? copy.reps1 : fmt(copy.repsN, { count: reps })}
									</AppText>
									<AppText variant="heading" style={styles.tabular}>
										{formatKg(roundLoad(weight, 0.5), locale)}
									</AppText>
								</View>
							),
						)}
					</View>
				</>
			) : null}

			{weighted && !timed ? (
				<View style={styles.profileRow}>
					<DisclosureRow
						label={t.strength.plan.profile.title}
						onPress={() =>
							router.push({
								pathname: "/strength-profile",
								params: { exerciseId },
							})
						}
					/>
				</View>
			) : null}
		</>
	);
}

/** Where your 1RM sits against common strength standards. */
function LevelCard({
	exerciseId,
	timed,
	currentOrm,
	bodyweightKg,
}: {
	exerciseId: string;
	timed: boolean;
	currentOrm: Orm | null | undefined;
	bodyweightKg: number | null;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	const copy = t.exercises.detail;
	const levelNames = t.strength.plan.editor.levels;
	const ormKg = currentOrm
		? convertLoad(currentOrm.value, currentOrm.unit, "kg")
		: null;
	const levels = timed
		? null
		: strengthLevels(levelKey(exerciseId), bodyweightKg);
	if (!levels) return null;
	const where =
		ormKg && bodyweightKg ? levelOf(levels, ormKg, bodyweightKg) : null;
	return (
		<Card style={styles.levelCard}>
			<Eyebrow>{copy.level}</Eyebrow>
			<View style={styles.levelBar}>
				{levels.map((level, index) => (
					<View key={level.id} style={styles.levelCell}>
						<View
							style={[
								styles.levelFill,
								{
									backgroundColor:
										where && index <= where.index
											? colors.accentFill
											: colors.surface2,
								},
							]}
						/>
						<AppText
							variant="caption"
							numberOfLines={1}
							adjustsFontSizeToFit
							style={{
								color: where?.index === index ? colors.text : colors.textMuted,
								fontWeight: where?.index === index ? "700" : "500",
							}}
						>
							{levelNames[level.id]}
						</AppText>
					</View>
				))}
			</View>
			<AppText variant="secondary" style={{ color: colors.textMuted }}>
				{!bodyweightKg
					? t.strength.plan.editor.levelsNoWeight
					: !where
						? t.strength.plan.editor.levelGuide
						: where.toNextKg === null
							? copy.levelTop
							: fmt(copy.levelNext, {
									next: where.toNextKg,
									level: levelNames[levels[where.index + 1]?.id ?? "expert"],
								})}
			</AppText>
		</Card>
	);
}

export function HistoryTab({
	sessions,
	timed,
}: {
	sessions: Insight["sessions"] | undefined;
	/** A hold: the count is seconds. */
	timed: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const copy = t.exercises.detail;
	if (sessions === undefined) {
		return <SkeletonBlock height={40} />;
	}

	if (sessions.length === 0) {
		return (
			<View style={styles.empty}>
				<AppText variant="heading" style={{ color: colors.textMuted }}>
					{copy.nothingLogged}
				</AppText>
				<AppText variant="caption" style={styles.centeredText}>
					{copy.nothingLoggedHint}
				</AppText>
			</View>
		);
	}

	return (
		<View style={styles.historyList}>
			{sessions.map((session) => (
				<View key={session.sessionId} style={styles.session}>
					<View style={styles.sessionHead}>
						<AppText
							variant="label"
							numberOfLines={1}
							style={[styles.flex, { color: colors.textMuted }]}
						>
							{[
								dayLabel(session.date, copy.today, (time) =>
									formatSessionDate(time, locale),
								),
								session.name,
							]
								.filter(Boolean)
								.join(" · ")}
						</AppText>
						{session.best !== null ? (
							<AppText
								variant="label"
								style={[styles.tabular, { color: colors.textMuted }]}
							>
								{fmt(copy.sessionBest, { value: Math.round(session.best) })}
							</AppText>
						) : null}
					</View>
					<View style={styles.sessionCard}>
						{session.rows.map((row, index) => {
							const load = timed
								? `${row.reps} s`
								: `${formatKg(row.weight, locale, 2)}${row.unit === "lbs" ? " lbs" : ""} × ${row.reps}`;
							const kind =
								row.setType === "working"
									? row.rpe !== null
										? `RPE ${formatKg(row.rpe, locale)}`
										: ""
									: t.strength[row.setType as "warmup" | "drop" | "failure"];
							const estimate =
								row.estimate !== null ? `≈ ${Math.round(row.estimate)}` : "—";
							return (
								<View
									key={row.id}
									accessible
									accessibilityLabel={spokenSet(
										{
											number: index + 1,
											timed,
											weight: row.weight,
											unit: row.unit,
											reps: row.reps,
											setType: row.setType,
											rpe: row.setType === "working" ? row.rpe : null,
											estimateKg: row.estimate,
											note: row.notes,
										},
										t.strength,
										locale,
									)}
									style={index > 0 && styles.historyLine}
								>
									<View style={styles.historyRow}>
										<AppText
											variant="label"
											style={[styles.setNumber, { color: colors.textMuted }]}
										>
											{index + 1}
										</AppText>
										<AppText
											variant="row"
											style={[styles.flex, styles.tabular]}
										>
											{load}
										</AppText>
										<AppText
											variant="footnote"
											style={{ color: colors.textMuted }}
										>
											{kind}
										</AppText>
										<AppText
											variant="row"
											style={[
												styles.estimate,
												styles.tabular,
												{ color: row.record ? colors.accentInk : colors.text },
											]}
										>
											{estimate}
										</AppText>
									</View>
									<RowNote note={row.notes} style={styles.historyNote} />
								</View>
							);
						})}
					</View>
				</View>
			))}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			flexGrow: 1,
			padding: spacing.md,
			gap: spacing.sm,
			paddingBottom: spacing.xxl,
		},
		centered: {
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
		},
		centeredText: { textAlign: "center" },
		header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
		flex: { flex: 1 },
		meta: { textTransform: "capitalize" },
		chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
		ormCard: {
			gap: spacing.sm,
			padding: spacing.md,
			backgroundColor: colors.surface,
			borderRadius: 24,
			borderCurve: "continuous",
			borderWidth: 1,
			borderColor: colors.border,
		},
		levelCard: { gap: spacing.xs },
		iconTile: {
			width: 64,
			height: 64,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 18,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
		},
		tile: {
			flex: 1,
			minWidth: 0,
			gap: 2,
			paddingVertical: spacing.sm + 2,
			paddingHorizontal: spacing.sm + 4,
			backgroundColor: colors.surface,
			borderRadius: 20,
			borderCurve: "continuous",
			borderWidth: 1,
			borderColor: colors.border,
		},
		sectionLabel: { paddingHorizontal: spacing.xs, paddingTop: spacing.sm },
		ormValue: {
			fontSize: type.display.fontSize,
			fontWeight: "800",
			color: colors.text,
		},
		ormUnit: {
			fontSize: type.body.fontSize,
			fontWeight: "700",
			color: colors.textMuted,
		},
		statRow: { flexDirection: "row", gap: spacing.sm },
		tabular: { fontVariant: ["tabular-nums"] },
		ormHead: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		trend: {
			minHeight: 28,
			paddingHorizontal: 10,
			borderRadius: radius.pill,
			justifyContent: "center",
		},
		levelBar: { flexDirection: "row", gap: 4 },
		levelCell: { flex: 1, minWidth: 0, gap: 4, alignItems: "center" },
		levelFill: { alignSelf: "stretch", height: 8, borderRadius: 4 },
		canLift: {
			flexDirection: "row",
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		profileRow: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		canLiftCell: {
			flex: 1,
			minWidth: 0,
			alignItems: "center",
			gap: 2,
			paddingVertical: spacing.sm + 2,
		},
		canLiftLine: {
			borderLeftWidth: StyleSheet.hairlineWidth,
			borderLeftColor: colors.separator,
		},
		session: { gap: spacing.xs },
		sessionHead: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.xs,
		},
		sessionCard: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		historyLine: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		setNumber: { width: 20 },
		historyNote: {
			paddingLeft: spacing.md - 2 + 20 + spacing.sm,
			paddingRight: spacing.md - 2,
			paddingBottom: spacing.sm,
		},
		estimate: { minWidth: 56, textAlign: "right", fontWeight: "700" },
		instructions: { gap: spacing.sm },
		step: { color: colors.textMuted },
		empty: { alignItems: "center", gap: 4, paddingVertical: spacing.xl },
		historyList: { gap: spacing.md },
		historyHead: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.xs,
			paddingHorizontal: spacing.xs,
			paddingBottom: spacing.xs,
		},
		th: {
			fontSize: type.axis.fontSize,
			fontWeight: "800",
			letterSpacing: 0.5,
			textTransform: "uppercase",
			color: colors.textFaint,
		},
		center: { textAlign: "center" },
		historyRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 44,
			paddingHorizontal: spacing.md - 2,
		},
		historyDate: { color: colors.text, fontWeight: "600" },
		historyType: { textTransform: "capitalize" },
		td: {
			fontSize: type.footnote.fontSize,
			fontWeight: "700",
			color: colors.text,
		},
	});
