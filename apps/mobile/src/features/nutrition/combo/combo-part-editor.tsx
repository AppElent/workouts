import {
	formatServingSelection,
	rescaleNutrients,
} from "@workouts/core/nutrition";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import type {
	ComboPart,
	ComboPartSnapshot,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, useTokens } from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";
import { AmountEditor } from "../components/amount-editor";
import { AmountEditorHeader } from "../components/amount-editor-header";
import { useAmountSelection } from "../components/use-amount-selection";
import { useSnapshotServings } from "../components/use-snapshot-servings";

/**
 * A combo part in the one amount editor. Saved mode edits the combo (toolbar:
 * replace and remove); once mode adjusts a single log and has no toolbar.
 * Values rescale from the part's saved snapshot, not its live source.
 */
export function ComboPartEditor({
	part,
	otherEnergy,
	mode,
	onCancel,
	onConfirm,
	onRemove,
	onReplace,
}: {
	part: ComboPart;
	/** The rest of the combo's kcal, for the new total under the table. */
	otherEnergy: number;
	mode: "saved" | "once";
	onCancel: () => void;
	onConfirm: (snapshot: ComboPartSnapshot) => void;
	onRemove?: () => void;
	onReplace?: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.comboEditor;
	const colors = useTokens();
	const library = usePersonalFoods();
	const { snapshot } = part;
	const { source, additions, choices, historical } =
		useSnapshotServings(snapshot);
	const selection = useAmountSelection({
		option: historical,
		quantity: snapshot.quantity,
		amount: snapshot.amount,
	});
	const [adding, setAdding] = useState(false);
	const factor = selection.valid ? selection.amount / snapshot.amount : 1;
	const energy = snapshot.nutrients.energy;
	const partEnergy = energy.kind === "value" ? energy.amount * factor : 0;
	const reference = snapshot.baseUnit === "serving" ? 1 : 100;
	const confirm = () => {
		if (!selection.valid) return;
		onConfirm({
			...snapshot,
			quantity: selection.quantity,
			amount: selection.amount,
			serving: {
				en: formatServingSelection(
					selection.selected,
					selection.quantity,
					"en",
				),
				nl: formatServingSelection(
					selection.selected,
					selection.quantity,
					"nl",
				),
			},
			nutrients: rescaleNutrients(snapshot.nutrients, factor),
		});
	};
	const tool = (
		label: string,
		glyph: "arrow.triangle.2.circlepath" | "trash",
		onPress: () => void,
		danger = false,
	) => (
		<GlassSurface capsule>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				disabled={adding}
				onPress={onPress}
				style={{
					minWidth: 48,
					minHeight: 48,
					paddingHorizontal: glyph === "trash" ? 0 : spacing.md,
					borderRadius: radius.pill,
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 6,
				}}
			>
				<SymbolView
					name={glyph}
					size={18}
					tintColor={danger ? colors.danger : colors.text}
				/>
				{glyph === "trash" ? null : (
					<AppText style={{ color: colors.text }}>{label}</AppText>
				)}
			</Pressable>
		</GlassSurface>
	);
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<AmountEditorHeader
				title={snapshot.name[locale]}
				subtitle={mode === "once" ? copy.onlyThisTime : copy.partTitle}
				closeLabel={copy.cancel}
				confirmLabel={copy.confirm}
				canConfirm={selection.valid && selection.changed}
				busy={false}
				busyLabel={copy.confirm}
				disabled={adding}
				onClose={onCancel}
				onConfirm={confirm}
			/>
			<AmountEditor
				name={snapshot.name[locale]}
				visual={
					part.reference.kind === "personal"
						? library.find(part.reference.foodId)?.visual
						: undefined
				}
				unit={snapshot.baseUnit}
				selection={selection}
				choices={part.status === "missing" ? [] : choices}
				historical={historical}
				source={source}
				additions={additions}
				nutrients={snapshot.nutrients}
				factor={factor}
				referenceFactor={reference / snapshot.amount}
				referenceLabel={`${reference} ${snapshot.baseUnit}`}
				onOpenDetails={
					source && part.reference.kind !== "oneOff"
						? () =>
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
										})
						: undefined
				}
				below={
					<AppText variant="footnote" style={{ paddingHorizontal: spacing.xs }}>
						{fmt(copy.newTotal, {
							kcal: Math.round(otherEnergy + partEnergy).toLocaleString(locale),
						})}
					</AppText>
				}
				disabled={false}
				adding={adding}
				onAddingChange={setAdding}
				toolbar={
					mode === "saved" ? (
						<>
							{onReplace
								? tool(copy.replace, "arrow.triangle.2.circlepath", onReplace)
								: null}
							<View style={{ flex: 1 }} />
							{onRemove ? tool(copy.removePart, "trash", onRemove, true) : null}
						</>
					) : undefined
				}
			/>
		</View>
	);
}
