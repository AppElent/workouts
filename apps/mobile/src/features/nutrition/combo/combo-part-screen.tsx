import { router } from "expo-router";
import { useEffect } from "react";
import type { ComboPartDraft } from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { useToast } from "../../../ui/toast";
import { ComboPartEditor } from "./combo-part-editor";
import { comboDraft, comboTotals, snapshotEnergy } from "./combo-parts";

/**
 * A saved combo part in its own sheet. ✓ and remove write the combo at once
 * and close; remove offers undo. Replace hands over to the food browser.
 */
export function ComboPartScreen({
	comboId,
	partId,
	onClose,
}: {
	comboId: string;
	partId: string;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.comboEditor;
	const toast = useToast();
	const library = usePersonalFoods();
	const combo = library.findCombo(comboId);
	const part = combo?.parts.find((item) => item.id === partId);
	useEffect(() => {
		if (!part) onClose();
	}, [part, onClose]);
	if (!combo || !part) return null;
	const draft = comboDraft(combo);
	const comboTotal = comboTotals(combo).energy ?? 0;
	const write = (parts: readonly ComboPartDraft[]) => {
		library.updateCombo(combo.id, { name: combo.name, parts });
		onClose();
	};
	return (
		<ComboPartEditor
			part={part}
			mode="saved"
			total={{
				name: combo.name,
				before: comboTotal,
				others: comboTotal - snapshotEnergy(part.snapshot),
			}}
			onCancel={onClose}
			onConfirm={(snapshot) => {
				try {
					write(
						draft.parts.map((item) =>
							item.id === part.id ? { ...item, snapshot } : item,
						),
					);
				} catch {
					toast.error(copy.saveFailure);
				}
			}}
			onRemove={() => {
				try {
					write(draft.parts.filter((item) => item.id !== part.id));
					toast.success(
						fmt(copy.removed, { name: part.snapshot.name[locale] }),
						{
							action: {
								label: copy.undo,
								onPress: () => library.updateCombo(combo.id, draft),
							},
						},
					);
				} catch {
					toast.error(copy.saveFailure);
				}
			}}
			onReplace={() => {
				// The browser takes the sheet's place rather than stacking on it.
				onClose();
				router.push({
					pathname: "/nutrition-food",
					params: { comboId: combo.id, replacePartId: part.id },
				});
			}}
		/>
	);
}
