import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
	Alert,
	Keyboard,
	Platform,
	Pressable,
	ScrollView,
	TextInput,
	View,
} from "react-native";
import { todayIsoDate } from "../../../data/calendar-day";
import { scaleComboSnapshot } from "../../../data/nutrition-combo";
import type { Combo } from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, type, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { FoodVisualView } from "../../../ui/food-visual";
import { GlassSurface } from "../../../ui/glass-surface";
import type { RowAction } from "../../../ui/swipeable-row";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import type { FoodRowPosition } from "../components/food-row-layout";
import { NutritionChoiceMenu } from "../components/nutrition-choice-menu";
import { NutritionKeyboardOverlay } from "../components/nutrition-keyboard-overlay";
import { NutritionListRow } from "../components/nutrition-list-row";
import {
	comboDraft,
	comboTotals,
	moveComboPart,
	withoutMissingParts,
} from "./combo-parts";

function position(index: number, count: number): FoodRowPosition {
	if (count === 1) return "only";
	if (index === 0) return "first";
	return index === count - 1 ? "last" : "middle";
}

/**
 * A saved combo, edited in place: every confirmed change is written at once,
 * with no edit mode and no Save. Logged meals keep their own snapshots.
 */
export function ComboEditorScreen({ comboId }: { comboId: string }) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.comboEditor;
	const colors = useTokens();
	const toast = useToast();
	const confirm = useConfirm();
	const library = usePersonalFoods();
	const combo = library.findCombo(comboId);
	const [portion, setPortion] = useState<{
		partId: string;
		text: string;
	} | null>(null);

	if (!combo) return null;

	const write = (next: Combo) => {
		try {
			library.updateCombo(combo.id, comboDraft(next));
		} catch {
			toast.error(copy.saveFailure);
		}
	};
	const removePart = (partId: string) => {
		const part = combo.parts.find((item) => item.id === partId);
		if (!part) return;
		const before = combo;
		write({
			...combo,
			parts: combo.parts.filter((item) => item.id !== partId),
		});
		toast.success(fmt(copy.removed, { name: part.snapshot.name[locale] }), {
			action: { label: copy.undo, onPress: () => write(before) },
		});
	};
	const rename = () => {
		const save = (name?: string) => {
			if (name?.trim()) write({ ...combo, name: name.trim() });
		};
		if (Platform.OS === "ios")
			Alert.prompt(copy.renameTitle, undefined, save, "plain-text", combo.name);
		else save(combo.name);
	};
	const duplicate = () => {
		try {
			const draft = comboDraft(combo);
			const copyOf = library.createCombo({
				name: `${combo.name}${copy.copySuffix}`,
				parts: draft.parts.map(({ id: _id, ...part }) => part),
			});
			router.replace({
				pathname: "/nutrition-combo/[id]",
				params: { id: copyOf.id },
			});
		} catch {
			toast.error(copy.saveFailure);
		}
	};
	const remove = async () => {
		const ok = await confirm({
			title: t.nutrition.combos.deleteTitle,
			message: t.nutrition.combos.deleteBody,
			confirmLabel: t.nutrition.combos.delete,
			cancelLabel: copy.cancel,
			destructive: true,
		});
		if (!ok) return;
		library.removeCombo(combo.id);
		router.back();
	};
	const logCombo = () =>
		router.push({
			pathname: "/nutrition-combos",
			params: { comboId: combo.id, date: todayIsoDate() },
		});
	const savePortion = () => {
		if (!portion) return;
		const factor = Number(portion.text.replace(",", "."));
		Keyboard.dismiss();
		setPortion(null);
		if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
		write({
			...combo,
			parts: combo.parts.map((part) =>
				part.id === portion.partId
					? { ...part, snapshot: scaleComboSnapshot(part.snapshot, factor) }
					: part,
			),
		});
	};

	const totals = comboTotals(combo);
	const missing = combo.parts.filter((part) => part.status === "missing");
	const count = combo.parts.length;
	const partActions = (index: number): RowAction[] => {
		const part = combo.parts[index];
		const openable =
			part.reference.kind !== "oneOff" && part.status !== "missing";
		return [
			{
				key: "portion",
				label: copy.changePortion,
				systemImage: "pencil",
				onPress: () => setPortion({ partId: part.id, text: "" }),
			},
			...(openable
				? [
						{
							key: "open",
							label: copy.openFood,
							systemImage: "chevron.right" as const,
							swipe: false,
							dividerAfter: true,
							onPress: () =>
								part.reference.kind === "personal"
									? router.push({
											pathname: "/personal-food/[id]",
											params: { id: part.reference.foodId },
										})
									: router.push({
											pathname: "/nutrition-food-details",
											params: {
												source: "shipped",
												id:
													part.reference.kind === "shipped"
														? part.reference.foodId
														: "",
											},
										}),
						},
					]
				: []),
			...(index > 0
				? [
						{
							key: "up",
							label: copy.moveUp,
							systemImage: "arrow.up" as const,
							swipe: false,
							onPress: () => write(moveComboPart(combo, part.id, -1)),
						},
					]
				: []),
			...(index < count - 1
				? [
						{
							key: "down",
							label: copy.moveDown,
							systemImage: "arrow.down" as const,
							swipe: false,
							dividerAfter: true,
							onPress: () => write(moveComboPart(combo, part.id, 1)),
						},
					]
				: []),
			{
				key: "remove",
				label: copy.removePart,
				systemImage: "trash",
				destructive: true,
				onPress: () => removePart(part.id),
			},
		];
	};
	const moreMenu = (
		<NutritionChoiceMenu
			accessibilityLabel={copy.more}
			sections={[
				[{ id: "log", label: copy.log }],
				[
					{ id: "rename", label: copy.rename },
					{ id: "duplicate", label: copy.duplicate },
				],
				...(missing.length
					? [[{ id: "missing", label: copy.removeMissing }]]
					: []),
				[{ id: "delete", label: copy.delete, destructive: true }],
			]}
			onSelect={(id) => {
				if (id === "log") logCombo();
				else if (id === "rename") rename();
				else if (id === "duplicate") duplicate();
				else if (id === "missing") write(withoutMissingParts(combo));
				else void remove();
			}}
		>
			<View
				style={{
					width: 44,
					height: 44,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<SymbolView
					name={{ ios: "ellipsis", android: "more_horiz", web: "more_horiz" }}
					size={19}
					tintColor={colors.text}
				/>
			</View>
		</NutritionChoiceMenu>
	);
	const editingPart = portion
		? combo.parts.find((part) => part.id === portion.partId)
		: undefined;

	return (
		<>
			<Stack.Screen
				options={{
					title: combo.name,
					headerLargeTitleEnabled: true,
					headerLargeTitleStyle: { color: colors.text },
					headerTitleStyle: { color: colors.text },
					headerRight: Platform.OS === "ios" ? undefined : () => moreMenu,
				}}
			/>
			{Platform.OS === "ios" ? (
				<Stack.Toolbar placement="right">
					<Stack.Toolbar.View hidesSharedBackground>
						<GlassSurface capsule>{moreMenu}</GlassSurface>
					</Stack.Toolbar.View>
				</Stack.Toolbar>
			) : null}
			<ScrollView
				style={{ flex: 1, backgroundColor: colors.bg }}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingBottom: spacing.xxl * 2,
					gap: spacing.xs,
				}}
			>
				<AppText
					variant="footnote"
					style={{ marginHorizontal: 20, marginTop: -spacing.xs }}
				>
					{copy.subtitle}
				</AppText>
				<View
					style={{
						marginHorizontal: spacing.md,
						marginTop: spacing.sm,
						borderRadius: radius.contentCard,
						backgroundColor: colors.surface,
						overflow: "hidden",
					}}
				>
					<View
						style={{
							padding: spacing.md,
							flexDirection: "row",
							alignItems: "flex-start",
						}}
					>
						<View style={{ flex: 1, gap: 2 }}>
							<AppText variant="title">
								{totals.energy === undefined
									? "—"
									: Math.round(totals.energy).toLocaleString(locale)}{" "}
								<AppText variant="secondary">kcal</AppText>
							</AppText>
							<AppText variant="footnote">
								{fmt(copy.macros, {
									protein: Math.round(totals.protein ?? 0),
									carbs: Math.round(totals.carbs ?? 0),
									fat: Math.round(totals.fat ?? 0),
								})}
							</AppText>
						</View>
						<AppText variant="footnote">
							{count === 1 ? copy.partCountOne : fmt(copy.partCount, { count })}
						</AppText>
					</View>
					{missing.length ? (
						<Pressable
							accessibilityRole="button"
							onPress={() => write(withoutMissingParts(combo))}
							style={({ pressed }) => ({
								flexDirection: "row",
								alignItems: "center",
								gap: 12,
								padding: spacing.md,
								borderTopWidth: 0.5,
								borderTopColor: colors.separator,
								backgroundColor: pressed ? colors.surface2 : undefined,
							})}
						>
							<View
								style={{
									width: 30,
									height: 30,
									borderRadius: radius.md,
									backgroundColor: colors.warnSoft,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<SymbolView
									name={{
										ios: "exclamationmark.triangle",
										android: "warning",
										web: "warning",
									}}
									size={14}
									tintColor={colors.warn}
								/>
							</View>
							<View style={{ flex: 1 }}>
								<AppText variant="secondary" style={{ color: colors.text }}>
									{fmt(copy.missingTitle, {
										name: missing
											.map((part) => part.snapshot.name[locale])
											.join(", "),
									})}
								</AppText>
								<AppText variant="caption">{copy.missingBody}</AppText>
							</View>
						</Pressable>
					) : null}
				</View>
				<View
					style={{
						flexDirection: "row",
						marginHorizontal: 20,
						marginTop: spacing.md,
						marginBottom: 6,
					}}
				>
					<AppText
						variant="navTitle"
						accessibilityRole="header"
						style={{ flex: 1, fontWeight: "700" }}
					>
						{copy.parts}
					</AppText>
					<AppText variant="footnote">{count}</AppText>
				</View>
				{combo.parts.map((part, index) => {
					const energy = part.snapshot.nutrients.energy;
					return (
						<NutritionListRow
							key={part.id}
							title={part.snapshot.name[locale]}
							caption={
								part.status === "missing"
									? `⚠ ${copy.missingPart} · ${part.snapshot.serving[locale]}`
									: part.snapshot.serving[locale]
							}
							value={
								energy.kind === "value"
									? `${Math.round(energy.amount).toLocaleString(locale)} kcal`
									: undefined
							}
							leading={
								<FoodVisualView
									visual={
										part.reference.kind === "personal"
											? library.find(part.reference.foodId)?.visual
											: undefined
									}
									label={part.snapshot.name[locale]}
									size={38}
								/>
							}
							position={position(index, count)}
							selectLabel=""
							actions={partActions(index)}
							closeMenuLabel={copy.cancel}
							onPress={() => setPortion({ partId: part.id, text: "" })}
						/>
					);
				})}
				<AppText
					variant="caption"
					style={{ marginHorizontal: 20, marginTop: spacing.sm }}
				>
					{copy.footer}
				</AppText>
			</ScrollView>
			{editingPart && portion ? (
				<NutritionKeyboardOverlay>
					<View style={{ padding: spacing.sm }}>
						<GlassSurface
							style={{ padding: spacing.md, gap: spacing.sm, borderRadius: 26 }}
						>
							<AppText
								variant="secondary"
								style={{ fontWeight: "700", color: colors.text }}
							>
								{fmt(copy.portionTitle, {
									name: editingPart.snapshot.name[locale],
								})}
							</AppText>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: spacing.sm,
								}}
							>
								<TextInput
									autoFocus
									accessibilityLabel={fmt(copy.portionTitle, {
										name: editingPart.snapshot.name[locale],
									})}
									value={portion.text}
									placeholder="1"
									placeholderTextColor={colors.textFaint}
									keyboardType="decimal-pad"
									onChangeText={(text) => setPortion({ ...portion, text })}
									style={{
										...type.secondary,
										width: 84,
										minHeight: 44,
										paddingHorizontal: 12,
										borderRadius: radius.lg,
										backgroundColor: colors.surface2,
										color: colors.text,
										textAlign: "right",
									}}
								/>
								<AppText variant="footnote" style={{ flex: 1 }}>
									{copy.portionHint} ({editingPart.snapshot.serving[locale]})
								</AppText>
							</View>
							<View
								style={{
									flexDirection: "row",
									justifyContent: "flex-end",
									gap: spacing.sm,
								}}
							>
								<Pressable
									accessibilityRole="button"
									onPress={() => {
										Keyboard.dismiss();
										setPortion(null);
									}}
									style={{
										minHeight: 40,
										paddingHorizontal: spacing.md,
										justifyContent: "center",
									}}
								>
									<AppText style={{ color: colors.text }}>
										{copy.cancel}
									</AppText>
								</Pressable>
								<Pressable
									accessibilityRole="button"
									onPress={savePortion}
									style={{
										minHeight: 40,
										paddingHorizontal: spacing.md,
										borderRadius: radius.pill,
										backgroundColor: colors.accentFill,
										justifyContent: "center",
									}}
								>
									<AppText
										style={{ color: colors.onAccent, fontWeight: "700" }}
									>
										{copy.save}
									</AppText>
								</Pressable>
							</View>
						</GlassSurface>
					</View>
				</NutritionKeyboardOverlay>
			) : null}
		</>
	);
}
