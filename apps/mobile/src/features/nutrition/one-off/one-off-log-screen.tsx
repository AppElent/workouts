import { Stack, useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	TextInput as TextField,
	type TextInput,
	View,
} from "react-native";
import { todayIsoDate } from "../../../data/calendar-day";
import { useFoodAuthoringIntent } from "../../../data/food-authoring-intent";
import type { MealSlot } from "../../../data/nutrition-day";
import { useI18n } from "../../../i18n";
import { spacing, type, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { DatePickerSheet } from "../../../ui/date-picker-sheet";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { FoodAuthoringTabs } from "../components/food-authoring-tabs";
import { foodEditorCopy } from "../components/food-editor-copy";
import {
	FoodFormCard,
	FoodFormMenuValue,
	FoodFormSectionHeader,
} from "../components/food-form-section";
import { FoodKeyboardBar } from "../components/food-keyboard-bar";
import { FoodNutrientRows } from "../components/food-nutrient-rows";
import { FoodValueField } from "../components/food-value-field";
import { FoodVisualPicker } from "../components/food-visual-picker";
import { NutritionChoiceMenu } from "../components/nutrition-choice-menu";
import { NutritionDestinationMenu } from "../components/nutrition-destination-menu";
import { logFoodCopy } from "../log-food/log-food-copy";
import { useMealDestinationMenu } from "../use-meal-destination-menu";
import { useNutrientFields } from "../use-nutrient-fields";
import { oneOffLogCopy } from "./one-off-log-copy";
import { useOneOffDraft } from "./use-one-off-draft";

/**
 * Logging something once without saving it (a One-off Entry), in the
 * personal food editor's composition (one-off design): photo and name, the
 * amount eaten, then all eight values for that amount or per 100 g/ml. The
 * title says the task; the meal and day under it are the destination menu.
 */
export function OneOffLogScreen({
	date,
	meal,
}: {
	date: string;
	meal: MealSlot;
}) {
	const { t, locale } = useI18n();
	const copy = oneOffLogCopy(locale);
	const browseCopy = logFoodCopy(locale);
	const foodCopy = t.nutrition.foodEditor;
	const photoCopy = foodEditorCopy[locale];
	const colors = useTokens();
	const router = useRouter();
	const navigation = useNavigation();
	const confirm = useConfirm();
	const toast = useToast();
	const authoring = useFoodAuthoringIntent();
	// Name and photo carried over from the Personal food or Recipe form.
	const [seed] = useState(() =>
		authoring.intent === "oneOff" ? authoring.seed : undefined,
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival
	useEffect(() => {
		if (authoring.intent === "oneOff") authoring.consume();
	}, []);
	// Leaving on purpose (logged, or switched kind) lifts the discard guard
	// first; the navigation runs once that render is in.
	const [exit, setExit] = useState<(() => void) | null>(null);
	useEffect(() => {
		exit?.();
	}, [exit]);
	const draft = useOneOffDraft({
		date,
		meal,
		seed,
		onLogged: (loggedDate) =>
			setExit(
				() => () =>
					router.dismissTo({
						pathname: "/nutrition",
						params: { date: loggedDate },
					}),
			),
		onFailed: () => toast.error(copy.logFailure),
	});
	const [today] = useState(todayIsoDate);
	const [choosingDay, setChoosingDay] = useState(false);
	const destination = useMealDestinationMenu({
		date: draft.destination.date,
		meal: draft.destination.meal,
		today,
		onSelectMeal: draft.setMeal,
		onOtherDay: () => setChoosingDay(true),
	});
	const fields = useNutrientFields({
		values: draft.values,
		onChange: draft.setValue,
	});
	const amountInput = useRef<TextInput | null>(null);
	const [amountFocused, setAmountFocused] = useState(false);

	usePreventRemove(draft.dirty && !exit, ({ data }) => {
		void confirm({
			title: copy.discardTitle,
			message: copy.discardBody(draft.name.trim()),
			confirmLabel: copy.discard,
			cancelLabel: copy.keepEditing,
			destructive: true,
		}).then((ok) => {
			if (!ok) return;
			draft.photo.discard();
			// Lift the guard first; re-dispatching under it would be blocked again.
			setExit(() => () => navigation.dispatch(data.action));
		});
	});

	// Latest handlers for header items that outlive a render; options only
	// change with what they show (Stack.Screen sets them on every new object).
	// Opened with nothing beneath it (a deep link), ✕ lands on the diary.
	const close = () =>
		router.canGoBack()
			? router.back()
			: router.replace({
					pathname: "/nutrition",
					params: { date: draft.destination.date },
				});
	const handlers = useRef({ log: draft.log, close });
	handlers.current = { log: draft.log, close };
	const menu = destination.menu;
	const menuRef = useRef(menu);
	menuRef.current = menu;
	// biome-ignore lint/correctness/useExhaustiveDependencies: handlers and the menu come from refs
	const options = useMemo(
		(): NativeStackNavigationOptions => ({
			title: copy.title,
			headerShown: true,
			headerTitle: () => (
				<NutritionDestinationMenu {...menuRef.current} title={copy.title} />
			),
			headerLeft: () => (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={copy.cancel}
					onPress={() => handlers.current.close()}
					style={{
						minWidth: 44,
						minHeight: 44,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<SymbolView
						name={{ ios: "xmark", android: "close", web: "close" }}
						size={18}
						weight="semibold"
						tintColor={colors.text}
					/>
				</Pressable>
			),
			unstable_headerRightItems: () =>
				draft.logging
					? [
							{
								type: "custom",
								element: (
									<ActivityIndicator accessibilityLabel={copy.logging} />
								),
							},
						]
					: [
							{
								type: "button",
								label: copy.log,
								accessibilityLabel: copy.log,
								icon: { type: "sfSymbol", name: "checkmark" },
								variant: draft.canLog ? "prominent" : "plain",
								tintColor: draft.canLog ? colors.accentFill : colors.text,
								disabled: !draft.canLog,
								onPress: () => handlers.current.log(),
							},
						],
		}),
		// The title menu re-renders from `menuRef`; these change what shows.
		[
			copy,
			colors.accentFill,
			colors.text,
			draft.canLog,
			draft.logging,
			menu.label,
			menu.dayLabel,
			menu.mealName,
		],
	);

	const unitLabel = copy.units[draft.unit];
	const amountText = draft.amount.trim();
	const basisLabel =
		draft.basis === "per100"
			? copy.per100(draft.unit === "ml" ? "ml" : "g")
			: draft.errors.amount || !amountText
				? copy.forWholeAmount
				: copy.forAmount(amountText, unitLabel);

	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<Stack.Screen options={options} />
			<DatePickerSheet
				visible={choosingDay}
				date={draft.destination.date}
				today={today}
				locale={locale}
				title={browseCopy.chooseDate}
				todayLabel={browseCopy.today}
				doneLabel={browseCopy.doneChoosingDate}
				closeLabel={browseCopy.closeMenu}
				onSelect={(next) => {
					draft.setDate(next);
					setChoosingDay(false);
				}}
				onClose={() => setChoosingDay(false)}
			/>
			<ScrollView
				style={{ flex: 1 }}
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				contentContainerStyle={{
					padding: spacing.md,
					paddingBottom: spacing.xxl * 3,
					gap: spacing.xs,
				}}
			>
				<FoodAuthoringTabs
					value="oneOff"
					onChange={(kind) => {
						if (kind === "oneOff") return;
						// The other form takes the name and photo along.
						authoring.request(kind, draft.handOff());
						setExit(() => () => router.back());
					}}
				/>
				<View
					style={{
						alignItems: "center",
						gap: 6,
						marginTop: spacing.sm,
						marginBottom: spacing.sm,
					}}
				>
					<FoodVisualPicker
						visual={draft.photo.visual}
						name={draft.name || copy.namePlaceholder}
						onPhoto={(source) => void draft.photo.choose(source)}
						onVisual={draft.photo.replace}
					/>
					{draft.photo.error ? (
						<AppText variant="caption" style={{ color: colors.danger }}>
							{draft.photo.error}
						</AppText>
					) : null}
					<TextField
						accessibilityLabel={photoCopy.name}
						value={draft.name}
						onChangeText={draft.setName}
						placeholder={copy.namePlaceholder}
						placeholderTextColor={colors.textFaint}
						autoFocus={!seed}
						returnKeyType="next"
						submitBehavior="submit"
						onSubmitEditing={() => amountInput.current?.focus()}
						style={{
							...type.title,
							color: colors.text,
							textAlign: "center",
							alignSelf: "stretch",
							minHeight: 44,
						}}
					/>
					<AppText
						variant="caption"
						style={draft.errors.name ? { color: colors.danger } : undefined}
					>
						{draft.errors.name ?? copy.subtitle}
					</AppText>
				</View>

				<FoodFormSectionHeader title={copy.amount} />
				<FoodFormCard>
					<View
						style={{
							minHeight: 52,
							flexDirection: "row",
							alignItems: "center",
							gap: spacing.sm,
							paddingHorizontal: spacing.md,
						}}
					>
						<AppText
							variant="secondary"
							style={{ flex: 1, color: colors.text }}
						>
							{copy.iAte}
						</AppText>
						<FoodValueField
							inputRef={(input) => {
								amountInput.current = input;
							}}
							display={draft.amount}
							accessibilityLabel={copy.amount}
							onFocus={() => setAmountFocused(true)}
							onBlur={() => setAmountFocused(false)}
							onChange={(text) => {
								if (text) draft.setAmount(text);
							}}
						/>
						<NutritionChoiceMenu
							accessibilityLabel={copy.unitMenu}
							sections={[
								(["serving", "g", "ml"] as const).map((unit) => ({
									id: unit,
									label: copy.units[unit],
									selected: draft.unit === unit,
								})),
							]}
							onSelect={(id) => draft.setUnit(id as "serving" | "g" | "ml")}
						>
							<FoodFormMenuValue label={unitLabel} />
						</NutritionChoiceMenu>
					</View>
				</FoodFormCard>
				{draft.errors.amount ? (
					<AppText
						variant="caption"
						style={{ color: colors.danger, paddingHorizontal: spacing.xs }}
					>
						{draft.errors.amount}
					</AppText>
				) : null}

				<FoodFormSectionHeader
					title={copy.nutrition}
					trailing={
						<NutritionChoiceMenu
							accessibilityLabel={copy.basisMenu}
							title={copy.basisMenu}
							sections={[
								[
									{
										id: "total",
										label: copy.wholeAmount,
										selected: draft.basis === "total",
									},
									{
										id: "g",
										label: copy.per100("g"),
										selected: draft.basis === "per100" && draft.unit === "g",
									},
									{
										id: "ml",
										label: copy.per100("ml"),
										selected: draft.basis === "per100" && draft.unit === "ml",
									},
								],
							]}
							onSelect={(id) =>
								id === "total"
									? draft.setBasis("total")
									: draft.setBasis("per100", id as "g" | "ml")
							}
						>
							<FoodFormMenuValue label={basisLabel} />
						</NutritionChoiceMenu>
					}
				/>
				<FoodFormCard>
					<FoodNutrientRows values={draft.values} fields={fields} />
				</FoodFormCard>
				{draft.totals ? (
					<AppText variant="footnote" style={{ paddingHorizontal: spacing.xs }}>
						{draft.totals}
					</AppText>
				) : null}
				{draft.errors.values ? (
					<AppText
						variant="caption"
						style={{ color: colors.danger, paddingHorizontal: spacing.xs }}
					>
						{draft.errors.values}
					</AppText>
				) : null}
				<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
					{copy.footer}
				</AppText>
			</ScrollView>
			{amountFocused ? (
				// The amount cannot be a trace or unknown: only ‹ › and Done.
				<FoodKeyboardBar
					visible
					traceLabel={foodCopy.trace}
					unknownLabel={foodCopy.unknown}
					previousLabel={foodCopy.previous}
					nextLabel={foodCopy.next}
					doneLabel={foodCopy.done}
					onNext={() => fields.focus("energy")}
				/>
			) : (
				<FoodKeyboardBar
					{...fields.bar}
					traceLabel={foodCopy.trace}
					unknownLabel={foodCopy.unknown}
					previousLabel={foodCopy.previous}
					nextLabel={foodCopy.next}
					doneLabel={foodCopy.done}
					onPrevious={
						fields.bar.onPrevious ??
						(fields.focused === "energy"
							? () => amountInput.current?.focus()
							: undefined)
					}
				/>
			)}
		</View>
	);
}
