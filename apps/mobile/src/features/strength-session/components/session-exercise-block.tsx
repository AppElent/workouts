/** An exercise on its own: name, references, its menu, and the set table. */
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { SelectionMenu } from "../../../ui/selection-menu";
import { AppText } from "../../../ui/text";
import { useChoice } from "../../../ui/use-choice";
import { formatNumber, formatSetShort } from "../session-format";
import {
	addSet,
	addSetTemplate,
	addToGroup,
	addWarmup,
	bestToday,
	clearManual,
	groupOfExercise,
	groupWith,
	moveEntry,
	nextOpenRow,
	referenceFor,
	rowsOf,
	takeOutOfGroup,
} from "../session-plan";
import { useSessionScreen } from "../session-screen-context";
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
export function useExerciseMenu(exerciseId: string) {
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
	const group = groupOfExercise(plan, exerciseId);
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
					...(group ? [] : [{ id: "addSet", label: copy.addSet }]),
					...(group || facts.bodyweight
						? []
						: [{ id: "addWarmup", label: copy.addWarmup }]),
					{ id: "swap", label: copy.swapExercise },
				],
			},
			{
				options: [
					...(group
						? [{ id: "takeOut", label: copy.takeOutOfGroup }]
						: [
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
							]),
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
			group,
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
		else if (id === "takeOut")
			actions.apply(takeOutOfGroup(current, exerciseId), { name });
		else if (id === "earlier" || id === "later") {
			const entry = { kind: "exercise", exerciseId } as const;
			actions.set(moveEntry(current, entry, id === "earlier" ? -1 : 1));
		} else if (id === "groupWith" && neighbour?.kind === "exercise")
			actions.apply(groupWith(current, exerciseId, neighbour.exerciseId), {
				name,
			});
		else if (id === "addToGroup" && adjacentGroup?.kind === "group")
			actions.apply(addToGroup(current, adjacentGroup.groupId, exerciseId), {
				name,
			});
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
export function SessionExerciseBlock({ exerciseId }: { exerciseId: string }) {
	const { actions, openEditor, openManual, plan, workspace } =
		useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const rows = plan.sets[exerciseId] ?? [];
	const facts = workspace.getFacts(exerciseId);
	const next = nextOpenRow(plan);
	const info = useReferenceLine(exerciseId);
	const menu = useExerciseMenu(exerciseId);
	const name = workspace.nameOf(exerciseId);
	// Rows carry their own labels at large text; narrow column heads would break.
	const large = useLargeText();
	const last = addSetTemplate(rows);
	const addLabel =
		last && !last.blank && (facts.bodyweight || last.kg > 0)
			? fmt(copy.addSetLoad, {
					load: formatSetShort(last, facts.bodyweight, locale),
				})
			: copy.addSet;
	return (
		<View style={styles.block}>
			<View style={styles.head}>
				<View style={styles.headText}>
					<AppText variant="title" accessibilityRole="header">
						{name}
					</AppText>
					<AppText variant="secondary" style={{ color: colors.textMuted }}>
						{info.line}
					</AppText>
					{info.needsOneRm || info.hasManual ? (
						<Pressable
							accessibilityRole="button"
							hitSlop={8}
							onPress={() => openManual(exerciseId)}
						>
							<AppText variant="secondary" style={styles.link}>
								{info.hasManual ? copy.refChange : copy.refEnter}
							</AppText>
						</Pressable>
					) : null}
				</View>
				<SelectionMenu
					trigger="ellipsis"
					label={fmt(copy.exerciseOptions, { name })}
					accessibilityLabel={fmt(copy.exerciseOptions, { name })}
					groups={menu.groups}
					onSelect={(id) => void menu.onSelect(id)}
				/>
			</View>
			<View style={styles.card}>
				{large ? null : <ColumnHeads bodyweight={facts.bodyweight} />}
				{rows.map((row) => (
					<SessionSetRow key={row.id} row={row} isNext={next?.id === row.id} />
				))}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${addLabel}, ${name}`}
					onPress={() => {
						const result = addSet(actions.plan(), exerciseId, facts);
						actions.set(result.plan);
						if (!last || last.blank) openEditor(result.rowId);
					}}
					style={styles.addRow}
				>
					<AppText variant="control" style={styles.link}>
						{addLabel}
					</AppText>
				</Pressable>
			</View>
		</View>
	);
}
function ColumnHeads({ bodyweight }: { bodyweight: boolean }) {
	const { t } = useI18n();
	const copy = t.strength.plan;
	const styles = useThemedStyles(createStyles);
	return (
		<View
			style={styles.columnHeads}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
		>
			<AppText variant="caption" style={styles.headSet}>
				{copy.columnSet}
			</AppText>
			<AppText variant="caption" style={styles.headPercent}>
				{bodyweight ? "" : "%"}
			</AppText>
			<AppText variant="caption" style={styles.headLoad}>
				{bodyweight ? copy.columnLoadBodyweight : copy.columnLoad}
			</AppText>
			<AppText variant="caption" style={styles.headOneRm}>
				{bodyweight ? "" : copy.columnOneRm}
			</AppText>
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
		},
		headText: { flex: 1, minWidth: 0, gap: 2 },
		link: { color: colors.accent, fontWeight: "600" },
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.contentCard,
			borderCurve: "continuous",
			overflow: "hidden",
		},
		columnHeads: {
			flexDirection: "row",
			gap: 6,
			paddingLeft: spacing.md,
			paddingRight: spacing.xs + 52,
			paddingVertical: spacing.xs,
		},
		headSet: { width: 22, color: colors.textMuted },
		headPercent: { width: 44, color: colors.textMuted },
		headLoad: { flex: 1, color: colors.textMuted },
		headOneRm: {
			minWidth: 48,
			textAlign: "right",
			color: colors.textMuted,
		},
		addRow: {
			minHeight: 52,
			alignItems: "center",
			justifyContent: "center",
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
			paddingHorizontal: spacing.md,
		},
	});
