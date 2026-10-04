import { formatQuantity } from "@workouts/core/nutrition";
import { router, Stack, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	InputAccessoryView,
	Keyboard,
	Platform,
	Pressable,
	ScrollView,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
	formatShortDate,
	shiftIsoDate,
	todayIsoDate,
} from "../../../data/calendar-day";
import { MEAL_SLOTS } from "../../../data/nutrition-day";
import { servingKey } from "../../../data/nutrition-shortcuts";
import { useI18n } from "../../../i18n";
import { radius, spacing, type, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { DatePickerSheet } from "../../../ui/date-picker-sheet";
import { FoodVisualView } from "../../../ui/food-visual";
import { GlassSurface } from "../../../ui/glass-surface";
import { SelectionMenu } from "../../../ui/selection-menu";
import { AppText } from "../../../ui/text";
import { NutrientTable } from "../components/nutrient-table";
import { DiaryEntryServingPopup } from "./diary-entry-serving-popup";
import {
	type DiaryEntryEditorProps,
	useDiaryEntryEditor,
} from "./use-diary-entry-editor";

export function DiaryEntryEditorScreen(props: DiaryEntryEditorProps) {
	const { t, locale } = useI18n();
	const copy = t.diaryEntry;
	const colors = useTokens();
	const insets = useSafeAreaInsets();
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
	const [dateOpen, setDateOpen] = useState(false);
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
	const energy = entry.nutrients.energy;
	const delta =
		energy?.kind === "value"
			? Math.round((energy.amount * validAmount) / entry.amount) -
				Math.round(energy.amount)
			: undefined;
	const today = todayIsoDate();
	const action = (
		label: string,
		glyph: ComponentProps<typeof SymbolView>["name"],
		onPress: () => void,
		disabled = false,
		danger = false,
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
			}}
		>
			<SymbolView
				name={glyph}
				tintColor={danger ? colors.danger : colors.text}
				size={22}
			/>
		</Pressable>
	);
	const servingGroups = [
		{
			title: entry.name[locale],
			options: [
				{
					id: "historical",
					label: `${draft.historical.label[locale]} · ${t.nutrition.entryEditor.previousValue}`,
					selected: servingKey(draft.selected) === servingKey(draft.historical),
				},
				...draft.choices.flatMap((item, i) =>
					item.kind === "authored" || item.kind === "supplementary"
						? [
								{
									id: String(i),
									label: item.label[locale],
									selected: servingKey(draft.selected) === servingKey(item),
								},
							]
						: [],
				),
			],
		},
		{
			title: copy.personalMeasures,
			options: draft.choices.flatMap((item, i) =>
				item.kind === "personal-measure"
					? [
							{
								id: String(i),
								label: item.label[locale],
								selected: servingKey(draft.selected) === servingKey(item),
							},
						]
					: [],
			),
		},
		{
			options: draft.choices.flatMap((item, i) =>
				item.kind === "base-unit"
					? [
							{
								id: String(i),
								label: item.label[locale],
								selected: servingKey(draft.selected) === servingKey(item),
							},
						]
					: [],
			),
		},
	];
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
							)
						),
				}}
			/>
			<ScrollView
				pointerEvents={adding ? "none" : "auto"}
				accessibilityElementsHidden={adding}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{
					padding: spacing.md,
					gap: spacing.md,
					paddingBottom: spacing.xl,
				}}
			>
				<GlassSurface
					capsule
					style={{
						flexDirection: "row",
						alignItems: "center",
						paddingHorizontal: spacing.sm,
						marginTop: spacing.md,
						minHeight: 108,
					}}
				>
					{action(
						copy.less,
						{ ios: "minus", android: "remove", web: "remove" },
						() =>
							draft.setQuantity(
								String(
									Math.max(
										draft.selected.kind === "base-unit" ? 0.1 : 0.25,
										(draft.valid ? draft.quantity : 0) -
											(draft.selected.kind === "base-unit" ? 10 : 0.25),
									),
								),
							),
						draft.busy || adding,
					)}
					<View
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: spacing.sm,
						}}
					>
						<TextInput
							accessibilityLabel={t.nutrition.foodBrowser.quantity}
							value={draft.quantityText}
							onChangeText={draft.setQuantity}
							keyboardType="decimal-pad"
							selectTextOnFocus
							editable={!draft.busy && !adding}
							inputAccessoryViewID="entry-quantity"
							style={{
								...type.quantity,
								color: colors.text,
								textAlign: "center",
								minWidth: 100,
								maxWidth: "100%",
								fontVariant: ["tabular-nums"],
							}}
						/>
						<AppText variant="secondary">
							{draft.valid ? formatQuantity(draft.amount, locale) : "—"}{" "}
							{entry.baseUnit}
						</AppText>
					</View>
					{action(
						copy.more,
						{ ios: "plus", android: "add", web: "add" },
						() =>
							draft.setQuantity(
								String(
									(draft.valid ? draft.quantity : 0) +
										(draft.selected.kind === "base-unit" ? 10 : 0.25),
								),
							),
						draft.busy || adding,
					)}
				</GlassSurface>
				<GlassSurface
					capsule
					style={{ alignSelf: "center", paddingHorizontal: spacing.sm }}
				>
					<SelectionMenu
						label={draft.selected.label[locale]}
						accessibilityLabel={copy.chooseServing}
						groups={[
							...servingGroups,
							{
								options: [
									{
										id: "new",
										label: copy.newServing,
										disabled: !draft.source && entry.baseUnit === "serving",
									},
								],
							},
						]}
						disabled={draft.busy || !draft.valid}
						onSelect={(id) =>
							id === "new"
								? setAdding(true)
								: draft.select(
										id === "historical"
											? draft.historical
											: draft.choices[Number(id)],
									)
						}
					/>
				</GlassSurface>
				{draft.selected.kind === "personal-measure" && (
					<AppText variant="caption" style={{ textAlign: "center" }}>
						{copy.personalMeasure}
					</AppText>
				)}
				{!draft.valid && (
					<AppText style={{ color: colors.danger }}>
						{copy.invalidQuantity}
					</AppText>
				)}
				<AppText
					variant="caption"
					style={{ textAlign: "center", minHeight: 18 }}
				>
					{draft.amount !== entry.amount
						? `${copy.logged}: ${entry.serving[locale]}${delta === undefined ? "" : ` · ${delta >= 0 ? "+" : "−"}${Math.abs(delta)} kcal`}`
						: " "}
				</AppText>
				<View
					style={{
						backgroundColor: colors.surface,
						borderRadius: radius.sheet,
						borderCurve: "continuous",
						overflow: "hidden",
					}}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={copy.details}
						disabled={!draft.source || adding}
						onPress={() => {
							Keyboard.dismiss();
							router.push({
								pathname: "/labs-food",
								params: {
									source: entry.provenance.source,
									id:
										"sourceId" in entry.provenance
											? entry.provenance.sourceId
											: "",
								},
							});
						}}
						style={{
							padding: spacing.md,
							flexDirection: "row",
							alignItems: "center",
							gap: spacing.sm,
						}}
					>
						<FoodVisualView
							label={entry.name[locale]}
							visual={entry.visual}
							size={44}
						/>
						<View style={{ flex: 1 }}>
							<AppText variant="heading">{entry.name[locale]}</AppText>
							<AppText variant="caption">
								{draft.source ? copy.detailsHint : copy.unavailable}
							</AppText>
						</View>
						{draft.source && <AppText>›</AppText>}
					</Pressable>
					<NutrientTable
						nutrients={entry.nutrients}
						factor={validAmount / entry.amount}
						referenceFactor={
							(entry.baseUnit === "serving" ? 1 : 100) / entry.amount
						}
						referenceLabel={`${entry.baseUnit === "serving" ? 1 : 100} ${entry.baseUnit}`}
					/>
				</View>
			</ScrollView>
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
				<GlassSurface capsule>
					<SelectionMenu
						label={t.nutrition.meals[draft.nextMeal]}
						accessibilityLabel={t.nutrition.entryEditor.meal}
						disabled={draft.busy || adding}
						groups={[
							{
								options: MEAL_SLOTS.map((slot) => ({
									id: slot,
									label: t.nutrition.meals[slot],
									selected: draft.nextMeal === slot,
								})),
							},
						]}
						onSelect={(id) => {
							const slot = MEAL_SLOTS.find((slot) => slot === id);
							if (slot) draft.setMeal(slot);
						}}
					/>
				</GlassSurface>
				<GlassSurface capsule>
					<SelectionMenu
						label={
							draft.nextDate === today
								? copy.today
								: formatShortDate(draft.nextDate, locale)
						}
						accessibilityLabel={t.nutrition.entryEditor.date}
						disabled={draft.busy || adding}
						groups={[
							{
								options: [
									{ id: shiftIsoDate(today, -1), label: copy.yesterday },
									{ id: today, label: copy.today },
									{ id: shiftIsoDate(today, 1), label: copy.tomorrow },
									{ id: "other", label: copy.otherDate },
								],
							},
						]}
						onSelect={(id) =>
							id === "other" ? setDateOpen(true) : draft.setDate(id)
						}
					/>
				</GlassSurface>
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
			</View>
			<DatePickerSheet
				visible={dateOpen}
				date={draft.nextDate}
				today={today}
				locale={locale}
				title={t.nutrition.entryEditor.date}
				todayLabel={copy.today}
				doneLabel={copy.done}
				closeLabel={copy.cancel}
				onSelect={draft.setDate}
				onClose={() => setDateOpen(false)}
			/>
			{adding && (
				<DiaryEntryServingPopup
					food={draft.source}
					name={entry.name[locale]}
					unit={entry.baseUnit}
					additions={draft.additions}
					onBusyChange={setCreating}
					onCancel={() => setAdding(false)}
					onAdded={(option) => {
						draft.select(option, true);
						setAdding(false);
					}}
				/>
			)}
			{Platform.OS === "ios" && !adding && (
				<InputAccessoryView nativeID="entry-quantity">
					<View
						style={{
							backgroundColor: colors.surface,
							flexDirection: "row",
							justifyContent: "space-around",
						}}
					>
						{(draft.selected.kind === "base-unit"
							? [100, 150, 200, 250, 300]
							: [0.5, 1, 1.5, 2, 3]
						).map((value) => (
							<Pressable
								key={value}
								onPress={() => draft.setQuantity(String(value))}
								style={{ padding: spacing.md }}
							>
								<AppText>{formatQuantity(value, locale)}</AppText>
							</Pressable>
						))}
						<Pressable
							onPress={Keyboard.dismiss}
							style={{ padding: spacing.md }}
						>
							<AppText>{copy.done}</AppText>
						</Pressable>
					</View>
				</InputAccessoryView>
			)}
		</View>
	);
}
