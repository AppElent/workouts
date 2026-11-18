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
import { formatSetFull, formatSetShort } from "../session-format";
import {
	groupOfRow,
	nextOpenRow,
	REST_STEP_SECONDS,
	rowsOf,
	type SessionPlan,
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
	const { plan, workspace, openEditor, toggleRow } = useSessionScreen();
	const rest = useRestState();
	const timer = useRestTimer();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.now;
	const restCopy = t.strength.plan.rest;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const large = useWindowDimensions().fontScale >= 1.35;
	const now = nowSet(plan);
	if (!now) return null;
	const { row } = now;
	const facts = workspace.getFacts(row.exerciseId);
	const name = workspace.nameOf(row.exerciseId);
	const setText = formatSetFull(row, facts, locale);
	const last = facts.last
		? formatSetShort(
				{ kg: facts.last.kg, reps: facts.last.reps, unit: "kg" },
				facts,
				locale,
			)
		: null;
	const logLabel = now.warmup
		? copy.logWarmup
		: fmt(copy.log, { number: now.number });
	const logButton = (
		<LogButton
			label={logLabel}
			disabled={!workspace.writable}
			onPress={() => toggleRow(row.id)}
			flex={rest.running}
		/>
	);
	if (rest.running) {
		const total = Math.max(plan.restDefault, rest.remaining);
		const then = now.warmup
			? copy.thenWarmup
			: fmt(copy.nextUp, { number: now.number, total: now.total });
		return (
			<GlassSurface
				cornerRadius={radius.contentCard}
				tint={rest.over ? colors.accentDim : undefined}
				style={styles.card}
			>
				<View style={styles.inner}>
					<View
						style={styles.restRow}
						accessible
						accessibilityRole="timer"
						accessibilityLabel={
							rest.over
								? copy.restOver
								: fmt(copy.spokenRest, { time: formatClock(rest.remaining) })
						}
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
								variant="heading"
								numberOfLines={large ? undefined : 2}
								style={styles.tabular}
							>
								{`${name} · ${setText}`}
							</AppText>
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
	return (
		<GlassSurface cornerRadius={radius.contentCard} style={styles.card}>
			<View style={styles.inner}>
				<View style={styles.head}>
					<View style={styles.headText}>
						<AppText variant="eyebrow" style={{ color: colors.accent }}>
							{now.warmup
								? copy.nextWarmup
								: fmt(copy.nextSet, { number: now.number, total: now.total })}
						</AppText>
						<AppText
							variant="label"
							numberOfLines={1}
							style={{ color: colors.textMuted }}
						>
							{name}
						</AppText>
					</View>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={fmt(copy.edit, { number: now.number })}
						onPress={() => openEditor(row.id)}
						style={styles.edit}
						testID="session-now-edit"
					>
						<SymbolView
							name="pencil"
							size={17}
							weight="semibold"
							tintColor={colors.text}
						/>
					</Pressable>
				</View>
				<View style={styles.loadRow}>
					<AppText
						variant={large ? "title" : "quantityCompact"}
						numberOfLines={1}
						adjustsFontSizeToFit
						style={[styles.load, styles.tabular]}
					>
						{setText}
					</AppText>
					{last ? (
						<View style={styles.last}>
							<AppText variant="caption" style={{ color: colors.textMuted }}>
								{copy.lastTime}
							</AppText>
							<AppText variant="label" style={styles.tabular}>
								{last}
							</AppText>
						</View>
					) : null}
				</View>
				{logButton}
			</View>
		</GlassSurface>
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
		loadRow: {
			flexDirection: "row",
			alignItems: "flex-end",
			gap: spacing.sm,
			paddingHorizontal: spacing.xs,
		},
		load: { flex: 1, minWidth: 0, fontWeight: "800" },
		last: { alignItems: "flex-end", paddingBottom: 4 },
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
