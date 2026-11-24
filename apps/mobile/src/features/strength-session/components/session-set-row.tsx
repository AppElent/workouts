/** One set: a row to edit, a separate check to log, and the same actions three ways. */
import { convertLoad } from "@foundry/core";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { type RowAction, SwipeableRow } from "../../../ui/swipeable-row";
import { AppText } from "../../../ui/text";
import { workspaceStore } from "../data/session-workspace";
import { formatNumber, formatSetShort } from "../session-format";
import {
	type ExerciseFacts,
	groupOfRow,
	type PlanSet,
	referenceFor,
	repeatRow,
	rowOneRepMax,
	rowsOf,
	shownLoad,
	shownPercent,
} from "../session-plan";
import { useSessionScreen } from "../session-screen-context";

/** At accessibility text sizes a row takes two lines instead of dropping content. */
export const useLargeText = () => useWindowDimensions().fontScale >= 1.35;

function oneRmText(
	row: PlanSet,
	facts: ExerciseFacts,
	locale: string,
): string | null {
	const estimate = rowOneRepMax(row, facts);
	if (!estimate) return null;
	return row.reps === 1
		? formatNumber(shownLoad(row), locale)
		: `≈${Math.round(convertLoad(estimate.value, "kg", row.unit))}`;
}
export function useRowFacts(row: PlanSet) {
	const { plan, workspace } = useSessionScreen();
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const facts = workspace.getFacts(row.exerciseId);
	const reference = referenceFor(plan, facts, row.exerciseId);
	const percent = facts.bodyweight
		? null
		: shownPercent(row, reference, facts.stepKg);
	const pending = Boolean(
		row.attempt &&
			workspaceStore.inFlight(workspace.key).has(row.attempt.operationId),
	);
	const empty = row.blank && row.reps < 1;
	const loadText = empty
		? "—"
		: !facts.bodyweight && !(row.kg > 0)
			? `— × ${row.reps}`
			: formatSetShort(row, facts, locale);
	return {
		copy,
		locale,
		facts,
		percent,
		percentText:
			percent === null
				? facts.bodyweight
					? ""
					: "—"
				: `${formatNumber(percent, locale, 1)}%`,
		pending,
		loadText,
		oneRm: oneRmText(row, facts, locale),
	};
}
function useRowActions(row: PlanSet) {
	const { actions, confirmDelete, openEditor, plan, toggleRow } =
		useSessionScreen();
	const { copy } = useRowFacts(row);
	return useMemo((): RowAction[] => {
		const inGroup = Boolean(groupOfRow(plan, row.id));
		return [
			{
				key: "log",
				label: row.done ? copy.rowUnlog : copy.rowLog,
				swipe: false,
				onPress: () => toggleRow(row.id),
			},
			{
				key: "edit",
				label: copy.rowEdit,
				swipe: false,
				onPress: () => openEditor(row.id),
			},
			...(inGroup
				? []
				: [
						{
							key: "repeat",
							label: copy.rowRepeat,
							systemImage: "plus.square.on.square" as const,
							onPress: () =>
								void actions.apply(repeatRow(actions.plan(), row.id)),
						},
					]),
			{
				key: "delete",
				label: copy.rowDeleteShort,
				destructive: true,
				onPress: () => confirmDelete(row.id),
			},
		];
	}, [
		actions,
		confirmDelete,
		copy,
		openEditor,
		plan,
		row.done,
		row.id,
		toggleRow,
	]);
}
function RowShell({
	row,
	label,
	isNext,
	children,
}: {
	row: PlanSet;
	label: string;
	isNext: boolean;
	children: ReactNode;
}) {
	const { openEditor, toggleRow, workspace } = useSessionScreen();
	const { copy, loadText, pending } = useRowFacts(row);
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const rowActions = useRowActions(row);
	const name = workspace.nameOf(row.exerciseId);
	const speakLoad = loadText;
	return (
		<SwipeableRow
			actions={rowActions}
			menuTitle={`${name} · ${speakLoad}`}
			closeMenuLabel={copy.close}
		>
			{(accessibility) => (
				<View
					style={[
						styles.groupRow,
						isNext && { backgroundColor: colors.accentDim },
					]}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={label}
						accessibilityActions={accessibility.accessibilityActions}
						onAccessibilityAction={accessibility.onAccessibilityAction}
						onLongPress={accessibility.onLongPress}
						onPress={() => {
							if (!pending) openEditor(row.id);
						}}
						style={styles.groupBody}
						testID={`session-set-${row.id}`}
					>
						{children}
					</Pressable>
					<Pressable
						accessibilityRole="checkbox"
						accessibilityState={{ checked: row.done, busy: pending }}
						accessibilityLabel={fmt(
							row.done ? copy.rowLoggedLabel : copy.rowLogLabel,
							{ set: `${name} ${speakLoad}` },
						)}
						disabled={pending}
						hitSlop={4}
						onPress={() => toggleRow(row.id)}
						style={styles.checkHit}
						testID={`session-check-${row.id}`}
					>
						<View
							style={[
								styles.check,
								row.done
									? {
											backgroundColor: colors.accentFill,
											borderColor: colors.accentFill,
										}
									: { borderColor: isNext ? colors.text : colors.textMuted },
							]}
						>
							<SymbolView
								name="checkmark"
								size={17}
								weight="bold"
								tintColor={
									row.done
										? colors.onAccent
										: pending
											? colors.textFaint
											: colors.text
								}
							/>
						</View>
					</Pressable>
				</View>
			)}
		</SwipeableRow>
	);
}
function rowSpeech(
	row: PlanSet,
	setLabel: string,
	percent: number | null,
	load: string,
	copy: ReturnType<typeof useRowFacts>["copy"],
	oneRm: string | null,
) {
	const state = row.failed
		? `, ${copy.failed}`
		: row.done
			? `, ${copy.logged}`
			: "";
	return `${setLabel}${state}, ${percent === null ? "" : fmt(copy.rowPercentSpoken, { percent })}${load}${
		oneRm
			? fmt(copy.rowOneRmSpoken, {
					value: oneRm.replace("≈", ""),
					unit: copy.unitSpoken[row.unit],
				})
			: ""
	}`;
}
/**
 * A set in the current exercise's card (APP-619 canvas): label, load, RPE or
 * percentage, and its state on the right. The row opens the editor; the
 * state is a checkbox that logs or unlogs; swipe and long press offer the rest.
 */
export function SessionSetRow({
	row,
	isNext,
	showPercent = true,
}: {
	row: PlanSet;
	isNext: boolean;
	/** Off when nothing prices this exercise's sets. */
	showPercent?: boolean;
}) {
	const { openEditor, plan, toggleRow, workspace } = useSessionScreen();
	const { copy, locale, loadText, percent, percentText, pending, oneRm } =
		useRowFacts(row);
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const large = useLargeText();
	const rowActions = useRowActions(row);
	const mates = rowsOf(plan, row.exerciseId).filter(
		(item) => item.kind !== "warmup",
	);
	const number = mates.findIndex((item) => item.id === row.id) + 1;
	const mark =
		row.kind === "warmup"
			? copy.markWarmup
			: row.kind === "drop"
				? copy.markDrop
				: row.kind === "failure"
					? copy.markFailure
					: String(number);
	const status = pending ? copy.saving : row.failed ? copy.failed : null;
	const meta =
		status ??
		(row.rpe !== null && row.done
			? fmt(copy.now.rpe, { value: formatNumber(row.rpe, locale, 1) })
			: showPercent && percent !== null
				? percentText
				: "");
	const name = workspace.nameOf(row.exerciseId);
	const setLabel =
		row.kind === "warmup"
			? `${name}, ${copy.rowSetWarmup}`
			: `${name}, ${fmt(copy.rowSet, { number })}`;
	const label = rowSpeech(row, setLabel, percent, loadText, copy, oneRm);
	const markInk =
		row.kind === "warmup"
			? colors.warn
			: isNext
				? colors.accentInk
				: colors.textMuted;
	return (
		<SwipeableRow
			actions={rowActions}
			menuTitle={`${name} · ${loadText}`}
			closeMenuLabel={copy.close}
		>
			{(accessibility) => (
				<View
					style={[
						styles.row,
						isNext && styles.rowNext,
						large && styles.rowLarge,
					]}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={label}
						accessibilityActions={accessibility.accessibilityActions}
						onAccessibilityAction={accessibility.onAccessibilityAction}
						onLongPress={accessibility.onLongPress}
						onPress={() => {
							if (!pending) openEditor(row.id);
						}}
						style={[styles.body, large && styles.bodyLarge]}
						testID={`session-set-${row.id}`}
					>
						<AppText
							variant="secondary"
							style={[styles.mark, { color: markInk }]}
						>
							{mark}
						</AppText>
						<AppText
							variant="row"
							numberOfLines={large ? undefined : 1}
							adjustsFontSizeToFit={!large}
							style={[
								styles.load,
								{
									color: row.done ? colors.textMuted : colors.text,
									fontWeight: isNext ? "800" : "600",
								},
							]}
						>
							{loadText}
						</AppText>
						{meta ? (
							<AppText
								variant="footnote"
								numberOfLines={1}
								style={[
									styles.meta,
									{ color: row.failed ? colors.warn : colors.textMuted },
								]}
							>
								{meta}
							</AppText>
						) : null}
					</Pressable>
					<Pressable
						accessibilityRole="checkbox"
						accessibilityState={{ checked: row.done, busy: pending }}
						accessibilityLabel={fmt(
							row.done ? copy.rowLoggedLabel : copy.rowLogLabel,
							{ set: `${name} ${loadText}` },
						)}
						disabled={pending}
						hitSlop={4}
						onPress={() => toggleRow(row.id)}
						style={styles.stateHit}
						testID={`session-check-${row.id}`}
					>
						{row.done ? (
							<View style={styles.doneBadge}>
								<SymbolView
									name="checkmark"
									size={14}
									weight="bold"
									tintColor={colors.accentInk}
									fallback={
										<AppText
											variant="label"
											style={{ color: colors.accentInk }}
										>
											✓
										</AppText>
									}
								/>
							</View>
						) : isNext ? (
							<View style={styles.nowPill}>
								<AppText variant="eyebrow" style={{ color: colors.onAccent }}>
									{copy.now.nowBadge}
								</AppText>
							</View>
						) : (
							<View
								style={[
									styles.openBadge,
									pending && { borderColor: colors.textFaint },
								]}
							/>
						)}
					</Pressable>
				</View>
			)}
		</SwipeableRow>
	);
}
export function SessionGroupItemRow({
	row,
	round,
	isNext,
}: {
	row: PlanSet;
	round: number;
	isNext: boolean;
}) {
	const { workspace } = useSessionScreen();
	const { copy, loadText, percent, percentText, pending, oneRm, facts } =
		useRowFacts(row);
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const name = workspace.nameOf(row.exerciseId);
	const ink = row.done ? colors.textMuted : colors.text;
	const status = pending ? copy.saving : row.failed ? copy.failed : null;
	const label = rowSpeech(
		row,
		`${name}, ${fmt(copy.rowRound, { number: round })}`,
		percent,
		loadText,
		copy,
		oneRm,
	);
	return (
		<RowShell row={row} label={label} isNext={isNext}>
			<View style={styles.itemColumns}>
				<View style={styles.itemName}>
					<AppText
						variant="row"
						style={{ color: ink, fontWeight: isNext ? "700" : "600" }}
					>
						{name}
						{facts.bodyweight || !percentText || percentText === "—"
							? ""
							: ` · ${percentText}`}
					</AppText>
					{status || oneRm ? (
						<AppText
							variant="caption"
							style={{ color: row.failed ? colors.warn : colors.textMuted }}
						>
							{status ?? `1RM ${oneRm}`}
						</AppText>
					) : null}
				</View>
				<AppText
					variant="heading"
					style={{ color: ink, fontWeight: isNext ? "700" : "600" }}
				>
					{loadText}
				</AppText>
			</View>
		</RowShell>
	);
}
const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		row: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: 44,
			paddingLeft: 14,
			paddingRight: 6,
			backgroundColor: colors.surface,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		rowNext: { minHeight: 50, backgroundColor: colors.accentDim },
		rowLarge: { paddingVertical: spacing.xs },
		body: {
			flex: 1,
			minWidth: 0,
			minHeight: 44,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		bodyLarge: { flexWrap: "wrap" },
		mark: { width: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
		load: { flex: 1, minWidth: 0, fontVariant: ["tabular-nums"] },
		meta: { textAlign: "right", fontVariant: ["tabular-nums"] },
		stateHit: {
			width: 52,
			minHeight: 44,
			alignItems: "flex-end",
			justifyContent: "center",
			paddingRight: spacing.sm,
		},
		doneBadge: {
			width: 28,
			height: 28,
			borderRadius: 14,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.accentDim,
		},
		openBadge: {
			width: 28,
			height: 28,
			borderRadius: 14,
			borderWidth: 1.5,
			borderColor: colors.borderStrong,
		},
		nowPill: {
			height: 24,
			paddingHorizontal: spacing.sm,
			borderRadius: 12,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.accentFill,
		},
		groupRow: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: 60,
			paddingLeft: spacing.md,
			paddingRight: spacing.xs,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		groupBody: {
			flex: 1,
			minWidth: 0,
			paddingVertical: spacing.xs,
			minHeight: 56,
			justifyContent: "center",
		},
		itemColumns: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		itemName: { flex: 1, minWidth: 0 },
		checkHit: {
			width: 52,
			minHeight: 52,
			alignItems: "center",
			justifyContent: "center",
		},
		check: {
			width: 40,
			height: 40,
			borderRadius: radius.pill,
			borderWidth: 1.5,
			alignItems: "center",
			justifyContent: "center",
		},
	});
