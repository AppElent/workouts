import { router, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import { useEffect, useRef, useState } from "react";
import { Keyboard, View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { AppText } from "../../../ui/text";
import { AmountDestination } from "../components/amount-destination";
import { AmountEditor } from "../components/amount-editor";
import { AmountSheetHeader } from "../components/amount-sheet-header";
import { AmountToolbarButton } from "../components/amount-toolbar-button";
import {
	type DiaryEntryEditorProps,
	useDiaryEntryEditor,
} from "./use-diary-entry-editor";

export function DiaryEntryEditorScreen(props: DiaryEntryEditorProps) {
	const { t, locale } = useI18n();
	const copy = t.diaryEntry;
	const colors = useTokens();
	const confirm = useConfirm();
	const navigation = useNavigation();
	const [leaving, setLeaving] = useState(false);
	const draft = useDiaryEntryEditor({
		...props,
		onClose: () => setLeaving(true),
	});
	const [adding, setAdding] = useState(false);
	const [creating, setCreating] = useState(false);
	const pendingNavigation = useRef<(() => void) | null>(null);
	const [allowDiscard, setAllowDiscard] = useState(false);
	useEffect(() => {
		if (allowDiscard) {
			pendingNavigation.current?.();
			pendingNavigation.current = null;
		}
	}, [allowDiscard]);
	useEffect(() => {
		if (leaving) props.onClose();
	}, [leaving, props.onClose]);
	usePreventRemove(
		(draft.dirty || draft.busy || adding) && !leaving && !allowDiscard,
		({ data }) => {
			if (draft.busy || creating) return;
			if (adding) {
				Keyboard.dismiss();
				setAdding(false);
				return;
			}
			void confirm({
				title: copy.discardTitle,
				message: copy.discardBody,
				confirmLabel: copy.discard,
				cancelLabel: copy.keepEditing,
				destructive: true,
			}).then((ok) => {
				if (ok) {
					pendingNavigation.current = () => navigation.dispatch(data.action);
					setAllowDiscard(true);
				}
			});
		},
	);
	const entry = props.entry;
	const validAmount = draft.selection.valid
		? draft.selection.amount
		: entry.amount;
	const reference = entry.baseUnit === "serving" ? 1 : 100;
	const sourceId =
		"sourceId" in entry.provenance ? entry.provenance.sourceId : undefined;
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<AmountSheetHeader
				title={t.nutrition.entryEditor.title}
				closeLabel={copy.cancel}
				confirmLabel={t.nutrition.entryEditor.save}
				canConfirm={draft.valid && draft.dirty}
				busy={draft.busy}
				busyLabel={t.nutrition.entryEditor.saving}
				disabled={adding}
				onClose={props.onClose}
				onConfirm={draft.save}
			/>
			<AmountEditor
				name={entry.name[locale]}
				visual={entry.visual}
				unit={entry.baseUnit}
				selection={draft.selection}
				servings={draft.servings}
				table={{
					nutrients: entry.nutrients,
					factor: validAmount / entry.amount,
					referenceFactor: reference / entry.amount,
					referenceLabel: `${reference} ${entry.baseUnit}`,
				}}
				onOpenDetails={
					draft.servings.source && sourceId
						? () =>
								router.push({
									pathname: "/nutrition-food-details",
									params: { source: entry.provenance.source, id: sourceId },
								})
						: undefined
				}
				notice={
					entry.correctedNutrients?.length ? (
						<AppText variant="caption" style={{ padding: spacing.md }}>
							{locale === "nl"
								? "Aangevuld voor deze invoer: "
								: "Corrected for this entry: "}
							{entry.correctedNutrients
								.map((n) => t.nutrition.nutrients[n])
								.join(", ")}
						</AppText>
					) : null
				}
				disabled={draft.busy}
				adding={adding}
				onAddingChange={setAdding}
				onCreatingChange={setCreating}
				toolbar={
					<>
						<AmountDestination
							meal={draft.nextMeal}
							date={draft.nextDate}
							disabled={draft.busy || adding}
							onMealChange={draft.setMeal}
							onDateChange={draft.setDate}
						/>
						<View style={{ flex: 1 }} />
						<AmountToolbarButton
							label={t.nutrition.entryEditor.delete}
							symbol={{ ios: "trash", android: "delete", web: "delete" }}
							onPress={draft.remove}
							disabled={draft.busy || adding}
							destructive
							iconOnly
						/>
					</>
				}
			/>
		</View>
	);
}
