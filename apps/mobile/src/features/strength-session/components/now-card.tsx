/**
 * The "Now" card at the bottom of the session (APP-255): the next set, big,
 * with one Log button, and while resting the countdown with the next set under
 * it. It replaces the rest pill for solo exercises; groups keep their own UI.
 */
import { formatClock } from "@foundry/core";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";
import { useRestState, useRestTimer } from "../data/rest-timer";
import { formatNumber, formatSetFull, formatSetShort } from "../session-format";
import {
	addSet,
	addSetTemplate,
	findRow,
	groupOfRow,
	loadStep,
	nextOpenRow,
	type PlanSet,
	REST_STEP_SECONDS,
	rowsOf,
	runningGroup,
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
	const working = rowsOf(plan, row.exerciseId).filter(
		(item) => item.kind !== "warmup",
	);
	const index = working.findIndex((item) => item.id === row.id);
	return {
		row,
		warmup: row.kind === "warmup",
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
	if (runningGroup(plan)) return null;
	const entry = plan.order.at(-1);
	if (entry?.kind !== "exercise") return null;
	const rows = plan.sets[entry.exerciseId] ?? [];
	if (!rows.some((row) => row.done) || rows.some((row) => row.plan))
		return null;
	const template = addSetTemplate(rows);
	if (!template) return null;
	const number = rows.filter((row) => row.kind !== "warmup").length + 1;
	return {
		row: { ...template, kind: "working", done: false },
		warmup: false,
		number,
		total: number,
		draft: true,
	};
}

const RING = 84;
const RING_LARGE = 64;

function RestRing({ remaining, total }: { remaining: number; total: number }) {
	const colors = useTokens();
	const large = useWindowDimensions().fontScale >= 1.35;
	const size = large ? RING_LARGE : RING;
	const stroke = 7;
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
					stroke={colors.accent}
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
					variant={large ? "heading" : "metric"}
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
	const { plan, workspace, actions, openEditor, openPicker, toggleRow } =
		useSessionScreen();
	const rest = useRestState();
	const timer = useRestTimer();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.now;
	const restCopy = t.strength.plan.rest;
	const editorCopy = t.strength.plan.editor;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const large = useWindowDimensions().fontScale >= 1.35;
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
	const locked = Boolean(row.attempt) || !workspace.writable;
	const countStep = facts.timed ? 5 : 1;
	const steppers = !large && !facts.bodyweight && !facts.timed;
	const name = workspace.nameOf(row.exerciseId);
	const setText = formatSetFull(row, facts, locale);
	const last = facts.last
		? formatSetShort(
				{ kg: facts.last.kg, reps: facts.last.reps, unit: row.unit },
				facts,
				locale,
			)
		: null;
	const logLabel = now.warmup
		? copy.logWarmup
		: fmt(copy.log, { number: now.number });
	const eyebrow = now.warmup
		? copy.nextWarmup
		: now.draft
			? fmt(copy.adhocSet, { number: now.number })
			: fmt(copy.nextSet, { number: now.number, total: now.total });
	const logButton = (
		<LogButton
			label={logLabel}
			disabled={!workspace.writable}
			onPress={() => toggleRow(materialize())}
			flex={rest.running}
		/>
	);
	if (rest.running) {
		const total = Math.max(plan.restDefault, rest.remaining);
		const then = now.warmup
			? copy.thenWarmup
			: now.draft
				? fmt(copy.adhocSet, { number: now.number })
				: fmt(copy.nextUp, { number: now.number, total: now.total });
		return (
			<GlassSurface
				cornerRadius={radius.contentCard}
				tint={rest.over ? colors.accentDim : undefined}
				style={styles.card}
			>
				<View style={styles.inner}>
					<View style={styles.restRow}>
						<View
							style={styles.restInfo}
							accessible
							accessibilityRole="timer"
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
								<AppText variant="eyebrow" style={{ color: colors.accent }}>
									{rest.over
										? copy.restOver
										: fmt(copy.restOf, { time: formatClock(total) })}
								</AppText>
								<AppText variant="label" style={{ color: colors.textMuted }}>
									{then}
								</AppText>
								<AppText
									variant="label"
									numberOfLines={large ? undefined : 1}
									style={{ color: colors.textMuted }}
								>
									{name}
								</AppText>
								<AppText
									variant="heading"
									numberOfLines={large ? undefined : 1}
									adjustsFontSizeToFit={!large}
									style={styles.tabular}
								>
									{setText}
								</AppText>
							</View>
						</View>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={restCopy.stop}
							onPress={timer.stop}
							style={styles.stop}
							testID="session-rest-stop"
						>
							<SymbolView
								name="xmark"
								size={15}
								weight="semibold"
								tintColor={colors.textMuted}
								fallback={<AppText variant="control">✕</AppText>}
							/>
						</Pressable>
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
				</View>
			</GlassSurface>
		);
	}
	const stepText = formatNumber(loadStep(row.unit, facts.stepKg), locale);
	return (
		<GlassSurface cornerRadius={radius.contentCard} style={styles.card}>
			<View style={styles.inner}>
				<View style={styles.head}>
					<View style={styles.headText}>
						<AppText variant="eyebrow" style={{ color: colors.accent }}>
							{eyebrow}
						</AppText>
						<AppText
							variant="label"
							numberOfLines={1}
							style={{ color: colors.textMuted }}
						>
							{last ? `${name} · ${copy.lastTime} ${last}` : name}
						</AppText>
					</View>
					{now.draft ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.spokenOther}
							disabled={!workspace.online}
							onPress={() => openPicker({ mode: "add" })}
							style={[styles.pill, !workspace.online && styles.off]}
							testID="session-now-other"
						>
							<AppText variant="label">{copy.otherExercise}</AppText>
						</Pressable>
					) : null}
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={fmt(copy.edit, { number: now.number })}
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
				{steppers ? (
					<View style={styles.steppers}>
						<Stepper
							value={formatNumber(
								shownLoad(row),
								locale,
								row.unit === "lbs" ? 1 : 2,
							)}
							unit={row.unit}
							spokenValue={formatSetFull(row, facts, locale)}
							less={fmt(editorCopy.stepDown, { step: stepText })}
							more={fmt(editorCopy.stepUp, { step: stepText })}
							disabled={locked}
							onLess={() => edit((current) => stepLoad(current, -1, facts))}
							onMore={() => edit((current) => stepLoad(current, 1, facts))}
							testID="session-now-load"
						/>
						<Stepper
							value={String(row.reps)}
							unit={editorCopy.reps.toLocaleLowerCase(locale)}
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
					<AppText
						variant={large ? "title" : "quantityCompact"}
						numberOfLines={large ? undefined : 1}
						adjustsFontSizeToFit={!large}
						style={[styles.load, styles.tabular]}
					>
						{setText}
					</AppText>
				)}
				{logButton}
			</View>
		</GlassSurface>
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
			<AppText variant="heading">{glyph}</AppText>
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
					variant="metric"
					numberOfLines={1}
					adjustsFontSizeToFit
					style={styles.tabular}
				>
					{value}
				</AppText>
				<AppText variant="caption" style={{ color: colors.textMuted }}>
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
}: {
	label: string;
	disabled: boolean;
	onPress: () => void;
	flex: boolean;
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
				flex && styles.logFlex,
				{ backgroundColor: colors.accentFill },
				(pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
			]}
			testID="session-now-log"
		>
			<SymbolView
				name="checkmark"
				size={17}
				weight="bold"
				tintColor={colors.onAccent}
				fallback={null}
			/>
			<AppText variant="control" style={styles.logText}>
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
		card: {
			borderRadius: radius.contentCard,
			overflow: "hidden",
		},
		inner: { padding: spacing.md - 2, gap: spacing.md - 4 },
		head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
		headText: { flex: 1, minWidth: 0, gap: 2, paddingLeft: spacing.xs },
		edit: {
			width: 44,
			height: 44,
			marginTop: -6,
			marginRight: -4,
			borderRadius: 22,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
		load: { fontWeight: "800", paddingHorizontal: spacing.xs },
		pill: {
			minHeight: 44,
			marginTop: -6,
			paddingHorizontal: spacing.md - 4,
			borderRadius: 22,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
		off: { opacity: 0.5 },
		steppers: { flexDirection: "row", gap: spacing.sm },
		stepper: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			padding: 4,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		stepButton: {
			width: 44,
			height: 52,
			borderRadius: radius.lg,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface,
		},
		stepValue: { flex: 1, minWidth: 0, alignItems: "center" },
		tabular: { fontVariant: ["tabular-nums"] },
		log: {
			minHeight: 56,
			borderRadius: radius.pill,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
		},
		logFlex: { flex: 1 },
		logText: { color: colors.onAccent, fontWeight: "700" },
		restRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md - 2,
			paddingHorizontal: spacing.xs,
		},
		restInfo: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md - 2,
		},
		restText: { flex: 1, minWidth: 0, gap: 2 },
		stop: {
			width: 44,
			height: 44,
			alignSelf: "flex-start",
			marginTop: -6,
			marginRight: -6,
			alignItems: "center",
			justifyContent: "center",
		},
		actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		round: {
			minWidth: 64,
			minHeight: 52,
			borderRadius: radius.pill,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
	});
