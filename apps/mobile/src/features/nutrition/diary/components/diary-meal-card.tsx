import { roundForDisplay, totalNutrients } from "@workouts/core/nutrition";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { DiaryEntry, MealSlot } from "../../../../data/nutrition-day";
import type { CaptureDraft } from "../../../../data/nutrition-draft-repository";
import { fmt, useI18n } from "../../../../i18n";
import { spacing, useTokens } from "../../../../theme";
import { FoodVisualView } from "../../../../ui/food-visual";
import { InsetList, InsetRow } from "../../../../ui/inset-list";
import { AppText } from "../../../../ui/text";
import { DiaryMealMenu } from "./diary-meal-menu";

export function DiaryMealCard({
	slot,
	entries,
	drafts,
	complete,
	selecting,
	selected,
	onToggle,
	onSelect,
	onAdd,
	onEdit,
	onDelete,
	onTransfer,
	onCombo,
	onResolveDraft,
	onEditDraft,
	onDeleteDraft,
}: {
	slot: MealSlot;
	entries: DiaryEntry[];
	drafts: CaptureDraft[];
	complete: boolean;
	selecting: boolean;
	selected: ReadonlySet<string>;
	onToggle: (entries: readonly DiaryEntry[]) => void;
	onSelect: (entries: readonly DiaryEntry[]) => void;
	onAdd: () => void;
	onEdit: (entry: DiaryEntry) => void;
	onDelete: (entry: DiaryEntry) => void;
	onTransfer: (entries: readonly DiaryEntry[], mode: "copy" | "move") => void;
	onCombo: (entries: readonly DiaryEntry[]) => void;
	onResolveDraft: (draft: CaptureDraft) => void;
	onEditDraft: (draft: CaptureDraft) => void;
	onDeleteDraft: (draft: CaptureDraft) => void;
}) {
	const { t, locale } = useI18n();
	const colors = useTokens();
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
	const total = totalNutrients(entries.map((e) => e.nutrients)).energy;
	const kcal = (value: DiaryEntry["nutrients"]["energy"]) =>
		value.kind === "value"
			? `${roundForDisplay("energy", value.amount)} kcal`
			: value.kind === "trace"
				? t.nutrition.foodBrowser.trace
				: t.nutrition.foodBrowser.absent;
	const selectLabel = locale === "nl" ? "Items selecteren" : "Select items";
	const actions = [
		{
			label: selectLabel,
			systemImage: "checkmark.circle" as const,
			dividerAfter: true,
			onPress: () => onSelect(entries),
		},
		{
			label: t.nutrition.day.copyMeal,
			menuLabel: `${t.nutrition.day.copyMeal}…`,
			systemImage: "doc.on.doc" as const,
			onPress: () => onTransfer(entries, "copy"),
		},
		{
			label: locale === "nl" ? "Maaltijd verplaatsen…" : "Move meal…",
			systemImage: "arrow.right" as const,
			onPress: () => onTransfer(entries, "move"),
		},
		{
			label: t.nutrition.combos.create,
			systemImage: "square.grid.2x2" as const,
			onPress: () => onCombo(entries),
		},
	];
	const consumed = new Set<string>();
	const row = (entry: DiaryEntry) => (
		<InsetRow
			key={entry.id}
			id={entry.id}
			selected={selecting ? selected.has(entry.id) : undefined}
			title={entry.name[locale]}
			secondary={`${entry.serving[locale]}${entry.comboGroup ? ` · ${entry.comboGroup.name}` : ""}`}
			value={kcal(entry.nutrients.energy)}
			leading={
				<View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
					{selecting ? (
						<SymbolView
							name={selected.has(entry.id) ? "checkmark.circle.fill" : "circle"}
							size={22}
							tintColor={
								selected.has(entry.id) ? colors.accent : colors.textMuted
							}
						/>
					) : null}
					<FoodVisualView
						visual={entry.visual}
						label={entry.name[locale]}
						size={38}
					/>
					{entry.estimated ? (
						<SymbolView
							name="sparkles"
							size={14}
							tintColor={colors.textMuted}
							accessibilityLabel={
								locale === "nl"
									? "Geschatte voedingswaarden"
									: "Estimated nutrition"
							}
						/>
					) : null}
				</View>
			}
			accessibilityLabel={
				fmt(
					selecting
						? t.nutrition.combos.selectEntry
						: t.nutrition.entryEditor.editEntry,
					{ name: entry.name[locale] },
				) +
				(entry.estimated
					? locale === "nl"
						? ". Geschatte voedingswaarden"
						: ". Estimated nutrition"
					: "")
			}
			onPress={() => (selecting ? onToggle([entry]) : onEdit(entry))}
			actions={
				selecting
					? undefined
					: [
							{
								key: "edit",
								menuLabel: locale === "nl" ? "Bewerken" : "Edit",
								systemImage: "pencil",
								label: t.nutrition.entryActions.edit,
								onPress: () => onEdit(entry),
							},
							{
								key: "select",
								menuLabel: locale === "nl" ? "Selecteer" : "Select",
								systemImage: "checkmark.circle",
								dividerAfter: true,
								label: selectLabel,
								onPress: () => onSelect([entry]),
								swipe: false,
							},
							{
								key: "copy",
								menuLabel: locale === "nl" ? "Kopiëren…" : "Copy…",
								systemImage: "doc.on.doc",
								label: locale === "nl" ? "Kopiëren" : "Copy",
								onPress: () => onTransfer([entry], "copy"),
								swipe: false,
							},
							{
								key: "move",
								menuLabel: locale === "nl" ? "Verplaatsen…" : "Move…",
								systemImage: "arrow.right",
								dividerAfter: true,
								label: locale === "nl" ? "Verplaatsen" : "Move",
								onPress: () => onTransfer([entry], "move"),
								swipe: false,
							},
							{
								key: "delete",
								menuLabel: locale === "nl" ? "Verwijderen" : "Delete",
								systemImage: "trash",
								label: t.nutrition.entryActions.delete,
								onPress: () => onDelete(entry),
								destructive: true,
							},
						]
			}
		/>
	);
	return (
		<InsetList
			compact
			headerContent={
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
						paddingHorizontal: spacing.md,
						paddingVertical: 10,
						minHeight: 64,
					}}
				>
					<View style={{ flex: 1 }}>
						{entries.length && !selecting ? (
							<DiaryMealMenu
								title={`${t.nutrition.meals[slot]} · ${entries.length} items`}
								label={`${t.nutrition.meals[slot]}: ${locale === "nl" ? "acties" : "actions"}`}
								closeLabel={t.diaryEntry.cancel}
								actions={actions}
								trigger={{
									content: (
										<AppText variant="row">{t.nutrition.meals[slot]} ⌄</AppText>
									),
									style: { alignItems: "flex-start" },
								}}
							/>
						) : (
							<AppText variant="row">{t.nutrition.meals[slot]}</AppText>
						)}
						<AppText variant="caption">
							{entries.length
								? `${entries.length} items · ${total?.incomplete ? "≥ " : ""}${roundForDisplay("energy", total?.amount ?? 0)} kcal`
								: drafts.length
									? `${drafts.length} ${locale === "nl" ? "notitie" : "note"}`
									: complete
										? locale === "nl"
											? "Nog niets"
											: "Nothing yet"
										: t.nutrition.offline.uncachedMeal}
						</AppText>
					</View>
					{selecting ? (
						entries.length > 0 ? (
							<Pressable
								accessibilityRole="button"
								onPress={() => onToggle(entries)}
								style={{ minHeight: 48, justifyContent: "center" }}
							>
								<AppText style={{ color: colors.accent }}>
									{entries.every((e) => selected.has(e.id))
										? locale === "nl"
											? "Geen"
											: "None"
										: locale === "nl"
											? "Alles"
											: "All"}
								</AppText>
							</Pressable>
						) : null
					) : (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={fmt(t.nutrition.addTo, {
								meal: t.nutrition.meals[slot],
							})}
							onPress={onAdd}
							style={{
								width: 48,
								height: 48,
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<View
								style={{
									width: 32,
									height: 32,
									borderRadius: 16,
									backgroundColor: colors.surface2,
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<SymbolView name="plus" size={18} tintColor={colors.accent} />
							</View>
						</Pressable>
					)}
				</View>
			}
		>
			{entries.flatMap((entry) => {
				if (!entry.comboGroup) return [row(entry)];
				const group = entry.comboGroup;
				if (consumed.has(group.id)) return [];
				consumed.add(group.id);
				const parts = entries.filter((e) => e.comboGroup?.id === group.id);
				const open = expanded.has(group.id);
				return [
					<InsetRow
						key={group.id}
						title={group.name}
						selected={
							selecting ? parts.every((p) => selected.has(p.id)) : undefined
						}
						accessibilityLabel={
							selecting
								? `Select Combo ${group.name}`
								: `${open ? "Collapse" : "Expand"} Combo ${group.name}`
						}
						secondary={`COMBO · ${parts.length} ${locale === "nl" ? "onderdelen" : "parts"}`}
						value={`${roundForDisplay("energy", totalNutrients(parts.map((e) => e.nutrients)).energy?.amount ?? 0)} kcal`}
						leading={{
							symbol: selecting
								? parts.every((p) => selected.has(p.id))
									? "checkmark.circle.fill"
									: "circle"
								: "square.stack",
						}}
						chevron
						onPress={() =>
							selecting
								? onToggle(parts)
								: setExpanded((current) => {
										const next = new Set(current);
										if (open) next.delete(group.id);
										else next.add(group.id);
										return next;
									})
						}
						actions={[
							{
								key: "select",
								menuLabel: locale === "nl" ? "Selecteer" : "Select",
								systemImage: "checkmark.circle",
								dividerAfter: true,
								label: selectLabel,
								onPress: () => onSelect(parts),
								swipe: false,
							},
							{
								key: "copy",
								menuLabel: locale === "nl" ? "Kopiëren…" : "Copy…",
								systemImage: "doc.on.doc",
								label: locale === "nl" ? "Kopiëren" : "Copy",
								onPress: () => onTransfer(parts, "copy"),
								swipe: false,
							},
							{
								key: "move",
								menuLabel: locale === "nl" ? "Verplaatsen…" : "Move…",
								systemImage: "arrow.right",
								dividerAfter: true,
								label: locale === "nl" ? "Verplaatsen" : "Move",
								onPress: () => onTransfer(parts, "move"),
								swipe: false,
							},
						]}
					/>,
					...(open && !selecting ? parts.map(row) : []),
				];
			})}
			{!selecting
				? drafts.map((draft) => (
						<InsetRow
							key={draft.id}
							accessibilityLabel={fmt(t.nutrition.drafts.resolve, {
								note: draft.note,
							})}
							title={draft.note}
							secondary={t.nutrition.drafts.onDevice}
							value={locale === "nl" ? "Verwerk" : "Review"}
							leading={{ symbol: "note.text" }}
							onPress={() => onResolveDraft(draft)}
							actions={[
								{
									key: "edit",
									menuLabel: locale === "nl" ? "Bewerken" : "Edit",
									systemImage: "pencil",
									label: t.nutrition.entryActions.edit,
									onPress: () => onEditDraft(draft),
								},
								{
									key: "delete",
									menuLabel: locale === "nl" ? "Verwijderen" : "Delete",
									systemImage: "trash",
									label: t.nutrition.entryActions.delete,
									onPress: () => onDeleteDraft(draft),
									destructive: true,
								},
							]}
						/>
					))
				: null}
		</InsetList>
	);
}
