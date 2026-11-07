/** A repeating set group in the session: rounds, or as many as possible on a clock. */
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { formatClock, formatScore, formatSetShort } from "../session-format";
import {
	amrapScore,
	type GroupRound,
	groupExercises,
	nextOpenRow,
	type PlanSet,
	type SetGroup,
} from "../session-plan";
import { useSessionScreen } from "../session-screen-context";
import { useClockControls } from "./session-dock";
import { SessionGroupItemRow } from "./session-set-row";

const roundDone = (round: GroupRound) => round.items.every((row) => row.done);
export function useScoreText(group: SetGroup) {
	const { locale, t } = useI18n();
	return formatScore(t.strength.plan.group, locale, amrapScore(group));
}
function RoundSummary({
	title,
	summary,
	open,
	onPress,
}: {
	title: string;
	summary: string;
	open: boolean;
	onPress: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ expanded: open }}
			accessibilityLabel={`${title}, ${summary}`}
			onPress={onPress}
			style={styles.summary}
		>
			<AppText variant="row" style={{ fontWeight: "600" }}>
				{title}
			</AppText>
			<AppText
				variant="secondary"
				numberOfLines={1}
				style={[styles.summaryText, { color: colors.textMuted }]}
			>
				{summary}
			</AppText>
			<SymbolView
				name={open ? "chevron.down" : "chevron.right"}
				size={13}
				tintColor={colors.textFaint}
			/>
		</Pressable>
	);
}
export function SessionGroupBlock({ group }: { group: SetGroup }) {
	const { openGroup, plan, workspace } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan.group;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const clock = useClockControls(group);
	const scoreText = useScoreText(group);
	const amrap = group.mode === "amrap";
	const closed = group.state === "closed";
	const idle = amrap && group.state === "idle";
	const names = groupExercises(group).map(workspace.nameOf);
	const current = group.rounds.findIndex((round) => !roundDone(round));
	const next = nextOpenRow(plan);
	const shortOf = (row: PlanSet) =>
		formatSetShort(row, workspace.getFacts(row.exerciseId).bodyweight, locale);
	const short = (round: GroupRound) =>
		round.items
			.filter((row) => !closed || row.done)
			.map(shortOf)
			.join(" · ");
	const finished = group.rounds
		.map((round, index) => (roundDone(round) && !closed ? index : -1))
		.filter((index) => index >= 0);
	const folded = finished.length >= 2;
	const sub = amrap
		? closed
			? scoreText
			: group.state === "timeup"
				? copy.subAmrapOver
				: idle
					? group.capMinutes === 1
						? copy.subAmrapIdleOne
						: fmt(copy.subAmrapIdle, { minutes: group.capMinutes })
					: fmt(copy.subAmrapRunning, {
							round: Math.max(current, 0) + 1,
						})
		: current < 0
			? copy.subAllDone
			: group.restSeconds > 0
				? fmt(copy.subRounds, {
						current: current + 1,
						total: group.rounds.length,
						rest: formatClock(group.restSeconds),
					})
				: fmt(copy.subRoundsNoRest, {
						current: current + 1,
						total: group.rounds.length,
					});
	const toggle = (id: string) =>
		setExpanded((value) => ({ ...value, [id]: !value[id] }));
	const lines: React.ReactNode[] = [];
	group.rounds.forEach((round, index) => {
		const open = Boolean(expanded[round.id]);
		const number = index + 1;
		const rows = (highlight: boolean) =>
			round.items.map((row) => (
				<SessionGroupItemRow
					key={row.id}
					row={row}
					round={number}
					isNext={highlight && next?.id === row.id}
				/>
			));
		if (folded && index === finished[0])
			lines.push(
				<RoundSummary
					key="fold"
					title={fmt(copy.foldDone, {
						range: `${(finished[0] as number) + 1}–${(finished.at(-1) as number) + 1}`,
					})}
					summary=""
					open={Boolean(expanded.fold)}
					onPress={() => toggle("fold")}
				/>,
			);
		if (roundDone(round) || closed) {
			if (folded && !closed && !expanded.fold) return;
			lines.push(
				<RoundSummary
					key={round.id}
					title={`${fmt(copy.clockRound, { round: number })}`}
					summary={short(round)}
					open={open}
					onPress={() => toggle(round.id)}
				/>,
			);
			if (open) lines.push(...rows(false));
		} else if (index === current || round.items.some((row) => row.done)) {
			lines.push(...rows(index === current && !idle));
		} else {
			lines.push(
				<RoundSummary
					key={round.id}
					title={fmt(copy.clockRound, { round: number })}
					summary={short(round)}
					open={open}
					onPress={() => toggle(round.id)}
				/>,
			);
			if (open) lines.push(...rows(false));
		}
	});
	return (
		<View style={styles.block}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${copy.openSheet}: ${names.join(", ")}`}
				onPress={() => openGroup(group.id)}
				style={styles.head}
			>
				<View style={styles.headText}>
					<AppText variant="title" accessibilityRole="header">
						{amrap
							? copy.headAmrap
							: fmt(copy.head, { rounds: group.rounds.length })}
					</AppText>
					<AppText variant="secondary" style={{ color: colors.textMuted }}>
						{sub}
					</AppText>
				</View>
				<SymbolView
					name="slider.horizontal.3"
					size={18}
					tintColor={colors.textMuted}
				/>
			</Pressable>
			<View style={styles.card}>
				{lines}
				{clock.map((action) => (
					<Pressable
						key={action.label}
						accessibilityRole="button"
						onPress={action.onPress}
						style={styles.clockAction}
					>
						<AppText variant="control" style={styles.link}>
							{action.label}
						</AppText>
					</Pressable>
				))}
			</View>
		</View>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		block: { gap: spacing.sm },
		head: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.xs,
			minHeight: 44,
		},
		headText: { flex: 1, minWidth: 0, gap: 2 },
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		summary: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: 48,
			paddingHorizontal: spacing.md,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		summaryText: { flex: 1, minWidth: 0, textAlign: "right" },
		link: { color: colors.accent, fontWeight: "600" },
		clockAction: {
			minHeight: 52,
			alignItems: "center",
			justifyContent: "center",
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
	});
