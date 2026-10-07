import { router, Stack, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { todayIsoDate } from "../../../data/calendar-day";
import { useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { GlassSurface } from "../../../ui/glass-surface";
import { AppText } from "../../../ui/text";
import { AmountDestination } from "../components/amount-destination";
import { AmountEditor } from "../components/amount-editor";
import {
	type DiaryEntryEditorProps,
	useDiaryEntryEditor,
} from "./use-diary-entry-editor";

export function DiaryEntryEditorScreen(props: DiaryEntryEditorProps) {
	const { t, locale } = useI18n();
	const copy = t.diaryEntry;
	const colors = useTokens();
	const _insets = useSafeAreaInsets();
	const confirm = useConfirm();
	const navigation = useNavigation();
	const [leaving, setLeaving] = useState(false);
	const draft = useDiaryEntryEditor({
		...props,
		onClose: () => setLeaving(true),
	});
	const [_quantityEditing, _setQuantityEditing] = useState(false);
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
	const [_dateOpen, _setDateOpen] = useState(false);
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
	const validAmount = draft.valid ? draft.amount : entry.amount;
	const _today = todayIsoDate();
	const action = (
		label: string,
		glyph: ComponentProps<typeof SymbolView>["name"],
		onPress: () => void,
		disabled = false,
		danger = false,
		accent = false,
	) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={{
				minHeight: 48,
				minWidth: 48,
				alignItems: "center",
				justifyContent: "center",
				opacity: disabled ? 0.4 : 1,
				borderRadius: 24,
				backgroundColor: accent ? colors.accentFill : undefined,
			}}
		>
			<SymbolView
				name={glyph}
				tintColor={
					danger ? colors.danger : accent ? colors.onAccent : colors.text
				}
				size={22}
			/>
		</Pressable>
	);
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<Stack.Screen
				options={{
					title: t.nutrition.entryEditor.title,
					headerShown: true,
					headerTitleStyle: { color: colors.text },
					headerLeft: () =>
						action(
							copy.cancel,
							{ ios: "xmark", android: "close", web: "close" },
							props.onClose,
							draft.busy || adding,
						),
					// Native items let UIKit tint the glass itself, without a nested fill.
					unstable_headerRightItems: () =>
						draft.busy
							? [
									{
										type: "custom",
										element: (
											<ActivityIndicator
												accessibilityLabel={t.nutrition.entryEditor.saving}
											/>
										),
									},
								]
							: [
									{
										type: "button",
										label: t.nutrition.entryEditor.save,
										accessibilityLabel: t.nutrition.entryEditor.save,
										icon: { type: "sfSymbol", name: "checkmark" },
										variant: draft.dirty ? "prominent" : "plain",
										tintColor: draft.dirty ? colors.accentFill : colors.text,
										disabled: adding || !draft.valid || !draft.dirty,
										onPress: draft.save,
									},
								],
					headerRight: () =>
						draft.busy ? (
							<ActivityIndicator
								accessibilityLabel={t.nutrition.entryEditor.saving}
							/>
						) : (
							action(
								t.nutrition.entryEditor.save,
								{ ios: "checkmark", android: "check", web: "check" },
								draft.save,
								draft.busy || adding || !draft.valid || !draft.dirty,
								false,
								draft.dirty,
							)
						),
				}}
			/>
			<AmountEditor
				name={entry.name[locale]}
				visual={entry.visual}
				unit={entry.baseUnit}
				selection={draft.selection}
				choices={draft.choices}
				historical={draft.historical}
				source={draft.source}
				additions={draft.additions}
				nutrients={entry.nutrients}
				factor={validAmount / entry.amount}
				referenceFactor={
					(entry.baseUnit === "serving" ? 1 : 100) / entry.amount
				}
				referenceLabel={`${entry.baseUnit === "serving" ? 1 : 100} ${entry.baseUnit}`}
				onOpenDetails={
					draft.source
						? () =>
								router.push({
									pathname: "/nutrition-food-details",
									params: {
										source: entry.provenance.source,
										id:
											"sourceId" in entry.provenance
												? entry.provenance.sourceId
												: "",
									},
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
						<GlassSurface capsule>
							{action(
								t.nutrition.entryEditor.delete,
								{ ios: "trash", android: "delete", web: "delete" },
								draft.remove,
								draft.busy || adding,
								true,
							)}
						</GlassSurface>
					</>
				}
			/>
		</View>
	);
}
