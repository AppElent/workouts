/** How a set group repeats, its order, its exercises, and how to undo it. */
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { Id } from "../../convex/api";
import { plural, useI18n } from "../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../theme";
import { Segmented } from "../../ui/segmented";
import { AppText } from "../../ui/text";
import { SessionExercisePicker } from "./components/session-exercise-picker";
import { useSessionActions } from "./data/session-actions";
import { useSessionWorkspace } from "./data/session-workspace";
import { formatClock } from "./session-format";
import {
	dissolveGroup,
	type GroupMode,
	groupExercises,
	modeLocked,
	moveEntry,
	sessionExercises,
	setGroupCap,
	setGroupMode,
	setGroupRest,
	setGroupRounds,
} from "./session-plan";

function Stepper({
	value,
	label,
	lessLabel,
	moreLabel,
	onLess,
	onMore,
	lessDisabled,
}: {
	value: string;
	label: string;
	lessLabel: string;
	moreLabel: string;
	onLess: () => void;
	onMore: () => void;
	lessDisabled?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.stepper}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={lessLabel}
				disabled={lessDisabled}
				onPress={onLess}
				style={[styles.stepButton, lessDisabled && styles.dimmed]}
			>
				<AppText variant="heading">−</AppText>
			</Pressable>
			<View style={styles.stepValue} accessible>
				<AppText variant="display">{value}</AppText>
				<AppText variant="caption" style={{ color: colors.textMuted }}>
					{label}
				</AppText>
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={moreLabel}
				onPress={onMore}
				style={styles.stepButton}
			>
				<AppText variant="heading">+</AppText>
			</Pressable>
		</View>
	);
}
export function SessionGroupScreen() {
	const params = useLocalSearchParams<{
		sessionId: Id<"workoutSessions">;
		groupId: string;
	}>();
	const workspace = useSessionWorkspace(params.sessionId);
	const actions = useSessionActions(workspace);
	const { plan, nameOf, catalog } = workspace;
	const router = useRouter();
	const { t, locale } = useI18n();
	const root = t.strength.plan;
	const copy = root.group;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const [picking, setPicking] = useState(false);
	const group = plan?.groups[params.groupId];
	const gone = Boolean(plan && !group);
	const screenOptions = useMemo(
		() => ({ title: copy.title, headerTitleStyle: { color: colors.text } }),
		[copy.title, colors.text],
	);
	useEffect(() => {
		if (gone && router.canGoBack()) router.back();
	}, [gone, router]);
	if (!plan || !group)
		return <Stack.Screen options={{ title: copy.titleSheet }} />;
	const names = groupExercises(group);
	const index = plan.order.findIndex(
		(entry) => entry.kind === "group" && entry.groupId === group.id,
	);
	const entry = { kind: "group", groupId: group.id } as const;
	const locked = modeLocked(group);
	const amrap = group.mode === "amrap";
	const applyMode = (mode: GroupMode) => {
		// Amrap keeps one round in view: the others must not hide an unsaved set.
		if (actions.refusePending(group.rounds.flatMap((round) => round.items)))
			return;
		void actions.apply(setGroupMode(actions.plan(), group.id, mode), {
			undoable: false,
		});
	};
	return (
		<>
			<Stack.Screen options={screenOptions} />
			<ScrollView
				style={styles.screen}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={styles.content}
			>
				<AppText variant="secondary" style={{ color: colors.textMuted }}>
					{names.map(nameOf).join(" · ")}
				</AppText>
				{locked ? null : (
					<Segmented
						options={[
							{ value: "rounds", label: copy.rounds },
							{ value: "amrap", label: copy.amrap },
						]}
						value={group.mode}
						onChange={applyMode}
					/>
				)}
				{amrap ? (
					<Stepper
						value={String(group.capMinutes)}
						label={plural(locale, group.capMinutes, copy.minutesUnit)}
						lessLabel={copy.fewerMinutes}
						moreLabel={copy.moreMinutes}
						lessDisabled={group.capMinutes <= 1}
						onLess={() =>
							void actions.apply(
								setGroupCap(actions.plan(), group.id, group.capMinutes - 1),
								{ undoable: false },
							)
						}
						onMore={() =>
							void actions.apply(
								setGroupCap(actions.plan(), group.id, group.capMinutes + 1),
								{ undoable: false },
							)
						}
					/>
				) : (
					<Stepper
						value={String(group.rounds.length)}
						label={plural(locale, group.rounds.length, copy.roundsUnit)}
						lessLabel={copy.fewerRounds}
						moreLabel={copy.moreRounds}
						lessDisabled={group.rounds.length <= 1}
						onLess={() => {
							if (actions.refusePending(group.rounds.at(-1)?.items ?? []))
								return;
							void actions.apply(setGroupRounds(actions.plan(), group.id, -1), {
								undoable: false,
							});
						}}
						onMore={() =>
							void actions.apply(setGroupRounds(actions.plan(), group.id, 1), {
								undoable: false,
							})
						}
					/>
				)}
				{group.mode === "rounds" ? (
					<View style={styles.card}>
						<AppText variant="row" style={styles.cardLabel}>
							{copy.rest}
						</AppText>
						<Stepper
							value={formatClock(group.restSeconds)}
							label=""
							lessLabel={copy.restLess}
							moreLabel={copy.restMore}
							lessDisabled={group.restSeconds <= 0}
							onLess={() =>
								actions.set(
									setGroupRest(
										actions.plan(),
										group.id,
										Math.max(0, group.restSeconds - 15),
									),
								)
							}
							onMore={() =>
								actions.set(
									setGroupRest(
										actions.plan(),
										group.id,
										group.restSeconds + 15,
									),
								)
							}
						/>
					</View>
				) : null}
				<View style={styles.card}>
					<Pressable
						accessibilityRole="button"
						disabled={index <= 0}
						onPress={() => actions.set(moveEntry(actions.plan(), entry, -1))}
						style={[styles.row, index <= 0 && styles.dimmed]}
					>
						<AppText variant="row">{root.moveEarlier}</AppText>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						disabled={index >= plan.order.length - 1}
						onPress={() => actions.set(moveEntry(actions.plan(), entry, 1))}
						style={[
							styles.row,
							styles.rowLine,
							index >= plan.order.length - 1 && styles.dimmed,
						]}
					>
						<AppText variant="row">{root.moveLater}</AppText>
					</Pressable>
				</View>
				<View style={styles.card}>
					<AppText variant="label" style={styles.cardLabel}>
						{copy.exercises}
					</AppText>
					{names.map((exerciseId) => (
						<View key={exerciseId} style={[styles.row, styles.rowLine]}>
							<AppText variant="row">{nameOf(exerciseId)}</AppText>
						</View>
					))}
					<Pressable
						accessibilityRole="button"
						onPress={() => setPicking(true)}
						style={[styles.row, styles.rowLine]}
					>
						<AppText
							variant="row"
							style={{ color: colors.accent, fontWeight: "600" }}
						>
							{copy.addExercise}
						</AppText>
					</Pressable>
				</View>
				<Pressable
					accessibilityRole="button"
					onPress={() => {
						// The effect above leaves the sheet once the group is gone.
						void actions.apply(dissolveGroup(actions.plan(), group.id));
					}}
					style={styles.row}
				>
					<AppText
						variant="row"
						style={{ color: colors.danger, fontWeight: "600" }}
					>
						{copy.dissolve}
					</AppText>
				</Pressable>
			</ScrollView>
			{picking ? (
				<SessionExercisePicker
					title={root.picker.titleGroup}
					exercises={catalog}
					inSession={sessionExercises(plan)}
					onClose={() => setPicking(false)}
					onPick={(exercise) => {
						setPicking(false);
						void actions.addExerciseToGroup(
							group.id,
							exercise._id,
							exercise.name,
						);
					}}
					onCreate={(name, bodyweight) => {
						setPicking(false);
						void actions.createAndAdd(name, bodyweight, undefined, group.id);
					}}
				/>
			) : null}
		</>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: colors.bg },
		content: { padding: spacing.md, gap: spacing.md },
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		cardLabel: {
			paddingHorizontal: spacing.md,
			paddingTop: spacing.sm,
			color: colors.textMuted,
		},
		row: {
			minHeight: 48,
			justifyContent: "center",
			paddingHorizontal: spacing.md,
		},
		rowLine: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		stepper: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			padding: spacing.sm,
		},
		stepButton: {
			width: 56,
			height: 56,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
			borderRadius: radius.pill,
		},
		stepValue: { flex: 1, alignItems: "center" },
		dimmed: { opacity: opacity.disabled },
	});
