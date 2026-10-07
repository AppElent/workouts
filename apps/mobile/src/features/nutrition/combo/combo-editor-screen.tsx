import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { todayIsoDate } from "../../../data/calendar-day";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../../../data/nutrition-operation-service";
import { comboSourceKey } from "../../../data/nutrition-shortcuts";
import type { Combo } from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { FoodVisualView } from "../../../ui/food-visual";
import { GlassSurface } from "../../../ui/glass-surface";
import { InsetList, InsetRow } from "../../../ui/inset-list";
import type { RowAction } from "../../../ui/swipeable-row";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { NutritionChoiceMenu } from "../components/nutrition-choice-menu";
import { NutritionEnergyValue } from "../components/nutrition-energy-value";
import { openComboPartSource } from "./combo-part-source";
import {
	comboDraft,
	comboTotals,
	kcalText,
	moveComboPart,
	withoutMissingParts,
} from "./combo-parts";
import { ComboRenameSheet } from "./components/combo-rename-sheet";

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
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const [renaming, setRenaming] = useState(false);
	const combo = library.findCombo(comboId);

	if (!combo) return null;
	const favoriteKey = comboSourceKey(combo.id);
	const favorite = subject
		? operations
				.listFavorites(subject)
				.some((shortcut) => shortcut.sourceKey === favoriteKey)
		: false;

	const write = (next: Combo) => {
		try {
			library.updateCombo(combo.id, comboDraft(next));
		} catch {
			toast.error(copy.saveFailure);
		}
	};
	const openPart = (partId: string) =>
		router.push({
			pathname: "/nutrition-combo-part",
			params: { comboId: combo.id, partId },
		});
	const replacePart = (partId: string) =>
		router.push({
			pathname: "/nutrition-food",
			params: { comboId: combo.id, replacePartId: partId },
		});
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
	const saveName = (name?: string) => {
		if (name?.trim()) write({ ...combo, name: name.trim() });
	};
	// iOS asks in a system prompt; Android has none, so a small sheet asks.
	const rename = () =>
		Platform.OS === "ios"
			? Alert.prompt(
					copy.renameTitle,
					undefined,
					saveName,
					"plain-text",
					combo.name,
				)
			: setRenaming(true);
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
			pathname: "/nutrition-combo-log",
			params: { comboId: combo.id, date: todayIsoDate() },
		});
	const toggleFavorite = () => {
		if (subject) operations.toggleFavorite(subject, favoriteKey, !favorite);
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
				onPress: () => openPart(part.id),
			},
			{
				key: "replace",
				label: copy.replace,
				systemImage: "arrow.triangle.2.circlepath",
				swipe: false,
				onPress: () => replacePart(part.id),
			},
			...(openable
				? [
						{
							key: "open",
							label: copy.openFood,
							systemImage: "chevron.right" as const,
							swipe: false,
							dividerAfter: true,
							onPress: () => openComboPartSource(part.reference),
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
					{ id: "favorite", label: favorite ? copy.unfavorite : copy.favorite },
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
				else if (id === "favorite") toggleFavorite();
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
							accessibilityHint={copy.replace}
							onPress={() => replacePart(missing[0].id)}
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
				<View style={{ marginHorizontal: spacing.md }}>
					<InsetList compact>
						{combo.parts.map((part, index) => {
							const energy = part.snapshot.nutrients.energy;
							const caption =
								part.status === "missing"
									? `⚠ ${copy.missingPart} · ${part.snapshot.serving[locale]}`
									: part.snapshot.serving[locale];
							const value = kcalText(energy, locale);
							return (
								<InsetRow
									key={part.id}
									id={part.id}
									title={part.snapshot.name[locale]}
									secondary={caption}
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
									trailing={<NutritionEnergyValue value={value} />}
									chevron
									accessibilityLabel={`${part.snapshot.name[locale]}, ${caption}${value ? `, ${value}` : ""}`}
									actions={partActions(index)}
									onPress={() => openPart(part.id)}
								/>
							);
						})}
						<InsetRow
							id="add-part"
							leading={{ symbol: "plus" }}
							title={copy.addPart}
							onPress={() =>
								router.push({
									pathname: "/nutrition-food",
									params: { comboId: combo.id },
								})
							}
						/>
					</InsetList>
				</View>
				<AppText
					variant="caption"
					style={{ marginHorizontal: 20, marginTop: spacing.sm }}
				>
					{copy.footer}
				</AppText>
			</ScrollView>
			<ComboRenameSheet
				visible={renaming}
				title={copy.renameTitle}
				name={combo.name}
				label={copy.name}
				cancelLabel={copy.cancel}
				saveLabel={copy.confirm}
				onCancel={() => setRenaming(false)}
				onSave={(name) => {
					setRenaming(false);
					saveName(name);
				}}
			/>
		</>
	);
}
