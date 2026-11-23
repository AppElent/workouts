/**
 * The "Now" card at the bottom of the session (APP-619 canvas, round 2): the
 * next set, big, with one Log button; for an ad-hoc exercise two steppers and
 * an Exercise button; while resting the countdown with the next set under it.
 * It replaces the rest pill for solo exercises; groups keep their own UI.
 */
import { formatClock } from "@foundry/core";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { fmt, useI18n } from "../../../i18n";
import {
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";
import { previousSetOf } from "../data/previous-session";
import { useRestState, useRestTimer } from "../data/rest-timer";
import { formatNumber, formatSetFull, formatSetShort } from "../session-format";
import {
	addSet,
	findRow,
	groupOfRow,
	loadStep,
	nextOpenRow,
	type PlanSet,
	REST_STEP_SECONDS,
	repeatSetOf,
	rowsOf,
	type SessionPlan,
	shownLoad,
	stepLoad,
	updateRow,
} from "../session-plan";
import { useSessionScreen } from "../session-screen-context";

/** The next open solo set and where it sits among its exercise's sets. */
export function nowSet(plan: SessionPlan) {
	const row = nextOpenRow(plan);
	if (!row || groupOfRow(plan, row.id)) return null;
	const warmup = row.kind === "warmup";
	const rows = rowsOf(plan, row.exerciseId);
	const working = rows.filter((item) => item.kind !== "warmup");
	// Its place among sets of its own kind: a warm-up is warm-up 1, 2, …
	const same = warmup ? rows.filter((item) => item.kind === "warmup") : working;
	const index = same.findIndex((item) => item.id === row.id);
	return {
		row,
		warmup,
		number: index + 1,
		total: working.length,
	};
}

export type NowTarget = NonNullable<ReturnType<typeof nowSet>> & {
	/** Not in the plan yet: the next set of an ad-hoc exercise, added on first touch. */
	draft: boolean;
};
/**
 * What the card offers: the next open set, or, once a free exercise has no
 * open set left, one more like its last work set. Planned exercises don't get
 * extra sets offered, so a finished plan leaves the card away.
 */
export function nowTarget(plan: SessionPlan): NowTarget | null {
	const now = nowSet(plan);
	if (now) return { ...now, draft: false };
	const repeat = repeatSetOf(plan);
	if (!repeat) return null;
	const { template, number } = repeat;
	return {
		// Its own id: the template is a logged row that must stay untouched.
		row: {
			...template,
			id: `draft:${template.id}`,
			kind: "working",
			done: false,
			setId: undefined,
			setNumber: undefined,
			attempt: undefined,
		},
		warmup: false,
		number,
		total: number,
		draft: true,
	};
}

/** A phone the size of an iPhone SE: the canvas shrinks the big numbers. */
export const useCompactPhone = () => useWindowDimensions().height < 700;
const useLarge = () => useWindowDimensions().fontScale >= 1.35;

/** The floating card the dock shows: chrome ground, 28pt corners, a shadow. */
export function DockCard({ children }: { children: ReactNode }) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.shadow}>
			<GlassSurface cornerRadius={28} tint={colors.dock} style={styles.card}>
				<View style={styles.inner}>{children}</View>
			</GlassSurface>
		</View>
	);
}

function RestRing({ remaining, total }: { remaining: number; total: number }) {
	const colors = useTokens();
	const large = useLarge();
	const compact = useCompactPhone();
	const size = large ? 64 : compact ? 76 : 92;
	const stroke = 8;
	const r = (size - stroke) / 2;
	const circumference = 2 * Math.PI * r;
	const share = total > 0 ? Math.min(1, remaining / total) : 0;
	return (
		<View style={{ width: size, height: size }}>
			<Svg
				width={size}
				height={size}
				style={StyleSheet.absoluteFill}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					stroke={colors.surface2}
					strokeWidth={stroke}
					fill="none"
				/>
				<Circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					stroke={colors.accentFill}
					strokeWidth={stroke}
					strokeLinecap="round"
					fill="none"
					strokeDasharray={`${circumference} ${circumference}`}
					strokeDashoffset={circumference * (1 - share)}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</Svg>
			<View style={[StyleSheet.absoluteFill, ringCenter]}>
				<AppText
					variant={large ? "heading" : compact ? "title" : "metric"}
					style={{ fontVariant: ["tabular-nums"] }}
				>
					{formatClock(remaining)}
				</AppText>
			</View>
		</View>
	);
}
const ringCenter = { alignItems: "center", justifyContent: "center" } as const;

export function NowCard() {
	const {
		plan,
		workspace,
		actions,
		openEditor,
		openPicker,
		toggleRow,
		previousSets,
	} = useSessionScreen();
	const rest = useRestState();
	const timer = useRestTimer();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.now;
	const restCopy = t.strength.plan.rest;
	const editorCopy = t.strength.plan.editor;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const large = useLarge();
	const compact = useCompactPhone();
	const now = nowTarget(plan);
	if (!now) return null;
	const { row } = now;
	const facts = workspace.getFacts(row.exerciseId);
	/** The row to act on: a draft joins the plan on first touch. */
	const materialize = () => {
		if (!now.draft) return row.id;
		// A second press before the re-render must not add a second set.
		const open = nextOpenRow(actions.plan());
		if (open?.exerciseId === row.exerciseId) return open.id;
		const result = addSet(actions.plan(), row.exerciseId, facts);
		actions.set(result.plan);
		return result.rowId;
	};
	const edit = (map: (current: PlanSet) => PlanSet) => {
		const id = materialize();
		const current = findRow(actions.plan(), id);
		if (current) actions.set(updateRow(actions.plan(), id, map(current)));
	};
	const adhoc = now.draft || !row.plan;
	const locked = Boolean(row.attempt) || !workspace.writable;
	const countStep = facts.timed ? 5 : 1;
	const name = workspace.nameOf(row.exerciseId);
	const setText = formatSetFull(row, facts, locale);
	const short = (set: { kg: number; reps: number }) =>
		formatSetShort({ ...set, unit: row.unit }, facts, locale);
	const previous =
		(previousSets
			? previousSetOf(previousSets, row.exerciseId, now.number, now.warmup)
			: null) ?? (now.warmup ? null : facts.last);
	const logLabel = now.warmup
		? copy.logWarmup
		: fmt(copy.log, { number: now.number });
	const logButton = (
		<LogButton
			label={logLabel}
			disabled={!workspace.writable}
			onPress={() => toggleRow(materialize())}
			flex={rest.running || adhoc}
			height={rest.running ? 52 : 56}
		/>
	);
	if (rest.running) {
		const total = Math.max(plan.restDefault, rest.remaining);
		const then = now.warmup
			? copy.thenWarmup
			: now.draft
				? fmt(copy.adhocSet, { number: now.number })
				: fmt(copy.nextUp, { number: now.number, total: now.total });
		const line = fmt(copy.restLine, {
			name,
			load: formatSetShort(row, facts, locale),
		});
		return (
			<DockCard>
				<View
					style={styles.restRow}
					accessible
					accessibilityRole="timer"
					accessibilityActions={[{ name: "stop", label: restCopy.stop }]}
					onAccessibilityAction={(event) => {
						if (event.nativeEvent.actionName === "stop") timer.stop();
					}}
					testID="session-rest-timer"
					accessibilityLabel={[
						rest.over
							? copy.restOver
							: fmt(copy.spokenRest, { time: formatClock(rest.remaining) }),
						then,
						`${name} · ${setText}`,
					].join(", ")}
				>
					{rest.over ? null : (
						<RestRing remaining={rest.remaining} total={total} />
					)}
					<View style={styles.restText}>
						<AppText variant="overline" style={{ color: colors.accentInk }}>
							{rest.over
								? copy.restOver
								: fmt(copy.restOf, { time: formatClock(total) })}
						</AppText>
						<AppText variant="body" style={styles.mutedStrong}>
							{then}
						</AppText>
						<AppText
							variant="stat"
							numberOfLines={large ? undefined : 2}
							style={styles.tabular}
						>
							{line}
						</AppText>
					</View>
				</View>
				<View style={styles.actions}>
					<RoundButton
						label={`−${REST_STEP_SECONDS}`}
						spoken={fmt(restCopy.subtract, { seconds: REST_STEP_SECONDS })}
						disabled={rest.over}
						onPress={() => timer.adjust(-REST_STEP_SECONDS)}
					/>
					<RoundButton
						label={`+${REST_STEP_SECONDS}`}
						spoken={fmt(restCopy.add, { seconds: REST_STEP_SECONDS })}
						onPress={() => timer.adjust(REST_STEP_SECONDS)}
					/>
					{logButton}
				</View>
			</DockCard>
		);
	}
	if (adhoc) {
		const template = rowsOf(plan, row.exerciseId)
			.filter((item) => item.done && item.kind !== "warmup")
			.at(-1);
		const last = template
			? [
					fmt(copy.previousSet, { load: short(template) }),
					template.rpe === null
						? null
						: fmt(copy.rpe, { value: formatNumber(template.rpe, locale, 1) }),
				]
					.filter(Boolean)
					.join(" · ")
			: previous
				? `${copy.lastTime} ${short(previous)}`
				: null;
		const stepText = formatNumber(loadStep(row.unit, facts.stepKg), locale);
		const steppers = !large && !facts.bodyweight && !facts.timed;
		return (
			<DockCard>
				<View style={[styles.labelRow, large && styles.labelRowLarge]}>
					<AppText
						variant="overline"
						numberOfLines={1}
						style={[styles.flexText, { color: colors.accentInk }]}
					>
						{now.warmup
							? copy.nextWarmup
							: fmt(copy.adhocLabel, { number: now.number, name })}
					</AppText>
					{last ? (
						<AppText variant="caption" style={styles.previous}>
							{last}
						</AppText>
					) : null}
				</View>
				{steppers ? (
					<View style={styles.steppers}>
						<Stepper
							value={formatNumber(
								shownLoad(row),
								locale,
								row.unit === "lbs" ? 1 : 2,
							)}
							unit={row.unit}
							spokenValue={setText}
							less={fmt(editorCopy.stepDown, { step: stepText })}
							more={fmt(editorCopy.stepUp, { step: stepText })}
							disabled={locked}
							onLess={() => edit((current) => stepLoad(current, -1, facts))}
							onMore={() => edit((current) => stepLoad(current, 1, facts))}
							testID="session-now-load"
						/>
						<Stepper
							value={String(row.reps)}
							unit={editorCopy.reps}
							less={editorCopy.repsDown}
							more={editorCopy.repsUp}
							disabled={locked}
							lessDisabled={row.reps <= 1}
							onLess={() =>
								edit((current) => ({
									...current,
									reps: Math.max(1, current.reps - countStep),
								}))
							}
							onMore={() =>
								edit((current) => ({
									...current,
									reps: current.reps + countStep,
									blank: undefined,
								}))
							}
							testID="session-now-reps"
						/>
					</View>
				) : (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={
							now.warmup
								? copy.editWarmup
								: fmt(copy.edit, { number: now.number })
						}
						onPress={() => openEditor(materialize())}
						testID="session-now-edit"
					>
						<AppText
							variant={large ? "title" : compact ? "valueSmall" : "valueMedium"}
							numberOfLines={large ? undefined : 1}
							adjustsFontSizeToFit={!large}
							style={styles.tabular}
						>
							{setText}
						</AppText>
					</Pressable>
				)}
				<View style={[styles.actions, large && styles.actionsLarge]}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.spokenOther}
						accessibilityState={{ disabled: !workspace.online }}
						disabled={!workspace.online}
						onPress={() => openPicker({ mode: "add" })}
						style={[styles.other, !workspace.online && styles.off]}
						testID="session-now-other"
					>
						<SymbolView
							name="plus"
							size={16}
							weight="bold"
							tintColor={colors.text}
							fallback={<AppText variant="control">+</AppText>}
						/>
						<AppText variant="control">{copy.otherExercise}</AppText>
					</Pressable>
					{logButton}
				</View>
			</DockCard>
		);
	}
	const plain = facts.bodyweight || facts.timed || large;
	const bigVariant = compact ? "valueSmall" : "valueMedium";
	return (
		<DockCard>
			<View style={styles.head}>
				<View style={styles.headText}>
					<AppText variant="overline" style={{ color: colors.accentInk }}>
						{now.warmup
							? copy.nextWarmup
							: fmt(copy.nextSet, { number: now.number, total: now.total })}
					</AppText>
					<AppText
						variant="body"
						numberOfLines={large ? undefined : 1}
						style={styles.mutedStrong}
					>
						{name}
					</AppText>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={
						now.warmup
							? copy.editWarmup
							: fmt(copy.edit, { number: now.number })
					}
					onPress={() => openEditor(materialize())}
					style={styles.edit}
					testID="session-now-edit"
				>
					<SymbolView
						name="pencil"
						size={17}
						weight="semibold"
						tintColor={colors.text}
						fallback={<AppText variant="control">✎</AppText>}
					/>
				</Pressable>
			</View>
			<View
				style={[styles.bigRow, large && styles.bigRowLarge]}
				accessible
				accessibilityLabel={[
					setText,
					previous ? `${copy.lastTime} ${short(previous)}` : null,
				]
					.filter(Boolean)
					.join(", ")}
			>
				{plain ? (
					<AppText
						variant={large ? "title" : bigVariant}
						numberOfLines={large ? undefined : 1}
						adjustsFontSizeToFit={!large}
						style={[styles.tabular, styles.flexText]}
					>
						{setText}
					</AppText>
				) : (
					<View style={styles.bigLoad}>
						<AppText variant={bigVariant} style={styles.tabular}>
							{formatNumber(shownLoad(row), locale, row.unit === "lbs" ? 1 : 2)}
							<AppText variant="stat" style={styles.unit}>
								{` ${row.unit}`}
							</AppText>
						</AppText>
						<AppText variant="metric" style={styles.times}>
							×
						</AppText>
						<AppText variant={bigVariant} style={styles.tabular}>
							{String(row.reps)}
						</AppText>
					</View>
				)}
				{previous ? (
					<View style={styles.lastTime}>
						<AppText variant="footnote" style={styles.lastTimeText}>
							{copy.lastTime}
						</AppText>
						<AppText variant="footnote" style={styles.lastTimeValue}>
							{short(previous)}
						</AppText>
					</View>
				) : null}
			</View>
			{logButton}
		</DockCard>
	);
}

function Stepper({
	value,
	unit,
	spokenValue,
	less,
	more,
	disabled,
	lessDisabled,
	onLess,
	onMore,
	testID,
}: {
	value: string;
	unit: string;
	spokenValue?: string;
	less: string;
	more: string;
	disabled: boolean;
	lessDisabled?: boolean;
	onLess: () => void;
	onMore: () => void;
	testID: string;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const compact = useCompactPhone();
	const step = (
		label: string,
		glyph: string,
		off: boolean,
		onPress: () => void,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: off }}
			disabled={off}
			onPress={onPress}
			style={({ pressed }) => [
				styles.stepButton,
				(pressed || off) && { opacity: off ? 0.4 : 0.7 },
			]}
		>
			<AppText variant="stat" style={styles.stepGlyph}>
				{glyph}
			</AppText>
		</Pressable>
	);
	return (
		<View style={styles.stepper} testID={testID}>
			{step(less, "−", disabled || Boolean(lessDisabled), onLess)}
			<View
				style={styles.stepValue}
				accessible
				accessibilityLabel={spokenValue ?? `${value} ${unit}`}
			>
				<AppText
					variant={compact ? "metric" : "display"}
					numberOfLines={1}
					adjustsFontSizeToFit
					style={styles.tabular}
				>
					{value}
				</AppText>
				<AppText variant="eyebrow" style={{ color: colors.textMuted }}>
					{unit}
				</AppText>
			</View>
			{step(more, "+", disabled, onMore)}
		</View>
	);
}

function LogButton({
	label,
	disabled,
	onPress,
	flex,
	height,
}: {
	label: string;
	disabled: boolean;
	onPress: () => void;
	flex: boolean;
	height: number;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.log,
				{ minHeight: height, borderRadius: height / 2 },
				flex && styles.logFlex,
				{ backgroundColor: colors.accentFill },
				(pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
			]}
			testID="session-now-log"
		>
			<SymbolView
				name="checkmark"
				size={18}
				weight="bold"
				tintColor={colors.onAccent}
				fallback={null}
			/>
			<AppText variant="heading" style={styles.logText}>
				{label}
			</AppText>
		</Pressable>
	);
}

function RoundButton({
	label,
	spoken,
	disabled,
	onPress,
}: {
	label: string;
	spoken: string;
	disabled?: boolean;
	onPress: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={spoken}
			accessibilityState={{ disabled: Boolean(disabled) }}
			disabled={disabled}
			onPress={onPress}
			style={styles.round}
		>
			<AppText
				variant="control"
				style={[
					styles.tabular,
					styles.bold,
					{ color: disabled ? colors.textFaint : colors.text },
				]}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		shadow: {
			borderRadius: 28,
			shadowColor: "#000000",
			shadowOpacity: 0.22,
			shadowRadius: 16,
			shadowOffset: { width: 0, height: -8 },
		},
		card: {
			overflow: "hidden",
			// The iOS glass draws its own shape; the border needs the same one.
			borderRadius: 28,
			borderCurve: "continuous",
			borderWidth: 1,
			borderColor: colors.borderStrong,
		},
		inner: { padding: 14, gap: spacing.md - 4 },
		head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
		headText: { flex: 1, minWidth: 0, gap: 2, paddingLeft: spacing.xs },
		mutedStrong: { color: colors.textMuted, fontWeight: "600" },
		edit: {
			width: 44,
			height: 44,
			marginTop: -6,
			marginRight: -6,
			borderRadius: 22,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
		bigRow: {
			flexDirection: "row",
			alignItems: "flex-end",
			gap: 10,
			paddingHorizontal: spacing.xs,
		},
		bigRowLarge: { flexDirection: "column", alignItems: "flex-start" },
		bigLoad: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "baseline",
			gap: 10,
		},
		unit: { color: colors.textMuted, fontWeight: "700" },
		times: { color: colors.textMuted, fontWeight: "700" },
		lastTime: { alignItems: "flex-end", paddingBottom: 2 },
		lastTimeText: { color: colors.textMuted, textAlign: "right" },
		lastTimeValue: {
			color: colors.text,
			fontWeight: "700",
			fontVariant: ["tabular-nums"],
		},
		flexText: { flex: 1, minWidth: 0 },
		labelRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: spacing.sm,
			paddingHorizontal: spacing.xs,
		},
		labelRowLarge: { flexDirection: "column", alignItems: "flex-start" },
		previous: {
			color: colors.textMuted,
			fontWeight: "600",
			fontVariant: ["tabular-nums"],
		},
		off: { opacity: 0.5 },
		steppers: { flexDirection: "row", gap: spacing.sm },
		stepper: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 4,
			padding: 6,
			borderRadius: 20,
			borderCurve: "continuous",
			backgroundColor: colors.surface2,
		},
		stepButton: {
			width: 44,
			height: 44,
			borderRadius: 22,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface3,
		},
		stepGlyph: { fontWeight: "600" },
		stepValue: { flex: 1, minWidth: 0, alignItems: "center" },
		tabular: { fontVariant: ["tabular-nums"] },
		bold: { fontWeight: "700" },
		log: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
		},
		logFlex: { flex: 1 },
		logText: { color: colors.onAccent },
		other: {
			minHeight: 56,
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			paddingHorizontal: spacing.md,
			borderRadius: 28,
			backgroundColor: colors.surface2,
		},
		restRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md - 2,
			paddingHorizontal: spacing.xs,
		},
		restText: { flex: 1, minWidth: 0, gap: 4 },
		actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		actionsLarge: { flexDirection: "column", alignItems: "stretch" },
		round: {
			minWidth: 64,
			minHeight: 52,
			borderRadius: 26,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
	});
