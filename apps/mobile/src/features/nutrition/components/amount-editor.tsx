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
import { AmountQuantity, AmountQuantityAccessory } from "./amount-quantity";
import { AmountServingPopup } from "./amount-serving-popup";
import { NutrientTable } from "./nutrient-table";
import type { AmountSelection } from "./use-amount-selection";

/**
 * The one amount editor (mobile-design "One amount editor"): quantity capsule,
 * serving menu, product card with its nutrient table, and a bottom toolbar.
 * Every amount task composes it; only the header, the table's reference
 * column and the toolbar differ, and those belong to the wrapper.
 */
export function AmountEditor({
	name,
	visual,
	unit,
	selection,
	choices,
	historical,
	source,
	additions,
	nutrients,
	factor,
	referenceFactor,
	referenceLabel,
	onOpenDetails,
	notice,
	below,
	toolbar,
	disabled,
	adding,
	onAddingChange,
	onCreatingChange,
	servingMenu = true,
	allNutrients = false,
}: {
	name: string;
	visual?: FoodVisual;
	unit: "g" | "ml" | "serving";
	selection: AmountSelection;
	choices: readonly ServingOption[];
	/** The serving the amount was saved with, offered as "previous value". */
	historical?: ServingOption;
	/** The food behind the amount; new servings can only be added to one. */
	source?: PersonalFood | { id: string };
	additions: ReturnType<typeof useSupplementaryServings>;
	/** Values for `factor` = 1, scaled for the current amount by `factor`. */
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	factor: number;
	referenceFactor: number;
	referenceLabel: string;
	onOpenDetails?: () => void;
	notice?: ReactNode;
	below?: ReactNode;
	toolbar?: ReactNode;
	disabled: boolean;
	adding: boolean;
	onAddingChange: (adding: boolean) => void;
	onCreatingChange?: (creating: boolean) => void;
	/** False when the amount has no servings to choose, such as whole combos. */
	servingMenu?: boolean;
	/** All eight values instead of energy and macros, before something is logged. */
	allNutrients?: boolean;
}) {
	const { t, locale } = useI18n();
	const copy = t.diaryEntry;
	const colors = useTokens();
	const insets = useSafeAreaInsets();
	const [quantityEditing, setQuantityEditing] = useState(false);
	const { selected } = selection;
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
					disabled: !source && unit === "serving",
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
						unit={unit}
						baseUnitSelected={selected.kind === "base-unit"}
						valid={selection.valid}
						disabled={disabled || adding}
						onChange={selection.setQuantity}
						onEditingChange={setQuantityEditing}
					/>
					{servingMenu ? (
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
									if (id === "new") onAddingChange(true);
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
									{onOpenDetails ? copy.detailsHint : copy.unavailable}
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
						<NutrientTable
							compact
							all={allNutrients}
							nutrients={nutrients}
							factor={factor}
							referenceFactor={referenceFactor}
							referenceLabel={referenceLabel}
						/>
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
			{adding && (
				<AmountServingPopup
					food={source}
					name={name}
					unit={unit}
					additions={additions}
					onBusyChange={(busy) => onCreatingChange?.(busy)}
					onCancel={() => onAddingChange(false)}
					onAdded={(added) => {
						selection.select(added);
						onAddingChange(false);
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
