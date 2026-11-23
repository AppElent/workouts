/**
 * An exercise on its own, as the canvas draws it (APP-619, round 2): a done
 * card, the current card with its sets, or an upcoming card.
 */
import { primaryMuscleGroup } from "@foundry/core";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { SelectionMenu } from "../../../ui/selection-menu";
import { AppText } from "../../../ui/text";
import { useChoice } from "../../../ui/use-choice";
import { MuscleIcon } from "../../training/exercises/muscle-icon";
import { formatNumber, formatSetFull } from "../session-format";
import {
	addSet,
	addToGroup,
	addWarmup,
	bestToday,
	clearManual,
	focusExercise,
	groupWith,
	moveEntry,
	nextOpenRow,
	referenceFor,
	rowsOf,
} from "../session-plan";
import { useSessionScreen } from "../session-screen-context";
import { nowTarget } from "./now-card";
import { SessionSetRow, useLargeText } from "./session-set-row";

/** The line under an exercise: what its percentages come from. */
export function useReferenceLine(exerciseId: string) {
	const { plan, workspace } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const facts = workspace.getFacts(exerciseId);
	const number = (value: number) =>
		formatNumber(Math.round(value * 10) / 10, locale);
	if (facts.bodyweight)
		return { line: copy.refBodyweight, needsOneRm: false, hasManual: false };
	const reference = referenceFor(plan, facts, exerciseId);
	const today = bestToday(plan, exerciseId, facts);
	const local = plan.manual[exerciseId];
	const hasManual = reference?.source === "manual";
	const bestMeasured =
		today.measured !== null &&
		(facts.measured === null || today.measured > facts.measured)
			? today.measured
			: null;
	const parts: string[] = [];
	if (typeof local === "number" && facts.measured !== null)
		parts.push(
			fmt(copy.refManualMeasured, {
				manual: number(local),
				measured: number(facts.measured),
			}),
		);
	else if (hasManual && reference && facts.measured !== null)
		parts.push(
			fmt(copy.refManualMeasured, {
				manual: number(reference.value),
				measured: number(facts.measured),
			}),
		);
	else if (facts.measured !== null)
		parts.push(fmt(copy.refMeasured, { measured: number(facts.measured) }));
	else if (bestMeasured !== null) {
		if (reference)
			parts.push(fmt(copy.refManual, { manual: number(reference.value) }));
		parts.push(fmt(copy.refMeasuredNext, { value: number(bestMeasured) }));
	} else if (reference)
		parts.push(fmt(copy.refManual, { manual: number(reference.value) }));
	else parts.push(copy.refNone);
	if (facts.measured !== null && bestMeasured !== null)
		parts.push(fmt(copy.refFreshMeasured, { value: number(bestMeasured) }));
	const estimate = today.estimated ?? facts.estimated;
	const known = [facts.estimated, today.estimated].filter(
		(value): value is number => value !== null,
	);
	if (estimate !== null && known.length)
		parts.push(
			fmt(copy.refEstimated, { estimated: Math.round(Math.max(...known)) }),
		);
	return {
		line: parts.join(" · "),
		needsOneRm: !reference && bestMeasured === null,
		hasManual,
	};
}
function useExerciseMenu(exerciseId: string) {
	const {
		actions,
		openEditor,
		openManual,
		openPicker,
		openProfile,
		plan,
		workspace,
	} = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const choose = useChoice();
	const facts = workspace.getFacts(exerciseId);
	const reference = referenceFor(plan, facts, exerciseId);
	// Only solo exercises render here; the group sheet manages members.
	const index = plan.order.findIndex(
		(entry) => entry.kind === "exercise" && entry.exerciseId === exerciseId,
	);
	const after = plan.order[index + 1];
	const before = plan.order[index - 1];
	const neighbour = [after, before].find((entry) => entry?.kind === "exercise");
	const adjacentGroup = [before, after].find(
		(entry) => entry?.kind === "group",
	);
	const rows = rowsOf(plan, exerciseId);
	const groups = useMemo(
		() => [
			{
				title: workspace.nameOf(exerciseId),
				options: [
					{ id: "addSet", label: copy.addSet },
					...(facts.bodyweight
						? []
						: [{ id: "addWarmup", label: copy.addWarmup }]),
					{ id: "swap", label: copy.swapExercise },
				],
			},
			{
				options: [
					{
						id: "earlier",
						label: copy.moveEarlier,
						disabled: index <= 0,
					},
					{
						id: "later",
						label: copy.moveLater,
						disabled: index >= plan.order.length - 1,
					},
					...(neighbour?.kind === "exercise"
						? [
								{
									id: "groupWith",
									label: fmt(copy.groupWith, {
										name: workspace.nameOf(neighbour.exerciseId),
									}),
								},
							]
						: []),
					...(adjacentGroup
						? [{ id: "addToGroup", label: copy.addToGroup }]
						: []),
				],
			},
			...(facts.bodyweight
				? []
				: [
						{
							options: [
								{ id: "profile", label: copy.strengthProfile },
								{
									id: "manual",
									label:
										reference?.source === "manual"
											? copy.manualChange
											: copy.manualEnter,
								},
								...(reference?.source === "manual"
									? [{ id: "clearManual", label: copy.manualClear }]
									: []),
							],
						},
					]),
			{
				options: [
					{ id: "remove", label: copy.removeExercise, destructive: true },
				],
			},
		],
		[
			adjacentGroup,
			copy,
			exerciseId,
			facts.bodyweight,
			index,
			neighbour,
			plan.order.length,
			reference?.source,
			workspace,
		],
	);
	async function onSelect(id: string) {
		const name = workspace.nameOf(exerciseId);
		const current = actions.plan();
		if (id === "addSet") {
			const result = addSet(current, exerciseId, facts);
			actions.set(result.plan);
			const last = rows.at(-1);
			if (!last || last.blank) openEditor(result.rowId);
		} else if (id === "addWarmup") {
			const result = addWarmup(current, exerciseId, facts);
			actions.apply(result, { name, undoable: false });
		} else if (id === "swap") openPicker({ mode: "swap", from: exerciseId });
		else if (id === "earlier" || id === "later") {
			const entry = { kind: "exercise", exerciseId } as const;
			actions.set(moveEntry(current, entry, id === "earlier" ? -1 : 1));
		} else if (id === "groupWith" && neighbour?.kind === "exercise")
			actions.apply(
				groupWith(
					current,
					exerciseId,
					neighbour.exerciseId,
					workspace.getFacts,
				),
				{
					name,
				},
			);
		else if (id === "addToGroup" && adjacentGroup?.kind === "group")
			actions.apply(
				addToGroup(
					current,
					adjacentGroup.groupId,
					exerciseId,
					workspace.getFacts,
				),
				{
					name,
				},
			);
		else if (id === "profile") openProfile(exerciseId, nextRowOf(exerciseId));
		else if (id === "manual") openManual(exerciseId);
		else if (id === "clearManual")
			actions.apply(clearManual(current, exerciseId, facts), { name });
		else if (id === "remove") {
			const logged = rows.filter((row) => row.done).length;
			if (
				logged === 0 ||
				(await choose({
					title: fmt(copy.removeExerciseTitle, { name }),
					message: plural(locale, logged, copy.removeExerciseLogged),
					confirm: { label: copy.removeExerciseConfirm, destructive: true },
					cancel: copy.keepTraining,
				}))
			)
				await actions.dropExercise(exerciseId);
		}
	}
	const nextRowOf = (id: string) =>
		rowsOf(plan, id).find((row) => !row.done)?.id;
	return { groups, onSelect };
}
/** The exercise's muscle picture on a surface2 tile; a check when done. */
function ExerciseIcon({
	exerciseId,
	done = false,
	dim = false,
}: {
	exerciseId: string;
	done?: boolean;
	dim?: boolean;
}) {
	const { workspace } = useSessionScreen();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const exercise = workspace.catalog.find((item) => item._id === exerciseId);
	return (
		<View style={[styles.icon, dim && styles.iconDim]}>
			<MuscleIcon
				group={exercise ? primaryMuscleGroup(exercise) : "other"}
				size={40}
			/>
			{done ? (
				<View style={styles.iconCheck}>
					<SymbolView
						name="checkmark"
						size={10}
						weight="heavy"
						tintColor={colors.onAccent}
						fallback={null}
					/>
				</View>
			) : null}
		</View>
	);
}

/** The finished exercise: one line with its top set and a record badge. */
function DoneCard({
	exerciseId,
	onOpen,
}: {
	exerciseId: string;
	onOpen: () => void;
}) {
	const { plan, workspace } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const facts = workspace.getFacts(exerciseId);
	const rows = (plan.sets[exerciseId] ?? []).filter(
		(row) => row.kind !== "warmup",
	);
	const top = [...rows].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0];
	const today = bestToday(plan, exerciseId, facts);
	const record =
		(today.measured !== null &&
			(facts.measured === null || today.measured > facts.measured)) ||
		(today.estimated !== null &&
			facts.estimated !== null &&
			Math.round(today.estimated) > Math.round(facts.estimated));
	const name = workspace.nameOf(exerciseId);
	const line = top
		? fmt(copy.now.doneLine, {
				sets: plural(locale, rows.length, copy.finish.rowSets),
				load: formatSetFull(top, facts, locale),
			})
		: plural(locale, rows.length, copy.finish.rowSets);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={[name, line, record ? copy.now.recordBadge : null]
				.filter(Boolean)
				.join(", ")}
			onPress={onOpen}
			style={[styles.cardRow, styles.doneRow]}
		>
			<ExerciseIcon exerciseId={exerciseId} done />
			<View style={styles.headText}>
				<AppText variant="row" numberOfLines={1}>
					{name}
				</AppText>
				<AppText variant="footnote" style={styles.caption}>
					{line}
				</AppText>
			</View>
			{record ? (
				<View style={styles.badge}>
					<SymbolView
						name="trophy"
						size={12}
						weight="semibold"
						tintColor={colors.accentInk}
						fallback={null}
					/>
					<AppText variant="caption" style={styles.badgeText}>
						{copy.now.recordBadge}
					</AppText>
				</View>
			) : null}
		</Pressable>
	);
}

/** Not started yet: its sets and first load; a tap makes it current. */
function UpcomingCard({
	exerciseId,
	onOpen,
}: {
	exerciseId: string;
	onOpen: () => void;
}) {
	const { actions, plan, workspace } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const facts = workspace.getFacts(exerciseId);
	const rows = (plan.sets[exerciseId] ?? []).filter(
		(row) => row.kind !== "warmup",
	);
	const first = rows.find((row) => !row.done) ?? rows[0];
	const sets = plural(locale, rows.length, copy.now.sets);
	const done = rows.filter((row) => row.done).length;
	const line =
		first && !first.blank
			? fmt(copy.now.upcomingLine, {
					sets:
						done > 0
							? fmt(copy.now.setsOf, { done, total: rows.length })
							: sets,
					load: formatSetFull(first, facts, locale),
				})
			: sets;
	const name = workspace.nameOf(exerciseId);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${name}, ${line}`}
			accessibilityHint={copy.now.focusHint}
			onPress={() => {
				const next = focusExercise(actions.plan(), exerciseId);
				if (next !== actions.plan()) actions.set(next);
				else onOpen();
			}}
			style={[styles.cardRow, styles.upcomingRow]}
			testID={`session-upcoming-${exerciseId}`}
		>
			<ExerciseIcon exerciseId={exerciseId} dim />
			<View style={styles.headText}>
				<AppText variant="row" numberOfLines={1}>
					{name}
				</AppText>
				<AppText variant="footnote" style={styles.caption}>
					{line}
				</AppText>
			</View>
			<SymbolView
				name="chevron.right"
				size={14}
				weight="semibold"
				tintColor={colors.textFaint}
				fallback={null}
			/>
		</Pressable>
	);
}

export function SessionExerciseBlock({ exerciseId }: { exerciseId: string }) {
	const { actions, openEditor, plan, workspace } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const [open, setOpen] = useState(false);
	const rows = plan.sets[exerciseId] ?? [];
	const facts = workspace.getFacts(exerciseId);
	const next = nextOpenRow(plan);
	const menu = useExerciseMenu(exerciseId);
	const name = workspace.nameOf(exerciseId);
	const router = useRouter();
	const large = useLargeText();
	const allDone =
		rows.some((row) => row.kind !== "warmup") && rows.every((row) => row.done);
	const current = nowTarget(plan)?.row.exerciseId === exerciseId;
	const showPercent =
		!facts.bodyweight && referenceFor(plan, facts, exerciseId) !== null;
	// An exercise without sets stays open: its card is where a first set is added.
	if (!current && !open && rows.length > 0)
		return allDone ? (
			<DoneCard exerciseId={exerciseId} onOpen={() => setOpen(true)} />
		) : (
			<UpcomingCard exerciseId={exerciseId} onOpen={() => setOpen(true)} />
		);
	const working = rows.filter((row) => row.kind !== "warmup");
	const doneCount = working.filter((row) => row.done).length;
	const today = bestToday(plan, exerciseId, facts);
	const estimate = [facts.estimated, today.estimated].filter(
		(value): value is number => value !== null,
	);
	const planned = rows.some((row) => row.plan);
	const reference = facts.bodyweight
		? null
		: referenceFor(plan, facts, exerciseId);
	const number = (value: number) =>
		formatNumber(Math.round(value * 10) / 10, locale);
	const caption = [
		planned
			? fmt(copy.now.setsOf, { done: doneCount, total: working.length })
			: plural(locale, working.length, copy.now.sets),
		reference?.source === "measured"
			? fmt(copy.refMeasured, { measured: number(reference.value) })
			: reference?.source === "manual"
				? fmt(copy.refManual, { manual: number(reference.value) })
				: !facts.bodyweight && estimate.length > 0
					? fmt(copy.now.estimated, {
							value: formatNumber(Math.round(Math.max(...estimate)), locale),
						})
					: null,
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<View style={[styles.current, !current && styles.currentOpen]}>
			<View style={styles.currentHead}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={fmt(copy.now.openOverview, { name })}
					onPress={() =>
						router.push({
							pathname: "/exercise-sheet/[id]",
							params: { id: exerciseId, from: "session" },
						})
					}
					style={styles.currentTitle}
					testID="session-exercise-overview"
				>
					<ExerciseIcon exerciseId={exerciseId} done={allDone && !current} />
					<View style={styles.headText}>
						<View style={styles.nameRow}>
							<AppText
								variant="row"
								numberOfLines={large ? undefined : 1}
								style={styles.currentName}
							>
								{name}
							</AppText>
							<SymbolView
								name="chevron.right"
								size={13}
								weight="bold"
								tintColor={colors.textFaint}
								fallback={null}
							/>
						</View>
						<AppText variant="footnote" style={styles.caption}>
							{caption}
						</AppText>
					</View>
				</Pressable>
				<SelectionMenu
					trigger="ellipsis"
					label={fmt(copy.exerciseOptions, { name })}
					accessibilityLabel={fmt(copy.exerciseOptions, { name })}
					groups={menu.groups}
					onSelect={(id) => void menu.onSelect(id)}
				/>
			</View>
			{rows.map((row) => (
				<SessionSetRow
					key={row.id}
					row={row}
					isNext={current && next?.id === row.id}
					showPercent={showPercent}
				/>
			))}
			{!current ? (
				<View style={styles.footer}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`${copy.addSet}, ${name}`}
						disabled={!workspace.writable}
						onPress={() => {
							const result = addSet(actions.plan(), exerciseId, facts);
							actions.set(result.plan);
							const last = rows.at(-1);
							if (!last || last.blank) openEditor(result.rowId);
						}}
						style={styles.footerAction}
					>
						<AppText variant="control" style={styles.link}>
							{copy.addSet}
						</AppText>
					</Pressable>
					{rows.length > 0 ? (
						<Pressable
							accessibilityRole="button"
							onPress={() => setOpen(false)}
							style={[styles.footerAction, styles.footerDivider]}
						>
							<AppText variant="control" style={styles.link}>
								{copy.now.collapse}
							</AppText>
						</Pressable>
					) : null}
				</View>
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		headText: { flex: 1, minWidth: 0, gap: 2 },
		caption: { color: colors.textMuted, fontVariant: ["tabular-nums"] },
		icon: {
			width: 44,
			height: 44,
			borderRadius: 12,
			borderCurve: "continuous",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface2,
		},
		iconDim: { opacity: 0.85 },
		iconCheck: {
			position: "absolute",
			right: -4,
			bottom: -4,
			width: 20,
			height: 20,
			borderRadius: 10,
			borderWidth: 2,
			borderColor: colors.surface,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.accentFill,
		},
		cardRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingLeft: 10,
			paddingRight: 14,
			borderRadius: 20,
			borderCurve: "continuous",
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.surface,
		},
		doneRow: { minHeight: 64, paddingVertical: 10 },
		upcomingRow: { minHeight: 60, paddingVertical: spacing.sm },
		badge: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			height: 26,
			paddingHorizontal: 10,
			borderRadius: 13,
			backgroundColor: colors.accentDim,
		},
		badgeText: { color: colors.accentInk, fontWeight: "700" },
		current: {
			borderRadius: 20,
			borderCurve: "continuous",
			borderWidth: 1.5,
			borderColor: colors.accentFill,
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		currentOpen: { borderWidth: 1, borderColor: colors.border },
		currentHead: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.xs,
			paddingTop: 10,
			paddingBottom: spacing.sm,
			paddingLeft: 10,
			paddingRight: 6,
		},
		currentTitle: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
		currentName: { flexShrink: 1, fontWeight: "700" },
		footer: {
			flexDirection: "row",
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		footerAction: {
			flex: 1,
			minHeight: 48,
			alignItems: "center",
			justifyContent: "center",
		},
		footerDivider: {
			borderLeftWidth: StyleSheet.hairlineWidth,
			borderLeftColor: colors.separator,
		},
		link: { color: colors.accent },
	});
