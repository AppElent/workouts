import { type NutrientKey, roundForDisplay } from "@workouts/core/nutrition";
import { Image } from "expo-image";
import { Stack, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import type { NativeStackNavigationOptions } from "expo-router/build/react-navigation/native-stack";
import { SymbolView } from "expo-symbols";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
	Keyboard,
	Pressable,
	ScrollView,
	Switch,
	TextInput,
	View,
} from "react-native";
import type { FoodPhotoManager } from "../../../data/food-photo-manager";
import {
	FOOD_VISUAL_PRESET_IDS,
	type FoodVisualPresetId,
	type PersonalFood,
	type PersonalFoodDraft,
} from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { fmt, useI18n } from "../../../i18n";
import { personalFoodEditorCopy } from "../../../screens/personal-food-editor-copy";
import { radius, spacing, type, useTokens } from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { FoodVisualView } from "../../../ui/food-visual";
import { SwipeableRow } from "../../../ui/swipeable-row";
import { AppText } from "../../../ui/text";
import { AmountServingPopup } from "../components/amount-serving-popup";
import { FoodAuthoringTabs } from "../components/food-authoring-tabs";
import { NutritionChoiceMenu } from "../components/nutrition-choice-menu";
import { PersonalFoodKeyboardBar } from "./components/personal-food-keyboard-bar";
import { PersonalFoodValueField } from "./components/personal-food-value-field";
import {
	type NutrientInput,
	parseFoodNumber,
	usePersonalFoodDraft,
} from "./use-personal-food-draft";

/** Label order: what you read on a package, "of which" rows indented. */
const NUTRIENT_ROWS: readonly { key: NutrientKey; indent?: boolean }[] = [
	{ key: "energy" },
	{ key: "protein" },
	{ key: "carbs" },
	{ key: "sugars", indent: true },
	{ key: "fat" },
	{ key: "saturatedFat", indent: true },
	{ key: "fibre" },
	{ key: "salt" },
];

export type PersonalFoodEditorProps = {
	food?: PersonalFood;
	defaultClassification?: "ordinary" | "recipe";
	seed?: PersonalFoodDraft;
	reviewNotice?: { title: string; attribution?: string };
	onSaved: (saved: PersonalFood) => void;
	onCancel: () => void;
	onCreateKindChange?: (kind: "personal" | "recipe" | "oneOff") => void;
	photoManager?: FoodPhotoManager;
	initialName?: string;
	/**
	 * `route`: the editor owns its navigation header (pushed or a sheet).
	 * `inline`: it replaces a screen's content and draws ✕ and ✓ itself.
	 */
	chrome?: "route" | "inline";
};

export function PersonalFoodEditor({
	food,
	seed,
	reviewNotice,
	defaultClassification = "ordinary",
	onSaved,
	onCancel,
	onCreateKindChange,
	photoManager,
	initialName,
	chrome = "inline",
}: PersonalFoodEditorProps) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.foodEditor;
	const photoCopy = personalFoodEditorCopy[locale];
	const colors = useTokens();
	const confirm = useConfirm();
	const navigation = useNavigation();
	const personalFoods = usePersonalFoods();
	const [leaving, setLeaving] = useState(false);
	const draft = usePersonalFoodDraft({
		food,
		seed,
		defaultClassification,
		initialName,
		photoManager,
		onSaved: (saved) => {
			setLeaving(true);
			onSaved(saved);
		},
	});
	const scroll = useRef<ScrollView>(null);
	/** The latest handlers, for header items that outlive a render. */
	const actions = useRef<{
		save: () => unknown;
		remove: () => unknown;
		close: () => unknown;
	}>({
		save: () => undefined,
		remove: () => undefined,
		close: () => undefined,
	});
	const inputs = useRef(new Map<NutrientKey, TextInput>());
	const [focused, setFocused] = useState<NutrientKey | null>(null);
	const focusSnapshot = useRef<NutrientInput | undefined>(undefined);
	const [servingEditor, setServingEditor] = useState<number | "new" | null>(
		null,
	);
	const [scrolled, setScrolled] = useState(false);

	const confirmDiscard = () =>
		confirm({
			title: copy.discardTitle,
			message: copy.discardBody,
			confirmLabel: copy.discard,
			cancelLabel: copy.keepEditing,
			destructive: true,
		});
	const close = async () => {
		if (draft.dirty && chrome === "inline" && !(await confirmDiscard())) return;
		draft.discardStagedPhoto();
		setLeaving(true);
		onCancel();
	};
	usePreventRemove(
		chrome === "route" && draft.dirty && !leaving,
		({ data }) => {
			if (draft.saving) return;
			void confirmDiscard().then((ok) => {
				if (!ok) return;
				draft.discardStagedPhoto();
				setLeaving(true);
				navigation.dispatch(data.action);
			});
		},
	);
	// A save or delete can only leave once `leaving` has disabled the guard.
	const pendingLeave = useRef<(() => void) | null>(null);
	useEffect(() => {
		if (leaving && pendingLeave.current) {
			const leave = pendingLeave.current;
			pendingLeave.current = null;
			leave();
		}
	});

	const save = async () => {
		Keyboard.dismiss();
		const ok = await draft.save();
		if (!ok) scroll.current?.scrollTo({ y: 0, animated: true });
	};
	const remove = async () => {
		if (!food) return;
		const isCorrection = food.provenance.forkedFrom !== undefined;
		const ok = await confirm({
			title: isCorrection
				? t.nutrition.fork.deleteTitle
				: t.nutrition.personalFood.deleteTitle,
			message: isCorrection
				? t.nutrition.fork.deleteBody
				: t.nutrition.personalFood.deleteBody,
			confirmLabel: isCorrection ? copy.deleteCorrection : copy.delete,
			cancelLabel: copy.cancel,
			destructive: true,
		});
		if (!ok) return;
		if (personalFoods.remove(food.id)) photoManager?.remove(food.visual);
		pendingLeave.current = onCancel;
		setLeaving(true);
	};

	const title = food
		? draft.name
		: reviewNotice
			? copy.review
			: draft.classification === "recipe"
				? copy.newRecipe
				: copy.newFood;
	const kcalPerUnit =
		draft.nutrients.energy.kind === "value"
			? parseFoodNumber(draft.nutrients.energy.amount) / 100
			: undefined;
	const subtitle = (() => {
		const provenance = draft.initial?.provenance;
		if (!provenance || provenance.nutritionSource === "manual")
			return food
				? draft.classification === "recipe"
					? copy.ownRecipe
					: copy.ownFood
				: copy.newSubtitle;
		return [
			provenance.brand ?? copy.sources[provenance.nutritionSource],
			provenance.barcode,
		]
			.filter(Boolean)
			.join(" · ");
	})();
	const nutrientDisplay = (key: NutrientKey) => {
		const input = draft.nutrients[key];
		return input.kind === "trace"
			? copy.trace
			: input.kind === "value"
				? input.amount
				: "—";
	};
	const fieldOrder = NUTRIENT_ROWS.map((row) => row.key);
	const focusIndex = focused ? fieldOrder.indexOf(focused) : -1;
	const focusField = (key: NutrientKey) =>
		requestAnimationFrame(() => inputs.current.get(key)?.focus());

	// A seeded draft (an import to review, a correction to start) is worth
	// saving as it is; an existing food only once something changed.
	const canSave = (draft.dirty || (!food && Boolean(seed))) && !draft.saving;
	const hasFood = Boolean(food);
	const confirmButton = (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={t.nutrition.personalFood.save}
			accessibilityState={{ disabled: !canSave }}
			disabled={!canSave}
			onPress={() => void actions.current.save()}
			style={{
				width: 44,
				height: 44,
				borderRadius: radius.pill,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: canSave ? colors.accentFill : undefined,
				opacity: canSave ? 1 : 0.45,
			}}
		>
			<SymbolView
				name={{ ios: "checkmark", android: "check", web: "check" }}
				size={19}
				weight="semibold"
				tintColor={canSave ? colors.onAccent : colors.text}
			/>
		</Pressable>
	);
	const moreMenu = food ? (
		<NutritionChoiceMenu
			accessibilityLabel={copy.more}
			sections={[
				[
					{
						id: "delete",
						label: food.provenance.forkedFrom
							? copy.deleteCorrection
							: copy.delete,
						destructive: true,
					},
				],
			]}
			onSelect={(id) => {
				if (id === "delete") void actions.current.remove();
			}}
		>
			<View
				style={{
					width: 44,
					height: 44,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<SymbolView
					name={{ ios: "ellipsis", android: "more_horiz", web: "more_horiz" }}
					size={19}
					tintColor={colors.text}
				/>
			</View>
		</NutritionChoiceMenu>
	) : null;
	const closeButton = (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={copy.cancel}
			onPress={() => void actions.current.close()}
			style={{
				width: 44,
				height: 44,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<SymbolView
				name={{ ios: "xmark", android: "close", web: "close" }}
				size={18}
				tintColor={colors.text}
			/>
		</Pressable>
	);

	// Native bar items, so UIKit draws the glass (mobile-design "Functional
	// chrome"). Memoized with handlers in a ref: Stack.Screen sets options on
	// every new object, and this screen re-renders when they are set.
	actions.current = { save, remove, close };
	const deleteLabel = food?.provenance.forkedFrom
		? copy.deleteCorrection
		: copy.delete;
	const headerTitle = food ? (scrolled ? draft.name : "") : title;
	// The fallback views read the latest handlers through `actions`; only what
	// the bar shows invalidates the options.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	const routeOptions = useMemo(
		(): NativeStackNavigationOptions => ({
			title: headerTitle,
			headerTitleStyle: { color: colors.text },
			headerLeft: hasFood ? undefined : () => closeButton,
			unstable_headerRightItems: () => [
				...(hasFood
					? [
							{
								type: "menu" as const,
								label: copy.more,
								accessibilityLabel: copy.more,
								icon: { type: "sfSymbol" as const, name: "ellipsis" as const },
								menu: {
									items: [
										{
											type: "action" as const,
											label: deleteLabel,
											icon: {
												type: "sfSymbol" as const,
												name: "trash" as const,
											},
											destructive: true,
											onPress: () => void actions.current.remove(),
										},
									],
								},
							},
						]
					: []),
				{
					type: "button" as const,
					label: t.nutrition.personalFood.save,
					accessibilityLabel: t.nutrition.personalFood.save,
					icon: { type: "sfSymbol" as const, name: "checkmark" as const },
					variant: canSave ? ("prominent" as const) : ("plain" as const),
					tintColor: canSave ? colors.accentFill : colors.text,
					disabled: !canSave,
					onPress: () => void actions.current.save(),
				},
			],
			headerRight: () => (
				<View style={{ flexDirection: "row", gap: 4 }}>
					{moreMenu}
					{confirmButton}
				</View>
			),
		}),
		[
			canSave,
			colors.accentFill,
			colors.text,
			deleteLabel,
			hasFood,
			headerTitle,
		],
	);

	const notice = (title: string, body: string) => (
		<View
			style={{
				padding: spacing.md,
				gap: 4,
				borderRadius: radius.contentCard,
				backgroundColor: colors.surface,
				borderLeftWidth: 3,
				borderLeftColor: colors.accent,
			}}
		>
			<AppText
				variant="secondary"
				style={{ fontWeight: "700", color: colors.text }}
			>
				{title}
			</AppText>
			<AppText variant="caption">{body}</AppText>
		</View>
	);
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			{chrome === "route" ? (
				<Stack.Screen options={routeOptions} />
			) : (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						paddingHorizontal: spacing.sm,
						paddingTop: spacing.sm,
					}}
				>
					{closeButton}
					<AppText
						variant="navTitle"
						numberOfLines={1}
						style={{ flex: 1, textAlign: "center" }}
					>
						{title}
					</AppText>
					{confirmButton}
				</View>
			)}
			<ScrollView
				ref={scroll}
				style={{ flex: 1 }}
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
				onScroll={(event) =>
					setScrolled(event.nativeEvent.contentOffset.y > 150)
				}
				scrollEventThrottle={32}
				contentContainerStyle={{
					padding: spacing.md,
					paddingBottom: spacing.xxl * 3,
					gap: spacing.xs,
				}}
			>
				{chrome === "inline" &&
				!food &&
				!seed &&
				!reviewNotice &&
				onCreateKindChange ? (
					<FoodAuthoringTabs
						value={draft.classification === "recipe" ? "recipe" : "personal"}
						onChange={(kind) => {
							if (kind === "oneOff") onCreateKindChange(kind);
							else
								draft.setClassification(
									kind === "recipe" ? "recipe" : "ordinary",
								);
						}}
					/>
				) : null}
				<View
					style={{ alignItems: "center", gap: 6, marginBottom: spacing.sm }}
				>
					<NutritionChoiceMenu
						accessibilityLabel={photoCopy.visual}
						sections={[
							[
								{ id: "camera", label: photoCopy.takePhoto },
								{ id: "library", label: photoCopy.choosePhoto },
								...(draft.visual?.kind === "photo" ||
								draft.visual?.kind === "remote"
									? [
											{
												id: "remove",
												label: photoCopy.removePhoto,
												destructive: true,
											},
										]
									: []),
							],
							[
								{
									id: "default",
									label: photoCopy.defaultVisual,
									selected: draft.visual === undefined,
								},
								...FOOD_VISUAL_PRESET_IDS.map((preset) => ({
									id: preset,
									label: photoCopy.visualPresets[preset],
									selected:
										draft.visual?.kind === "icon" &&
										draft.visual.preset === preset,
								})),
							],
							...(draft.visual?.kind === "remote"
								? [
										(["center", "top", "bottom", "left", "right"] as const).map(
											(position) => ({
												id: `crop:${position}`,
												label: photoCopy.cropPositions[position],
												hint: photoCopy.cropPosition,
												selected: draft.remoteCrop === position,
											}),
										),
									]
								: []),
						]}
						onSelect={(id) => {
							if (id.startsWith("crop:"))
								draft.setRemoteCrop(
									id.slice(5) as "center" | "top" | "bottom" | "left" | "right",
								);
							else if (id === "camera" || id === "library")
								void draft.choosePhoto(id);
							else if (id === "remove" || id === "default")
								draft.replaceVisual(undefined);
							else
								draft.replaceVisual({
									kind: "icon",
									preset: id as FoodVisualPresetId,
								});
						}}
					>
						<View style={{ width: 96, height: 96 }}>
							{draft.visual?.kind === "remote" ? (
								<Image
									source={draft.visual.uri}
									contentFit="cover"
									contentPosition={draft.remoteCrop}
									style={{ width: 96, height: 96, borderRadius: radius.lg }}
								/>
							) : (
								<FoodVisualView
									visual={draft.visual}
									label={draft.name || copy.namePlaceholder}
									size={96}
								/>
							)}
							<View
								style={{
									position: "absolute",
									right: -4,
									bottom: -4,
									width: 28,
									height: 28,
									borderRadius: 14,
									backgroundColor: colors.surface,
									alignItems: "center",
									justifyContent: "center",
									boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
								}}
							>
								<SymbolView
									name={{
										ios: "camera",
										android: "photo_camera",
										web: "photo_camera",
									}}
									size={13}
									tintColor={colors.text}
								/>
							</View>
						</View>
					</NutritionChoiceMenu>
					<TextInput
						accessibilityLabel={photoCopy.name}
						value={draft.name}
						onChangeText={draft.setName}
						placeholder={copy.namePlaceholder}
						placeholderTextColor={colors.textFaint}
						autoFocus={!food && !seed}
						autoCorrect={false}
						multiline
						style={{
							...type.title,
							color: colors.text,
							textAlign: "center",
							minWidth: 160,
							paddingHorizontal: spacing.sm,
							borderBottomWidth: food ? 0 : 1.5,
							borderBottomColor: colors.accent,
						}}
					/>
					{draft.nameError ? (
						<AppText
							variant="footnote"
							accessibilityRole="alert"
							style={{ color: colors.danger }}
						>
							{draft.nameError}
						</AppText>
					) : null}
					<AppText variant="caption">{subtitle}</AppText>
					{draft.visualError ? (
						<AppText
							variant="footnote"
							accessibilityRole="alert"
							style={{ color: colors.danger }}
						>
							{draft.visualError}
						</AppText>
					) : null}
				</View>
				{draft.source
					? notice(
							fmt(t.nutrition.fork.forkedFrom, {
								name: draft.source.sourceName[locale],
							}),
							t.nutrition.fork.intro,
						)
					: null}
				{draft.basisKind === "per100" ? (
					<>
						<SectionHeader
							title={copy.servings}
							trailing={
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={copy.addServing}
									onPress={() => setServingEditor("new")}
									style={{
										width: 32,
										height: 32,
										borderRadius: 16,
										backgroundColor: colors.surface2,
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<SymbolView
										name={{ ios: "plus", android: "add", web: "add" }}
										size={14}
										weight="semibold"
										tintColor={colors.accent}
									/>
								</Pressable>
							}
						/>
						{draft.servings.length === 0 ? (
							<AppText
								variant="footnote"
								style={{ paddingHorizontal: spacing.xs }}
							>
								{copy.noServings}
							</AppText>
						) : (
							<Card>
								{draft.servings.map((serving, index) => {
									const label = locale === "en" ? serving.en : serving.nl;
									const amount = parseFoodNumber(serving.amount);
									return (
										<View
											key={serving.key}
											style={
												index
													? {
															borderTopWidth: 0.5,
															borderTopColor: colors.separator,
														}
													: undefined
											}
										>
											<SwipeableRow
												menuTitle={label}
												closeMenuLabel={copy.cancel}
												actions={[
													{
														key: "change",
														label: copy.change,
														swipe: false,
														onPress: () => setServingEditor(index),
													},
													{
														key: "top",
														label: copy.moveTop,
														swipe: false,
														onPress: () => draft.moveServingToTop(index),
													},
													{
														key: "remove",
														label: copy.remove,
														destructive: true,
														onPress: () => draft.removeServing(index),
													},
												]}
											>
												{(accessibility) => (
													<Pressable
														{...accessibility}
														accessibilityRole="button"
														accessibilityLabel={`${label}, ${serving.amount} ${draft.baseUnit}`}
														onPress={() => setServingEditor(index)}
														style={{
															minHeight: 50,
															flexDirection: "row",
															alignItems: "center",
															paddingHorizontal: spacing.md,
															backgroundColor: colors.surface,
														}}
													>
														<AppText
															variant="secondary"
															style={{ flex: 1, color: colors.text }}
														>
															{label}
														</AppText>
														<AppText variant="secondary">
															{kcalPerUnit !== undefined
																? fmt(copy.servingRow, {
																		amount: serving.amount,
																		unit: draft.baseUnit,
																		kcal: roundForDisplay(
																			"energy",
																			kcalPerUnit * amount,
																		),
																	})
																: `${serving.amount} ${draft.baseUnit}`}
														</AppText>
													</Pressable>
												)}
											</SwipeableRow>
										</View>
									);
								})}
							</Card>
						)}
						{draft.servings.length ? (
							<AppText
								variant="caption"
								style={{ paddingHorizontal: spacing.xs }}
							>
								{copy.servingsFooter}
							</AppText>
						) : null}
					</>
				) : null}
				<SectionHeader
					title={copy.nutrition}
					trailing={
						<NutritionChoiceMenu
							accessibilityLabel={copy.basisMenu}
							sections={[
								[
									{
										id: "g",
										label: fmt(copy.per100, { unit: "g" }),
										selected:
											draft.basisKind === "per100" && draft.baseUnit === "g",
									},
									{
										id: "ml",
										label: fmt(copy.per100, { unit: "ml" }),
										selected:
											draft.basisKind === "per100" && draft.baseUnit === "ml",
									},
									{
										id: "serving",
										label: copy.perServing,
										selected: draft.basisKind === "perServing",
									},
								],
							]}
							onSelect={(id) =>
								id === "serving"
									? draft.setBasis("perServing")
									: draft.setBasis("per100", id as "g" | "ml")
							}
						>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: 4,
									minHeight: 32,
								}}
							>
								<AppText
									variant="footnote"
									style={{ color: colors.accent, fontWeight: "700" }}
								>
									{draft.basisKind === "perServing"
										? copy.perServing
										: fmt(copy.per100, { unit: draft.baseUnit })}
								</AppText>
								<SymbolView
									name={{
										ios: "chevron.up.chevron.down",
										android: "unfold_more",
										web: "unfold_more",
									}}
									size={10}
									weight="semibold"
									tintColor={colors.accent}
								/>
							</View>
						</NutritionChoiceMenu>
					}
				/>
				<Card>
					{NUTRIENT_ROWS.map(({ key, indent }, index) => (
						<View
							key={key}
							style={{
								minHeight: 48,
								flexDirection: "row",
								alignItems: "center",
								paddingLeft: indent ? spacing.md + 16 : spacing.md,
								paddingRight: spacing.md,
								borderTopWidth: index ? 0.5 : 0,
								borderTopColor: colors.separator,
							}}
						>
							<AppText
								variant="secondary"
								style={{
									flex: 1,
									color: indent ? colors.textMuted : colors.text,
								}}
							>
								{indent
									? key === "sugars"
										? copy.ofWhichSugars
										: copy.ofWhichSaturated
									: t.nutrition.nutrients[key]}
							</AppText>
							<PersonalFoodValueField
								inputRef={(input) => {
									if (input) inputs.current.set(key, input);
									else inputs.current.delete(key);
								}}
								display={nutrientDisplay(key)}
								unit={
									draft.nutrients[key].kind === "value"
										? key === "energy"
											? "kcal"
											: "g"
										: ""
								}
								accessibilityLabel={t.nutrition.nutrients[key]}
								emphasis={draft.nutrients[key].kind === "value"}
								onFocus={() => {
									focusSnapshot.current = draft.nutrients[key];
									setFocused(key);
								}}
								onBlur={() =>
									setFocused((current) => (current === key ? null : current))
								}
								onChange={(text) =>
									draft.setNutrient(
										key,
										text
											? { kind: "value", amount: text }
											: (focusSnapshot.current ?? draft.nutrients[key]),
									)
								}
							/>
						</View>
					))}
					<View
						style={{
							minHeight: 56,
							flexDirection: "row",
							alignItems: "center",
							paddingHorizontal: spacing.md,
							borderTopWidth: 0.5,
							borderTopColor: colors.separator,
						}}
					>
						<View style={{ flex: 1 }}>
							<AppText variant="secondary" style={{ color: colors.text }}>
								{copy.estimated}
							</AppText>
							<AppText variant="caption">{copy.estimatedHint}</AppText>
						</View>
						<Switch
							accessibilityLabel={copy.estimated}
							value={draft.estimated}
							onValueChange={draft.setEstimated}
							trackColor={{ true: colors.accentFill }}
						/>
					</View>
				</Card>
				<AppText variant="caption" style={{ paddingHorizontal: spacing.xs }}>
					{copy.nutrientFooter}
				</AppText>
				<SectionHeader title={copy.details} />
				<Card>
					<View style={detailRow(colors.separator, false)}>
						<AppText
							variant="secondary"
							style={{ flex: 1, color: colors.text }}
						>
							{copy.category}
						</AppText>
						{/* The SwiftUI menu sizes itself after layout; a fixed box keeps it centred. */}
						<View style={{ height: 44, justifyContent: "center" }}>
							<NutritionChoiceMenu
								accessibilityLabel={copy.category}
								sections={[
									[
										{
											id: "ordinary",
											label: copy.food,
											selected: draft.classification === "ordinary",
										},
										{
											id: "recipe",
											label: copy.recipe,
											selected: draft.classification === "recipe",
										},
									],
								]}
								onSelect={(id) =>
									draft.setClassification(id as "ordinary" | "recipe")
								}
							>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										gap: 4,
										minHeight: 40,
									}}
								>
									<AppText
										variant="secondary"
										style={{ color: colors.accent, fontWeight: "700" }}
									>
										{draft.classification === "recipe"
											? copy.recipe
											: copy.food}
									</AppText>
									<SymbolView
										name={{
											ios: "chevron.up.chevron.down",
											android: "unfold_more",
											web: "unfold_more",
										}}
										size={10}
										weight="semibold"
										tintColor={colors.accent}
									/>
								</View>
							</NutritionChoiceMenu>
						</View>
					</View>
					<View style={detailRow(colors.separator, true)}>
						<AppText variant="secondary" style={{ color: colors.text }}>
							{copy.description}
						</AppText>
						<TextInput
							accessibilityLabel={copy.description}
							value={draft.description}
							onChangeText={draft.setDescription}
							placeholder="—"
							placeholderTextColor={colors.textFaint}
							style={{
								...type.secondary,
								flex: 1,
								textAlign: "right",
								color: colors.textMuted,
							}}
						/>
					</View>
					<View style={detailRow(colors.separator, true)}>
						<AppText
							variant="secondary"
							style={{ flex: 1, color: colors.text }}
						>
							{copy.source}
						</AppText>
						<AppText variant="secondary">
							{
								copy.sources[
									draft.initial?.provenance.nutritionSource ?? "manual"
								]
							}
						</AppText>
					</View>
				</Card>
				{/* An import is checked first and explained last, under its figures. */}
				{reviewNotice
					? notice(
							reviewNotice.title,
							[t.nutrition.foodImport.reviewBody, reviewNotice.attribution]
								.filter(Boolean)
								.join(" "),
						)
					: null}
			</ScrollView>
			<PersonalFoodKeyboardBar
				visible={focused !== null && servingEditor === null}
				traceLabel={copy.trace}
				unknownLabel={copy.unknown}
				previousLabel={copy.previous}
				nextLabel={copy.next}
				doneLabel={copy.done}
				onTrace={() => {
					if (!focused) return;
					draft.setNutrient(focused, { kind: "trace", amount: "" });
					Keyboard.dismiss();
				}}
				onUnknown={() => {
					if (!focused) return;
					draft.setNutrient(focused, { kind: "absent", amount: "" });
					Keyboard.dismiss();
				}}
				onPrevious={
					focusIndex > 0
						? () => focusField(fieldOrder[focusIndex - 1])
						: undefined
				}
				onNext={
					focusIndex >= 0 && focusIndex < fieldOrder.length - 1
						? () => focusField(fieldOrder[focusIndex + 1])
						: undefined
				}
			/>
			{servingEditor !== null ? (
				<AmountServingPopup
					// Servings of the food itself go into the draft until ✓.
					food={food}
					name={draft.name || copy.namePlaceholder}
					unit={draft.baseUnit}
					initial={
						servingEditor === "new"
							? undefined
							: {
									name:
										locale === "en"
											? draft.servings[servingEditor].en
											: draft.servings[servingEditor].nl,
									amount: draft.servings[servingEditor].amount,
								}
					}
					onCancel={() => setServingEditor(null)}
					onAdded={() => setServingEditor(null)}
					onFoodServing={(name, amount) => {
						draft.upsertServing(
							servingEditor === "new" ? undefined : servingEditor,
							name,
							String(amount).replace(".", locale === "nl" ? "," : "."),
						);
						setServingEditor(null);
					}}
				/>
			) : null}
		</View>
	);
}

function detailRow(separator: string, border: boolean) {
	return {
		minHeight: 50,
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		borderTopWidth: border ? 0.5 : 0,
		borderTopColor: separator,
	};
}

function SectionHeader({
	title,
	trailing,
}: {
	title: string;
	trailing?: ReactNode;
}) {
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				marginTop: spacing.md,
				marginBottom: 2,
				paddingHorizontal: spacing.xs,
				minHeight: 32,
			}}
		>
			<AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
				{title}
			</AppText>
			{trailing}
		</View>
	);
}

function Card({ children }: { children: ReactNode }) {
	const colors = useTokens();
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderRadius: radius.contentCard,
				borderCurve: "continuous",
				overflow: "hidden",
			}}
		>
			{children}
		</View>
	);
}
