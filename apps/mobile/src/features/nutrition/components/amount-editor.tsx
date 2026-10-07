import type {
	NutrientKey,
	NutrientValue,
	PersonalFood,
	ServingOption,
} from "@workouts/core/nutrition";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useState } from "react";
import { Keyboard, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { servingKey } from "../../../data/nutrition-shortcuts";
import type { FoodVisual } from "../../../data/personal-food-repository";
import type { useSupplementaryServings } from "../../../data/supplementary-servings";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { FoodVisualView } from "../../../ui/food-visual";
import { GlassSurface } from "../../../ui/glass-surface";
import { SelectionMenu } from "../../../ui/selection-menu";
import { AppText } from "../../../ui/text";
import type { AmountSelection } from "../use-amount-selection";
import { AmountQuantity, AmountQuantityAccessory } from "./amount-quantity";
import { AmountServingPopup } from "./amount-serving-popup";
import { NutrientTable } from "./nutrient-table";

/** The servings an amount can switch to, and where a new one can go. */
export type AmountServings = {
	readonly choices: readonly ServingOption[];
	/** The serving the amount was saved with, offered as "previous value". */
	readonly historical?: ServingOption;
	/** The food behind the amount; new servings can only be added to one. */
	readonly source?: PersonalFood | { id: string };
	readonly additions: ReturnType<typeof useSupplementaryServings>;
};

/** The nutrient table: values for factor 1, scaled by `factor`. */
export type AmountTable = {
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly factor: number;
	readonly referenceFactor: number;
	readonly referenceLabel: string;
	/** The first column; "This item" unless the task names it. */
	readonly valueLabel?: string;
	/** All eight values instead of energy and macros, before something is logged. */
	readonly all?: boolean;
};

/**
 * The one amount editor (mobile-design "One amount editor"): quantity capsule,
 * serving menu, product card with its nutrient table, and a bottom toolbar.
 * Every amount task composes it; only the header, the table's columns and the
 * toolbar differ, and those belong to the wrapper.
 */
export function AmountEditor({
	name,
	visual,
	unit,
	selection,
	servings,
	table,
	quantity,
	onOpenDetails,
	caption,
	notice,
	below,
	toolbar,
	disabled,
	adding = false,
	onAddingChange,
	onCreatingChange,
}: {
	name: string;
	visual?: FoodVisual;
	unit: "g" | "ml" | "serving";
	selection: AmountSelection;
	/** Absent when the amount has no servings to choose, such as whole combos. */
	servings?: AmountServings;
	table: AmountTable;
	/** What the capsule counts in and steps by, when not the serving's own. */
	quantity?: { readonly unit?: string; readonly step?: number };
	onOpenDetails?: () => void;
	/** The card's line under the name, when it is not about product details. */
	caption?: string;
	notice?: ReactNode;
	below?: ReactNode;
	toolbar?: ReactNode;
	disabled: boolean;
	/** The new-serving popup is open; only with `servings`. */
	adding?: boolean;
	onAddingChange?: (adding: boolean) => void;
	onCreatingChange?: (creating: boolean) => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.diaryEntry;
	const colors = useTokens();
	const insets = useSafeAreaInsets();
	const [quantityEditing, setQuantityEditing] = useState(false);
	const { selected } = selection;
	const choices = servings?.choices ?? [];
	const historical = servings?.historical;
	const option = (item: ServingOption, i: number) => ({
		id: String(i),
		label: item.label[locale],
		selected: servingKey(selected) === servingKey(item),
	});
	const groups = [
		{
			title: name,
			options: [
				...(historical
					? [
							{
								id: "historical",
								label: `${historical.label[locale]} · ${t.nutrition.entryEditor.previousValue}`,
								selected: servingKey(selected) === servingKey(historical),
							},
						]
					: []),
				...choices.flatMap((item, i) =>
					item.kind === "authored" || item.kind === "supplementary"
						? [option(item, i)]
						: [],
				),
			],
		},
		{
			title: copy.personalMeasures,
			options: choices.flatMap((item, i) =>
				item.kind === "personal-measure" ? [option(item, i)] : [],
			),
		},
		{
			options: choices.flatMap((item, i) =>
				item.kind === "base-unit" ? [option(item, i)] : [],
			),
		},
		{
			options: [
				{
					id: "new",
					label: copy.newServing,
					emphasized: true,
					symbol: "plus" as const,
					disabled: !servings?.source && unit === "serving",
				},
			],
		},
	];
	return (
		<>
			<View style={{ flex: 1 }} collapsable={false}>
				<ScrollView
					style={{ flex: 1 }}
					pointerEvents={adding ? "none" : "auto"}
					accessibilityElementsHidden={adding}
					contentInsetAdjustmentBehavior="automatic"
					keyboardDismissMode="interactive"
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{
						padding: spacing.md,
						gap: spacing.sm,
						paddingBottom: spacing.xl,
					}}
				>
					<AmountQuantity
						value={selection.quantityText}
						amount={selection.amount}
						unit={quantity?.unit ?? unit}
						step={quantity?.step}
						baseUnitSelected={selected.kind === "base-unit"}
						valid={selection.valid}
						disabled={disabled || adding}
						onChange={selection.setQuantity}
						onEditingChange={setQuantityEditing}
					/>
					{servings ? (
						<GlassSurface
							capsule
							style={{
								alignSelf: "center",
								paddingHorizontal: spacing.sm,
								marginTop: 6,
							}}
						>
							<SelectionMenu
								label={selected.label[locale]}
								accessibilityLabel={copy.chooseServing}
								groups={groups}
								disabled={disabled || !selection.valid}
								onSelect={(id) => {
									Keyboard.dismiss();
									if (id === "new") onAddingChange?.(true);
									else if (id === "historical" && historical)
										selection.select(historical);
									else selection.select(choices[Number(id)]);
								}}
							/>
						</GlassSurface>
					) : null}
					{!selection.valid && (
						<AppText style={{ color: colors.danger }}>
							{copy.invalidQuantity}
						</AppText>
					)}
					<View
						testID="amount-editor-card"
						style={{
							backgroundColor: colors.surface,
							borderRadius: 26,
							borderCurve: "continuous",
							overflow: "hidden",
						}}
					>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.details}
							disabled={!onOpenDetails || adding}
							onPress={() => {
								Keyboard.dismiss();
								onOpenDetails?.();
							}}
							style={{
								paddingHorizontal: spacing.md,
								paddingVertical: 12,
								borderBottomWidth: 0.5,
								borderBottomColor: colors.separator,
								flexDirection: "row",
								alignItems: "center",
								gap: 12,
							}}
						>
							<FoodVisualView label={name} visual={visual} size={44} />
							<View style={{ flex: 1 }}>
								<AppText variant="control">{name}</AppText>
								<AppText variant="caption">
									{caption ??
										(onOpenDetails ? copy.detailsHint : copy.unavailable)}
								</AppText>
							</View>
							{onOpenDetails && (
								<SymbolView
									name={{
										ios: "chevron.right",
										android: "chevron_right",
										web: "chevron_right",
									}}
									size={20}
									tintColor={colors.textMuted}
								/>
							)}
						</Pressable>
						{notice}
						<NutrientTable compact {...table} />
					</View>
					{below}
				</ScrollView>
			</View>
			{toolbar ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: spacing.sm,
						paddingHorizontal: spacing.md,
						paddingBottom: Math.max(insets.bottom, spacing.md),
						paddingTop: spacing.sm,
					}}
				>
					{toolbar}
				</View>
			) : null}
			{adding && servings && (
				<AmountServingPopup
					food={servings.source}
					name={name}
					unit={unit}
					additions={servings.additions}
					onBusyChange={onCreatingChange}
					onCancel={() => onAddingChange?.(false)}
					onAdded={(added) => {
						selection.select(added);
						onAddingChange?.(false);
					}}
				/>
			)}
			{!adding && (
				<AmountQuantityAccessory
					baseUnitSelected={selected.kind === "base-unit"}
					onChange={selection.setQuantity}
					visible={quantityEditing && !disabled}
				/>
			)}
		</>
	);
}
