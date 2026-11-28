import { formatClock } from "@foundry/core";
/** How a set group repeats, its order, its exercises, and how to undo it. */
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { Id } from "../../convex/api";
import { fmt, plural, useI18n } from "../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../theme";
import { Segmented } from "../../ui/segmented";
import { SelectionMenu } from "../../ui/selection-menu";
import { AppText } from "../../ui/text";
import { useChoice } from "../../ui/use-choice";
import { oneRmMenuGroups } from "./components/session-exercise-block";
import { SessionExercisePicker } from "./components/session-exercise-picker";
import { useSessionActions } from "./data/session-actions";
import { useSessionWorkspace } from "./data/session-workspace";
import {
	clearManual,
	dissolveGroup,
	type GroupMode,
	groupExercises,
	modeLocked,
	moveEntry,
	REST_STEP_SECONDS,
	referenceFor,
	rowsOf,
	sessionExercises,
	setGroupCap,
	setGroupMode,
	setGroupRest,
	setGroupRounds,
	takeOutOfGroup,
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
	const [picker, setPicker] = useState<
		{ mode: "add" } | { mode: "swap"; from: string } | null
	>(null);
	const choose = useChoice();
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
	// The same items a solo exercise offers, above the two remove items (APP-232).
	const memberMenu = (exerciseId: string) => {
		const facts = workspace.getFacts(exerciseId);
		return [
			{
				title: nameOf(exerciseId),
				options: [{ id: "swap", label: root.swapExercise }],
			},
			...oneRmMenuGroups(
				root,
				facts.bodyweight,
				referenceFor(plan, facts, exerciseId)?.source,
			),
			{
				options: [
					{ id: "takeOut", label: root.takeOutOfGroup },
					{ id: "remove", label: root.removeExercise, destructive: true },
				],
			},
		];
	};
	const onMember = async (exerciseId: string, id: string) => {
		const name = nameOf(exerciseId);
		if (id === "swap") {
			setPicker({ mode: "swap", from: exerciseId });
			return;
		}
		if (id === "profile") {
			const rowId = rowsOf(actions.plan(), exerciseId).find(
				(row) => !row.done,
			)?.id;
			router.push({
				pathname: "/set-editor/strength-profile",
				params: {
					sessionId: params.sessionId,
					exerciseId,
					...(rowId ? { rowId } : {}),
				},
			});
			return;
		}
		if (id === "manual") {
			if (actions.blocked()) return;
			router.push({
				pathname: "/session-manual",
				params: { sessionId: params.sessionId, exerciseId },
			});
			return;
		}
		if (id === "clearManual") {
			const facts = workspace.getFacts(exerciseId);
			void actions.apply(clearManual(actions.plan(), exerciseId, facts), {
				name,
			});
			return;
		}
		if (id === "takeOut") {
			void actions.apply(takeOutOfGroup(actions.plan(), exerciseId), { name });
			return;
		}
		const logged = rowsOf(actions.plan(), exerciseId).filter(
			(row) => row.done,
		).length;
		if (
			logged === 0 ||
			(await choose({
				title: fmt(root.removeExerciseTitle, { name }),
				message: plural(locale, logged, root.removeExerciseLogged),
				confirm: { label: root.removeExerciseConfirm, destructive: true },
				cancel: root.keepTraining,
			}))
		)
			await actions.dropExercise(exerciseId);
	};
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
							lessLabel={fmt(copy.restLess, { seconds: REST_STEP_SECONDS })}
							moreLabel={fmt(copy.restMore, { seconds: REST_STEP_SECONDS })}
							lessDisabled={group.restSeconds <= 0}
							onLess={() =>
								actions.set(
									setGroupRest(
										actions.plan(),
										group.id,
										Math.max(0, group.restSeconds - REST_STEP_SECONDS),
									),
								)
							}
							onMore={() =>
								actions.set(
									setGroupRest(
										actions.plan(),
										group.id,
										group.restSeconds + REST_STEP_SECONDS,
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
						<View
							key={exerciseId}
							style={[styles.row, styles.rowLine, styles.member]}
						>
							<AppText variant="row" style={styles.memberName}>
								{nameOf(exerciseId)}
							</AppText>
							<SelectionMenu
								trigger="ellipsis"
								label={fmt(root.exerciseOptions, { name: nameOf(exerciseId) })}
								accessibilityLabel={fmt(root.exerciseOptions, {
									name: nameOf(exerciseId),
								})}
								groups={memberMenu(exerciseId)}
								onSelect={(id) => void onMember(exerciseId, id)}
							/>
						</View>
					))}
					<Pressable
						accessibilityRole="button"
						onPress={() => setPicker({ mode: "add" })}
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
			{picker ? (
				<SessionExercisePicker
					title={
						picker.mode === "swap"
							? root.picker.titleSwap
							: root.picker.titleGroup
					}
					exercises={catalog}
					inSession={sessionExercises(plan)}
					onClose={() => setPicker(null)}
					onPick={(exercise) => {
						const request = picker;
						setPicker(null);
						if (request.mode === "swap")
							void actions.swap(request.from, exercise._id, exercise.name);
						else
							void actions.addExerciseToGroup(
								group.id,
								exercise._id,
								exercise.name,
							);
					}}
					onCreate={(name, kind) => {
						const request = picker;
						setPicker(null);
						if (request.mode === "swap")
							void actions.createAndAdd(name, kind, request.from);
						else void actions.createAndAdd(name, kind, undefined, group.id);
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
		member: {
			flexDirection: "row",
			alignItems: "center",
			paddingRight: 0,
		},
		memberName: { flex: 1, minWidth: 0 },
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
