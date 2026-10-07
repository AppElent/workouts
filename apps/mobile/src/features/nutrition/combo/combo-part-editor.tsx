import {
	formatServingSelection,
	rescaleNutrients,
} from "@workouts/core/nutrition";
import { useState } from "react";
import { View } from "react-native";
import type {
	ComboPart,
	ComboPartSnapshot,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import { AmountEditor } from "../components/amount-editor";
import { AmountEditorHeader } from "../components/amount-editor-header";
import { AmountSheetHeader } from "../components/amount-sheet-header";
import { AmountToolbarButton } from "../components/amount-toolbar-button";
import { useAmountSelection } from "../use-amount-selection";
import { useSnapshotServings } from "../use-snapshot-servings";
import { openComboPartSource } from "./combo-part-source";
import { snapshotEnergy } from "./combo-parts";

/**
 * A combo part in the one amount editor. Saved mode edits the combo in its
 * own routed sheet (toolbar: replace and remove); once mode adjusts a single
 * log inside the log sheet and has no toolbar. Values rescale from the part's
 * saved snapshot, not its live source.
 */
export function ComboPartEditor({
	part,
	mode,
	total,
	onCancel,
	onConfirm,
	onRemove,
	onReplace,
}: {
	part: ComboPart;
	mode: "saved" | "once";
	/**
	 * For the line under the table: the combo's name, its kcal before this
	 * change, and the kcal of everything in it but this part.
	 */
	total: {
		readonly name: string;
		readonly before: number;
		readonly others: number;
	};
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
	const missing = part.status === "missing";
	const servings = useSnapshotServings(snapshot);
	const selection = useAmountSelection({
		option: servings.historical,
		quantity: snapshot.quantity,
		amount: snapshot.amount,
	});
	const [adding, setAdding] = useState(false);
	const factor = selection.valid ? selection.amount / snapshot.amount : 1;
	const before = Math.round(total.before);
	const after = Math.round(total.others + snapshotEnergy(snapshot) * factor);
	const reference = snapshot.baseUnit === "serving" ? 1 : 100;
	const canConfirm = selection.valid && selection.changed;
	const confirm = () => {
		if (!canConfirm) return;
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
	const totalLine = fmt(
		mode === "once"
			? after === before
				? copy.onceTotal
				: copy.onceTotalChanged
			: after === before
				? copy.savedTotal
				: copy.savedTotalChanged,
		{
			name: total.name,
			before: before.toLocaleString(locale),
			after: after.toLocaleString(locale),
		},
	);
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			{mode === "saved" ? (
				<AmountSheetHeader
					title={copy.partTitle}
					closeLabel={copy.cancel}
					confirmLabel={copy.confirm}
					canConfirm={canConfirm}
					disabled={adding}
					onClose={onCancel}
					onConfirm={confirm}
				/>
			) : (
				<AmountEditorHeader
					title={copy.onlyThisTime}
					subtitle={total.name}
					closeLabel={copy.cancel}
					confirmLabel={copy.confirm}
					canConfirm={canConfirm}
					disabled={adding}
					onClose={onCancel}
					onConfirm={confirm}
				/>
			)}
			<AmountEditor
				name={snapshot.name[locale]}
				visual={
					part.reference.kind === "personal"
						? library.find(part.reference.foodId)?.visual
						: undefined
				}
				unit={snapshot.baseUnit}
				selection={selection}
				servings={
					missing ? { ...servings, choices: [], source: undefined } : servings
				}
				table={{
					nutrients: snapshot.nutrients,
					factor,
					referenceFactor: reference / snapshot.amount,
					referenceLabel: `${reference} ${snapshot.baseUnit}`,
					valueLabel: mode === "once" ? copy.thisTime : copy.thisPart,
				}}
				caption={
					missing
						? copy.missingCaption
						: servings.source
							? undefined
							: copy.savedValues
				}
				onOpenDetails={
					servings.source && !missing
						? () => openComboPartSource(part.reference)
						: undefined
				}
				below={
					<AppText variant="footnote" style={{ paddingHorizontal: spacing.xs }}>
						{totalLine}
					</AppText>
				}
				disabled={false}
				adding={adding}
				onAddingChange={setAdding}
				toolbar={
					mode === "saved" ? (
						<>
							{onReplace ? (
								<AmountToolbarButton
									label={copy.replace}
									symbol="arrow.triangle.2.circlepath"
									onPress={onReplace}
									disabled={adding}
								/>
							) : null}
							<View style={{ flex: 1 }} />
							{onRemove ? (
								<AmountToolbarButton
									label={copy.removePart}
									symbol="trash"
									onPress={onRemove}
									disabled={adding}
									destructive
									iconOnly
								/>
							) : null}
						</>
					) : undefined
				}
			/>
		</View>
	);
}
