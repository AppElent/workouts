import {
	NUTRIENT_KEYS,
	type NutrientTotal,
	roundForDisplay,
} from "@workouts/core/nutrition";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ActionSheetIOS,
	BackHandler,
	LayoutAnimation,
	Modal,
	PanResponder,
	Platform,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import type { NutrientGoal, NutrientKey } from "../data/nutrition-day";
import {
	nutrientUnit,
	useSetNutritionDisplayOrder,
} from "../data/nutrition-day";
import { haptics } from "../feedback/haptics";
import { useReduceMotion } from "../feedback/reduce-motion";
import { fmt, type Messages } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GroupedSurface } from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type GoalGroup = {
	nutrient: NutrientKey;
	min?: number;
	max?: number;
};

function groupGoals(
	goals: readonly NutrientGoal[],
	displayOrder: readonly NutrientKey[],
): GoalGroup[] {
	const grouped = new Map<NutrientKey, GoalGroup>();
	for (const goal of goals) {
		const group = grouped.get(goal.nutrient) ?? { nutrient: goal.nutrient };
		group[goal.direction] = goal.target;
		grouped.set(goal.nutrient, group);
	}
	return displayOrder.flatMap((nutrient) => {
		const group = grouped.get(nutrient);
		return group ? [group] : [];
	});
}

function displayAmount(nutrient: NutrientKey, total?: NutrientTotal): string {
	const amount = roundForDisplay(nutrient, total?.amount ?? 0);
	if (total?.incomplete) return `≥ ${amount}`;
	if (total?.qualified) return `~ ${amount}`;
	return String(amount);
}

function targetLabel(group: GoalGroup, unit: string): string {
	if (group.min !== undefined && group.max !== undefined)
		return `${group.min}–${group.max} ${unit}`;
	if (group.min !== undefined) return `≥${group.min} ${unit}`;
	return `≤${group.max ?? 0} ${unit}`;
}

function outcome(
	t: Messages,
	group: GoalGroup,
	total?: NutrientTotal,
): { label: string; color: string } {
	if (!total || total.entryCount === 0)
		return { label: t.nutrition.goals.state.neutral, color: colors.textMuted };
	if (total.incomplete)
		return { label: t.nutrition.goals.incomplete, color: colors.textMuted };
	if (total.qualified)
		return { label: t.nutrition.goals.approximate, color: colors.textMuted };
	const amount = total.amount;
	const unit = t.nutrition.units[nutrientUnit(group.nutrient)];
	if (group.min !== undefined && group.max !== undefined) {
		if (amount < group.min)
			return {
				label: fmt(t.nutrition.goals.toRange, {
					amount: roundForDisplay(group.nutrient, group.min - amount),
					unit,
				}),
				color: colors.accent,
			};
		if (amount > group.max)
			return {
				label: fmt(t.nutrition.goals.over, {
					amount: roundForDisplay(group.nutrient, amount - group.max),
					unit,
				}),
				color: colors.danger,
			};
		return { label: t.nutrition.goals.withinRange, color: colors.success };
	}
	if (group.min !== undefined) {
		return amount < group.min
			? {
					label: fmt(t.nutrition.goals.toMinimum, {
						amount: roundForDisplay(group.nutrient, group.min - amount),
						unit,
					}),
					color: colors.accent,
				}
			: { label: t.nutrition.goals.minimumMet, color: colors.success };
	}
	const max = group.max ?? 0;
	if (amount < max)
		return {
			label: fmt(t.nutrition.goals.remaining, {
				amount: roundForDisplay(group.nutrient, max - amount),
				unit,
			}),
			color: colors.accent,
		};
	if (amount === max)
		return { label: t.nutrition.goals.atMaximum, color: colors.accent };
	return {
		label: fmt(t.nutrition.goals.over, {
			amount: roundForDisplay(group.nutrient, amount - max),
			unit,
		}),
		color: colors.danger,
	};
}

function GoalProgressTrack({
	t,
	group,
	total,
}: {
	t: Messages;
	group: GoalGroup;
	total?: NutrientTotal;
}) {
	const denominator = group.max ?? group.min ?? 1;
	const fraction = Math.max(0, Math.min(1, (total?.amount ?? 0) / denominator));
	const status = outcome(t, group, total);
	const neutral = !total || total.incomplete || total.qualified;
	return (
		<View style={styles.track}>
			<View
				style={[
					styles.fill,
					{
						width: `${fraction * 100}%`,
						backgroundColor: neutral ? colors.textMuted : status.color,
					},
				]}
			/>
			{group.min !== undefined && group.max !== undefined ? (
				<View
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					style={[
						styles.minimumMarker,
						{ left: `${Math.min(100, (group.min / group.max) * 100)}%` },
					]}
				/>
			) : null}
		</View>
	);
}

function GoalProgressRow({
	t,
	group,
	total,
	onLongPress,
	onEdit,
	onReorder,
	stacked,
}: {
	t: Messages;
	group: GoalGroup;
	total?: NutrientTotal;
	onLongPress?: () => void;
	onEdit?: () => void;
	onReorder?: () => void;
	stacked: boolean;
}) {
	const unit = t.nutrition.units[nutrientUnit(group.nutrient)];
	const value = `${displayAmount(group.nutrient, total)} / ${targetLabel(group, unit)}`;
	const status = outcome(t, group, total);
	return (
		<Pressable
			accessible
			disabled={!onLongPress && !onEdit && !onReorder}
			accessibilityLabel={`${t.nutrition.nutrients[group.nutrient]}: ${value}. ${status.label}.`}
			accessibilityActions={
				onEdit || onReorder
					? [
							...(onEdit
								? [{ name: "edit", label: t.nutrition.goals.edit }]
								: []),
							...(onReorder
								? [{ name: "reorder", label: t.nutrition.goals.reorder }]
								: []),
						]
					: undefined
			}
			onAccessibilityAction={(event) => {
				if (event.nativeEvent.actionName === "edit") onEdit?.();
				if (event.nativeEvent.actionName === "reorder") onReorder?.();
			}}
			onLongPress={onLongPress}
			style={styles.goalRow}
		>
			<View
				style={[styles.rowHeader, stacked ? styles.rowHeaderStacked : null]}
			>
				<AppText style={styles.goalName}>
					{t.nutrition.nutrients[group.nutrient]}
				</AppText>
				<AppText variant="caption" style={styles.numbers}>
					{value}
				</AppText>
			</View>
			<GoalProgressTrack t={t} group={group} total={total} />
			<AppText variant="caption" style={{ color: status.color }}>
				{status.label}
			</AppText>
		</Pressable>
	);
}

function ReorderHandle({
	t,
	nutrient,
	canMoveUp,
	canMoveDown,
	onMove,
	disabled,
}: {
	t: Messages;
	nutrient: NutrientKey;
	canMoveUp: boolean;
	canMoveDown: boolean;
	onMove: (direction: -1 | 1) => boolean;
	disabled: boolean;
}) {
	const step = useRef(0);
	const pan = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => !disabled,
				onMoveShouldSetPanResponder: (_event, gesture) =>
					!disabled && Math.abs(gesture.dy) > 4,
				onPanResponderGrant: () => {
					step.current = 0;
					haptics.selectionChanged();
				},
				onPanResponderMove: (_event, gesture) => {
					const nextStep = Math.trunc(gesture.dy / 52);
					while (nextStep !== step.current) {
						const direction = nextStep > step.current ? 1 : -1;
						if (!onMove(direction)) break;
						step.current += direction;
						haptics.selectionChanged();
					}
				},
				onPanResponderRelease: () => haptics.selectionChanged(),
				onPanResponderTerminate: () => haptics.selectionChanged(),
			}),
		[disabled, onMove],
	);
	return (
		<Pressable
			{...pan.panHandlers}
			accessibilityRole="adjustable"
			accessibilityState={{ disabled }}
			disabled={disabled}
			accessibilityLabel={fmt(t.nutrition.goals.move, {
				nutrient: t.nutrition.nutrients[nutrient],
			})}
			accessibilityActions={
				disabled
					? []
					: [
							...(canMoveUp
								? [{ name: "decrement", label: t.nutrition.goals.moveUp }]
								: []),
							...(canMoveDown
								? [{ name: "increment", label: t.nutrition.goals.moveDown }]
								: []),
						]
			}
			onAccessibilityAction={(event) => {
				if (
					!disabled &&
					event.nativeEvent.actionName === "decrement" &&
					canMoveUp
				)
					onMove(-1);
				if (
					!disabled &&
					event.nativeEvent.actionName === "increment" &&
					canMoveDown
				)
					onMove(1);
			}}
			style={styles.reorderHandle}
		>
			<SymbolView
				name="line.3.horizontal"
				size={20}
				tintColor={colors.textMuted}
			/>
		</Pressable>
	);
}

export function NutritionGoalCard({
	t,
	goals,
	totals,
	displayOrder,
	onEdit,
}: {
	t: Messages;
	goals: NutrientGoal[];
	totals: Partial<Record<NutrientKey, NutrientTotal>>;
	displayOrder: readonly NutrientKey[];
	onEdit: (nutrient?: NutrientKey) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const [reordering, setReordering] = useState(false);
	const [savedOrder, setSavedOrder] = useState<NutrientKey[]>(() => [
		...displayOrder,
	]);
	const [draftOrder, setDraftOrder] = useState<NutrientKey[]>(() => [
		...displayOrder,
	]);
	const draftOrderRef = useRef(draftOrder);
	const incomingOrderKey = displayOrder.join("|");
	const appliedIncomingOrderKey = useRef(incomingOrderKey);
	const [menuNutrient, setMenuNutrient] = useState<NutrientKey>();
	const [pending, setPending] = useState(false);
	const saveInFlight = useRef(false);
	const reduceMotion = useReduceMotion();
	const { fontScale } = useWindowDimensions();
	const toast = useToast();
	const setDisplayOrder = useSetNutritionDisplayOrder();
	const stackedRows = fontScale >= 1.6;
	const activeOrder = reordering ? draftOrder : savedOrder;
	const groups = useMemo(
		() => groupGoals(goals, activeOrder),
		[activeOrder, goals],
	);
	const hiddenCount = Math.max(0, groups.length - 2);
	const visible = reordering || expanded ? groups : groups.slice(0, 2);
	const preview = !reordering && !expanded ? groups[2] : undefined;

	useEffect(() => {
		if (reordering || appliedIncomingOrderKey.current === incomingOrderKey)
			return;
		const nextOrder = [...displayOrder];
		appliedIncomingOrderKey.current = incomingOrderKey;
		draftOrderRef.current = nextOrder;
		setSavedOrder(nextOrder);
		setDraftOrder(nextOrder);
	}, [displayOrder, incomingOrderKey, reordering]);

	useEffect(() => {
		if (!reordering) return;
		return BackHandler.addEventListener("hardwareBackPress", () => {
			if (saveInFlight.current) return true;
			setReordering(false);
			draftOrderRef.current = savedOrder;
			setDraftOrder(savedOrder);
			return true;
		}).remove;
	}, [reordering, savedOrder]);

	function toggle() {
		animateLayout();
		setExpanded((value) => !value);
	}

	function animateLayout() {
		if (!reduceMotion)
			LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
	}

	function beginReorder() {
		animateLayout();
		setMenuNutrient(undefined);
		draftOrderRef.current = savedOrder;
		setDraftOrder(savedOrder);
		setExpanded(true);
		setReordering(true);
	}

	function openMenu(nutrient: NutrientKey) {
		haptics.menuOpened();
		if (Platform.OS !== "ios") {
			setMenuNutrient(nutrient);
			return;
		}
		const canReorder = groups.length > 1;
		const labels = [
			...(canReorder ? [t.nutrition.goals.reorder] : []),
			t.nutrition.goals.edit,
			t.nutrition.goals.cancel,
		];
		ActionSheetIOS.showActionSheetWithOptions(
			{
				title: fmt(t.nutrition.goals.actionsFor, {
					nutrient: t.nutrition.nutrients[nutrient],
				}),
				options: labels,
				cancelButtonIndex: labels.length - 1,
			},
			(index) => {
				if (canReorder && index === 0) beginReorder();
				else if (index === (canReorder ? 1 : 0)) onEdit(nutrient);
			},
		);
	}

	function move(nutrient: NutrientKey, direction: -1 | 1): boolean {
		if (saveInFlight.current) return false;
		const current = draftOrderRef.current;
		const visibleNutrients = groupGoals(goals, current).map(
			(group) => group.nutrient,
		);
		const visibleIndex = visibleNutrients.indexOf(nutrient);
		const neighbor = visibleNutrients[visibleIndex + direction];
		if (!neighbor) return false;
		const next = [...current];
		const index = next.indexOf(nutrient);
		const neighborIndex = next.indexOf(neighbor);
		[next[index], next[neighborIndex]] = [next[neighborIndex], next[index]];
		animateLayout();
		draftOrderRef.current = next;
		setDraftOrder(next);
		return true;
	}

	async function saveOrder() {
		if (saveInFlight.current) return;
		const submittedOrder = [...draftOrderRef.current];
		saveInFlight.current = true;
		setPending(true);
		try {
			await setDisplayOrder(submittedOrder);
			animateLayout();
			setSavedOrder(submittedOrder);
			draftOrderRef.current = submittedOrder;
			setExpanded(false);
			setReordering(false);
		} catch {
			toast.error(t.nutrition.goals.reorderFailure);
		} finally {
			saveInFlight.current = false;
			setPending(false);
		}
	}

	if (groups.length === 0)
		return (
			<GroupedSurface style={styles.card}>
				<View style={styles.emptyRow}>
					<View style={styles.emptyCopy}>
						<AppText variant="heading">{t.nutrition.goals.empty.title}</AppText>
						<AppText variant="caption">{t.nutrition.goals.empty.body}</AppText>
					</View>
					<Pressable
						accessibilityRole="button"
						onPress={() => onEdit()}
						style={styles.textButton}
					>
						<AppText style={styles.actionText}>
							{t.nutrition.goals.empty.action}
						</AppText>
					</Pressable>
				</View>
			</GroupedSurface>
		);

	return (
		<>
			<GroupedSurface style={styles.card}>
				<View style={styles.cardHeader}>
					<AppText variant="caption">{t.nutrition.goals.heading}</AppText>
					<View style={styles.headerActions}>
						{reordering ? (
							<>
								<Pressable
									accessibilityRole="button"
									accessibilityState={{ disabled: pending }}
									disabled={pending}
									onPress={() => {
										if (saveInFlight.current) return;
										animateLayout();
										draftOrderRef.current = savedOrder;
										setDraftOrder(savedOrder);
										setReordering(false);
									}}
									style={styles.headerTextButton}
								>
									<AppText variant="caption" style={styles.actionText}>
										{t.nutrition.goals.cancel}
									</AppText>
								</Pressable>
								<Pressable
									accessibilityRole="button"
									accessibilityState={{ disabled: pending }}
									disabled={pending}
									onPress={() => {
										if (saveInFlight.current) return;
										animateLayout();
										const defaultOrder = [...NUTRIENT_KEYS];
										draftOrderRef.current = defaultOrder;
										setDraftOrder(defaultOrder);
									}}
									style={styles.headerTextButton}
								>
									<AppText variant="caption" style={styles.actionText}>
										{t.nutrition.goals.reset}
									</AppText>
								</Pressable>
								<Pressable
									accessibilityRole="button"
									accessibilityState={{ busy: pending, disabled: pending }}
									disabled={pending}
									onPress={() => void saveOrder()}
									style={styles.headerTextButton}
								>
									<AppText variant="caption" style={styles.actionText}>
										{t.nutrition.goals.done}
										{pending ? "…" : ""}
									</AppText>
								</Pressable>
							</>
						) : (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t.nutrition.goals.edit}
								onPress={() => onEdit()}
								style={styles.iconButton}
							>
								<SymbolView name="pencil" size={17} tintColor={colors.accent} />
							</Pressable>
						)}
						{!reordering && hiddenCount > 0 ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={
									expanded
										? t.nutrition.goals.showLess
										: fmt(t.nutrition.goals.showMore, { count: hiddenCount })
								}
								accessibilityState={{ expanded }}
								onPress={toggle}
								style={styles.disclosureButton}
							>
								<AppText variant="caption" style={styles.actionText}>
									{expanded
										? t.nutrition.goals.showLess
										: fmt(t.nutrition.goals.more, { count: hiddenCount })}
								</AppText>
								<SymbolView
									name={expanded ? "chevron.up" : "chevron.down"}
									size={14}
									tintColor={colors.accent}
								/>
							</Pressable>
						) : null}
					</View>
				</View>
				{visible.map((group, index) => (
					<View key={group.nutrient} style={styles.reorderRow}>
						<View style={styles.rowContent}>
							<GoalProgressRow
								t={t}
								group={group}
								total={totals[group.nutrient]}
								onLongPress={
									reordering ? undefined : () => openMenu(group.nutrient)
								}
								onEdit={reordering ? undefined : () => onEdit(group.nutrient)}
								onReorder={
									reordering || groups.length < 2 ? undefined : beginReorder
								}
								stacked={stackedRows}
							/>
						</View>
						{reordering ? (
							<ReorderHandle
								t={t}
								nutrient={group.nutrient}
								canMoveUp={index > 0}
								canMoveDown={index < visible.length - 1}
								onMove={(direction) => move(group.nutrient, direction)}
								disabled={pending}
							/>
						) : null}
					</View>
				))}
				{preview ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={fmt(t.nutrition.goals.expandPreview, {
							count: hiddenCount,
						})}
						accessibilityState={{ expanded: false }}
						onPress={toggle}
						style={styles.teaser}
					>
						<View
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							pointerEvents="none"
							style={styles.teaserTrack}
						>
							<GoalProgressTrack
								t={t}
								group={preview}
								total={totals[preview.nutrient]}
							/>
						</View>
						<LinearGradient
							colors={["rgba(20,22,19,0)", colors.surface]}
							pointerEvents="none"
							style={StyleSheet.absoluteFill}
						/>
					</Pressable>
				) : null}
			</GroupedSurface>
			<Modal
				visible={Platform.OS !== "ios" && menuNutrient !== undefined}
				transparent
				animationType={reduceMotion ? "none" : "fade"}
				onRequestClose={() => setMenuNutrient(undefined)}
			>
				<View style={styles.menuBackdrop}>
					<Pressable
						accessible={false}
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
						onPress={() => setMenuNutrient(undefined)}
						style={StyleSheet.absoluteFill}
					/>
					<View accessibilityViewIsModal style={styles.menuCard}>
						{menuNutrient ? (
							<AppText variant="heading">
								{fmt(t.nutrition.goals.actionsFor, {
									nutrient: t.nutrition.nutrients[menuNutrient],
								})}
							</AppText>
						) : null}
						{groups.length > 1 ? (
							<Pressable
								accessibilityRole="button"
								onPress={beginReorder}
								style={styles.menuItem}
							>
								<AppText>{t.nutrition.goals.reorder}</AppText>
							</Pressable>
						) : null}
						<Pressable
							accessibilityRole="button"
							onPress={() => {
								const nutrient = menuNutrient;
								setMenuNutrient(undefined);
								onEdit(nutrient);
							}}
							style={styles.menuItem}
						>
							<AppText>{t.nutrition.goals.edit}</AppText>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							onPress={() => setMenuNutrient(undefined)}
							style={styles.menuItem}
						>
							<AppText>{t.nutrition.goals.cancel}</AppText>
						</Pressable>
					</View>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	card: { gap: spacing.sm },
	cardHeader: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	headerActions: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "flex-end",
		flexShrink: 1,
		gap: spacing.xs,
	},
	headerTextButton: {
		minHeight: 44,
		justifyContent: "center",
		padding: spacing.xs,
	},
	iconButton: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
	},
	disclosureButton: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.xs,
	},
	actionText: { color: colors.accent, fontWeight: "700" },
	goalRow: { gap: 6, paddingVertical: spacing.xs },
	reorderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	rowContent: { flex: 1 },
	reorderHandle: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	rowHeader: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
	rowHeaderStacked: {
		flexDirection: "column",
		alignItems: "stretch",
		gap: 2,
	},
	goalName: { fontWeight: "700", flexShrink: 1 },
	numbers: { fontVariant: ["tabular-nums"], flexShrink: 0 },
	track: {
		height: 8,
		borderRadius: radius.pill,
		backgroundColor: colors.surface2,
		overflow: "hidden",
	},
	fill: { height: 8, borderRadius: radius.pill },
	minimumMarker: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: 2,
		backgroundColor: colors.text,
	},
	teaser: { height: 18, overflow: "hidden", paddingTop: 2 },
	teaserTrack: { paddingTop: 2 },
	emptyRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.md,
	},
	emptyCopy: { flex: 1, gap: spacing.xs },
	textButton: { minHeight: 44, justifyContent: "center" },
	menuBackdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: "rgba(0,0,0,0.6)",
		padding: spacing.md,
	},
	menuCard: {
		borderRadius: radius.sheet,
		backgroundColor: colors.surface,
		padding: spacing.md,
		gap: spacing.sm,
	},
	menuItem: { minHeight: 48, justifyContent: "center" },
});
