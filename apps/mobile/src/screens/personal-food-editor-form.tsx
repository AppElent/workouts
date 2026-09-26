import {
	forkHasLocalEdits,
	forkSource,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ScrollView, StyleSheet, View } from "react-native";
import {
	type FoodPhotoCropPosition,
	type FoodPhotoManager,
	type FoodPhotoSource,
	foodPhotos,
} from "../data/food-photo-manager";
import {
	FOOD_VISUAL_PRESET_IDS,
	type FoodVisual,
	type FoodVisualPresetId,
	type PersonalFood,
	type PersonalFoodDraft,
	validatePersonalFoodDraft,
} from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import { fmt, useI18n } from "../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
import { PrimaryButton } from "../ui/button";
import { FoodVisualView } from "../ui/food-visual";
import { FoodVisualMenu } from "../ui/food-visual-menu";
import {
	AddRow,
	DisclosureRow,
	EditableValueRow,
	FormChoiceChips,
	FormPreview,
	FormScreen,
	FormSection,
	FormTextField,
	GroupedSurface,
	InlineActionRow,
	InlineNumberFieldRow,
	TextAction,
} from "../ui/form";
import { Segmented } from "../ui/segmented";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { FoodAuthoringTabs } from "./food-authoring-tabs";
import { NutritionMenu } from "./nutrition-menu";
import {
	copyWithLabel,
	copyWithServing,
	personalFoodEditorCopy,
} from "./personal-food-editor-copy";

type NutrientInput = { kind: NutrientValue["kind"]; amount: string };
type ServingInput = { key: string; en: string; nl: string; amount: string };

const PRIMARY_NUTRIENTS = ["energy", "protein", "carbs", "fat"] as const;
const MORE_NUTRIENTS = NUTRIENT_KEYS.filter(
	(key) =>
		!PRIMARY_NUTRIENTS.includes(key as (typeof PRIMARY_NUTRIENTS)[number]),
);

type EditorSeed = Pick<
	PersonalFoodDraft,
	| "name"
	| "baseUnit"
	| "nutrients"
	| "servings"
	| "classification"
	| "nutritionBasis"
	| "estimated"
	| "description"
>;

function initialNutrients(
	seed?: EditorSeed,
): Record<NutrientKey, NutrientInput> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = seed?.nutrients[key] ?? { kind: "absent" as const };
			return [
				key,
				{
					kind: value.kind,
					amount:
						value.kind === "value"
							? String(value.amount).replace(".", ",")
							: "",
				},
			];
		}),
	) as Record<NutrientKey, NutrientInput>;
}

function initialServings(seed?: EditorSeed): ServingInput[] {
	return (
		seed?.servings.map((serving, index) => ({
			key: `existing-${index}`,
			en: serving.label.en,
			nl: serving.label.nl,
			amount: String(serving.amount).replace(".", ","),
		})) ?? []
	);
}

function draftUnchanged(a: EditorSeed, b: EditorSeed): boolean {
	return (
		a.name.en === b.name.en &&
		a.name.nl === b.name.nl &&
		a.baseUnit === b.baseUnit &&
		(a.classification ?? "ordinary") === (b.classification ?? "ordinary") &&
		(a.estimated ?? false) === (b.estimated ?? false) &&
		JSON.stringify(a.nutritionBasis ?? { kind: "per100", unit: a.baseUnit }) ===
			JSON.stringify(
				b.nutritionBasis ?? { kind: "per100", unit: b.baseUnit },
			) &&
		JSON.stringify(a.description) === JSON.stringify(b.description) &&
		NUTRIENT_KEYS.every(
			(key) =>
				JSON.stringify(a.nutrients[key]) === JSON.stringify(b.nutrients[key]),
		) &&
		JSON.stringify(a.servings) === JSON.stringify(b.servings)
	);
}

function parseNumber(text: string): number {
	return Number(text.trim().replace(",", "."));
}

export function PersonalFoodEditorForm({
	food,
	seed,
	reviewNotice,
	defaultClassification = "ordinary",
	onSaved,
	onCancel,
	onCreateKindChange,
	photoManager = foodPhotos,
}: {
	food?: PersonalFood;
	defaultClassification?: "ordinary" | "recipe";
	seed?: PersonalFoodDraft;
	reviewNotice?: { title: string; attribution?: string };
	onSaved: (saved: PersonalFood) => void;
	onCancel: () => void;
	onCreateKindChange?: (kind: "personal" | "recipe" | "oneOff") => void;
	photoManager?: FoodPhotoManager;
}) {
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const copy = personalFoodEditorCopy[locale];
	const personalFoods = usePersonalFoods();
	const toast = useToast();
	const initial = food ?? seed;
	type EditorVisual =
		| FoodVisual
		| { readonly kind: "remote"; readonly uri: string };
	const [visual, setVisual] = useState<EditorVisual | undefined>(() =>
		initial?.visual
			? initial.visual
			: initial?.provenance.imageUrl && (!food || food.visualMigrationPending)
				? { kind: "remote", uri: initial.provenance.imageUrl }
				: undefined,
	);
	const [visualError, setVisualError] = useState<string>();
	const [photoPreparationFailed, setPhotoPreparationFailed] = useState(false);
	const [photoBusy, setPhotoBusy] = useState(false);
	const [remoteCrop, setRemoteCrop] = useState<FoodPhotoCropPosition>("center");
	const stagedPhoto = useRef<string | undefined>(undefined);
	const savedPhoto = useRef(false);
	const [primaryName, setPrimaryName] = useState(initial?.name[locale] ?? "");
	const [nameError, setNameError] = useState<string>();
	const scrollRef = useRef<ScrollView>(null);
	const nameOffset = useRef(0);
	const [baseUnit, setBaseUnit] = useState<"g" | "ml">(
		initial?.baseUnit === "ml" ? "ml" : "g",
	);
	const [classification, setClassification] = useState<"ordinary" | "recipe">(
		initial?.classification ?? defaultClassification,
	);
	const [estimated, setEstimated] = useState(initial?.estimated ?? false);
	const [basisKind, setBasisKind] = useState<"per100" | "perServing">(
		initial?.nutritionBasis?.kind ?? "per100",
	);
	const [servingLabel, setServingLabel] = useState(
		initial?.nutritionBasis?.kind === "perServing"
			? initial.nutritionBasis.label[locale]
			: copy.serving,
	);
	const [description, setDescription] = useState(
		initial?.description?.[locale] ?? "",
	);
	const [nutrients, setNutrients] = useState(() => initialNutrients(initial));
	const [moreNutrientsOpen, setMoreNutrientsOpen] = useState(false);
	const [servings, setServings] = useState(() => initialServings(initial));
	const [servingsOpen, setServingsOpen] = useState(() => servings.length > 0);
	const nextServingKey = useRef(servings.length);
	const [addingServing, setAddingServing] = useState(false);
	const [editingServingIndex, setEditingServingIndex] = useState<number>();
	const [newServingName, setNewServingName] = useState("");
	const [newServingAmount, setNewServingAmount] = useState("");
	const [validationError, setValidationError] = useState<string>();
	const [saving, setSaving] = useState(false);
	const saveLock = useRef(false);

	useEffect(
		() => () => {
			if (!savedPhoto.current && stagedPhoto.current) {
				photoManager.remove({ kind: "photo", uri: stagedPhoto.current });
			}
		},
		[photoManager],
	);

	const source = useMemo(
		() => (initial ? forkSource(initial) : undefined),
		[initial],
	);

	function updateNutrient(key: NutrientKey, update: Partial<NutrientInput>) {
		setNutrients((current) => ({
			...current,
			[key]: { ...current[key], ...update },
		}));
	}

	function setAmount(key: NutrientKey, amount: string) {
		updateNutrient(key, {
			kind: amount.trim().length === 0 ? "absent" : "value",
			amount,
		});
	}

	function buildDraft(): PersonalFoodDraft {
		const values = {} as Record<NutrientKey, NutrientValue>;
		for (const key of NUTRIENT_KEYS) {
			const input = nutrients[key];
			values[key] =
				input.kind === "value"
					? { kind: "value", amount: parseNumber(input.amount) }
					: { kind: input.kind };
		}

		const name = { en: primaryName, nl: primaryName };
		const editable: EditorSeed = {
			name,
			baseUnit: basisKind === "perServing" ? "serving" : baseUnit,
			classification,
			estimated,
			nutritionBasis:
				basisKind === "perServing"
					? {
							kind: "perServing",
							label: {
								en:
									locale === "en"
										? servingLabel
										: initial?.nutritionBasis?.kind === "perServing"
											? initial.nutritionBasis.label.en
											: servingLabel,
								nl:
									locale === "nl"
										? servingLabel
										: initial?.nutritionBasis?.kind === "perServing"
											? initial.nutritionBasis.label.nl
											: servingLabel,
							},
						}
					: { kind: "per100", unit: baseUnit },
			...(description.trim()
				? {
						description: {
							en:
								locale === "en"
									? description
									: (initial?.description?.en ?? description),
							nl:
								locale === "nl"
									? description
									: (initial?.description?.nl ?? description),
						},
					}
				: {}),
			nutrients: values,
			servings:
				basisKind === "perServing" &&
				initial?.nutritionBasis?.kind !== "perServing"
					? []
					: servings.map((serving) => {
							const primary = locale === "en" ? serving.en : serving.nl;
							const other = locale === "en" ? serving.nl : serving.en;
							const fallbackOther = other.trim().length > 0 ? other : primary;
							return {
								label:
									locale === "en"
										? { en: primary, nl: fallbackOther }
										: { en: fallbackOther, nl: primary },
								amount: parseNumber(serving.amount),
							};
						}),
		};

		let provenance = initial?.provenance ?? {
			recordOrigin: "personal" as const,
			nutritionSource: "manual" as const,
			locallyEdited: false,
		};
		if (source) {
			provenance = {
				...provenance,
				locallyEdited:
					editable.baseUnit === "serving" ||
					forkHasLocalEdits(
						{ ...editable, baseUnit: editable.baseUnit },
						source,
					),
			};
		} else if (initial && !draftUnchanged(editable, initial)) {
			provenance = { ...provenance, locallyEdited: true };
		}
		const storedVisual = visual?.kind === "remote" ? undefined : visual;
		return {
			...editable,
			provenance,
			...(storedVisual ? { visual: storedVisual } : {}),
		};
	}

	function replaceVisual(next: EditorVisual | undefined) {
		if (
			stagedPhoto.current &&
			(next?.kind !== "photo" || next.uri !== stagedPhoto.current)
		) {
			photoManager.remove({ kind: "photo", uri: stagedPhoto.current });
			stagedPhoto.current = undefined;
		}
		setVisual(next);
		setVisualError(undefined);
		setPhotoPreparationFailed(false);
	}

	async function choosePhoto(source: FoodPhotoSource) {
		if (photoBusy) return;
		setPhotoBusy(true);
		setVisualError(undefined);
		try {
			const choice = await photoManager.choose(source);
			if (choice.kind === "denied") {
				setVisualError(copy.photoPermissionDenied);
				setPhotoPreparationFailed(false);
			} else if (choice.kind === "selected") {
				replaceVisual(choice.visual);
				stagedPhoto.current = choice.visual.uri;
			}
		} catch {
			setVisualError(copy.photoFailure);
			setPhotoPreparationFailed(true);
		} finally {
			setPhotoBusy(false);
		}
	}

	function cancel() {
		if (stagedPhoto.current) {
			photoManager.remove({ kind: "photo", uri: stagedPhoto.current });
			stagedPhoto.current = undefined;
		}
		onCancel();
	}

	async function save() {
		if (saving || saveLock.current) return;
		if (photoPreparationFailed) return;
		setValidationError(undefined);
		setNameError(undefined);
		if (!primaryName.trim() || primaryName.trim().length > 500) {
			setNameError(primaryName.trim() ? copy.nameTooLong : copy.nameRequired);
			scrollRef.current?.scrollTo({
				y: Math.max(0, nameOffset.current - spacing.md),
				animated: true,
			});
			return;
		}
		let draft: PersonalFoodDraft;
		try {
			draft = validatePersonalFoodDraft(buildDraft());
		} catch {
			setValidationError(t.nutrition.personalFood.validation);
			scrollRef.current?.scrollToEnd({ animated: true });
			return;
		}
		saveLock.current = true;
		setSaving(true);
		await Promise.resolve();
		let importedPhoto: FoodVisual | undefined;
		let saved: PersonalFood | undefined;
		try {
			if (visual?.kind === "remote") {
				try {
					importedPhoto = await photoManager.importRemote(
						visual.uri,
						remoteCrop,
					);
					draft = { ...draft, visual: importedPhoto };
				} catch {
					toast.error(copy.importPhotoFailure);
				}
			}
			saved = food
				? personalFoods.update(food.id, draft)
				: personalFoods.create(draft);
			if (
				food?.visual?.kind === "photo" &&
				(saved.visual?.kind !== "photo" || food.visual.uri !== saved.visual.uri)
			) {
				photoManager.remove(food.visual);
			}
			savedPhoto.current = true;
		} catch {
			if (importedPhoto) photoManager.remove(importedPhoto);
			toast.error(t.nutrition.personalFood.saveFailure);
		} finally {
			saveLock.current = false;
			setSaving(false);
		}
		if (saved) onSaved(saved);
	}

	function saveServing() {
		const name = newServingName.trim();
		const amount = parseNumber(newServingAmount);
		if (!name || !Number.isFinite(amount) || amount <= 0) {
			setValidationError(t.nutrition.personalFood.validation);
			return;
		}
		if (editingServingIndex === undefined) {
			nextServingKey.current += 1;
			setServings((current) => [
				...current,
				{
					key: `new-${nextServingKey.current}`,
					en: name,
					nl: name,
					amount: newServingAmount,
				},
			]);
		} else {
			setServings((current) =>
				current.map((serving, index) => {
					if (index !== editingServingIndex) return serving;
					return locale === "en"
						? { ...serving, en: name, amount: newServingAmount }
						: { ...serving, nl: name, amount: newServingAmount };
				}),
			);
		}
		setNewServingName("");
		setNewServingAmount("");
		setAddingServing(false);
		setEditingServingIndex(undefined);
		setServingsOpen(true);
		setValidationError(undefined);
	}

	function beginAddingServing() {
		setEditingServingIndex(undefined);
		setNewServingName("");
		setNewServingAmount("");
		setAddingServing(true);
	}

	function beginEditingServing(index: number) {
		const serving = servings[index];
		setEditingServingIndex(index);
		setNewServingName(locale === "en" ? serving.en : serving.nl);
		setNewServingAmount(serving.amount);
		setAddingServing(true);
	}

	function closeServingEditor() {
		setAddingServing(false);
		setEditingServingIndex(undefined);
		setNewServingName("");
		setNewServingAmount("");
	}

	const visibleNutrients = [
		...PRIMARY_NUTRIENTS,
		...(moreNutrientsOpen ? MORE_NUTRIENTS : []),
	];

	const basisLabel =
		basisKind === "perServing"
			? `${copy.perServing.toLowerCase()} (${servingLabel})`
			: `${copy.per100.toLowerCase()} ${baseUnit}`;
	const servingNumber = (editingServingIndex ?? servings.length) + 1;
	const photoUnavailable =
		visual?.kind === "photo" && !photoManager.isAvailable(visual);
	const visualChoices = [
		{ value: "default" as const, label: copy.defaultVisual },
		...FOOD_VISUAL_PRESET_IDS.map((preset) => ({
			value: preset,
			label: copy.visualPresets[preset],
		})),
	];

	return (
		<FormScreen
			showHeader
			cancelLabel={t.nutrition.personalFood.cancel}
			onCancel={saving || photoBusy ? undefined : cancel}
			scrollRef={scrollRef}
			primaryAction={{
				label: saving
					? t.nutrition.personalFood.saving
					: t.nutrition.personalFood.save,
				loading: saving,
				onPress: save,
			}}
			primaryActionPlacement="header"
		>
			{!food && !seed && !reviewNotice ? (
				<FoodAuthoringTabs
					value={classification === "recipe" ? "recipe" : "personal"}
					onChange={(kind) => {
						if (kind === "oneOff") onCreateKindChange?.(kind);
						else setClassification(kind === "recipe" ? "recipe" : "ordinary");
					}}
				/>
			) : null}
			{source ? (
				<GroupedSurface style={styles.notice}>
					<AppText variant="heading">
						{fmt(t.nutrition.fork.forkedFrom, {
							name: source.sourceName[locale],
						})}
					</AppText>
					<AppText variant="caption">{t.nutrition.fork.intro}</AppText>
				</GroupedSurface>
			) : null}
			{reviewNotice?.attribution ? (
				<GroupedSurface>
					<AppText variant="caption">{reviewNotice.attribution}</AppText>
				</GroupedSurface>
			) : null}

			<FormSection title={copy.visual}>
				<FormPreview>
					{photoUnavailable ? (
						<>
							<FoodVisualView
								label={copy.visual}
								accessibilityLabel={copy.visual}
								size={112}
							/>
							<AppText accessibilityRole="alert" style={styles.error}>
								{copy.photoUnavailable}
							</AppText>
						</>
					) : visual?.kind === "remote" ? (
						<Image
							source={visual.uri}
							accessibilityLabel={copy.visual}
							contentFit="cover"
							contentPosition={remoteCrop}
							style={styles.visualImage}
						/>
					) : (
						<FoodVisualView
							visual={visual}
							label={copy.visual}
							accessibilityLabel={copy.visual}
							size={112}
						/>
					)}
					{visual?.kind === "photo" || visual?.kind === "remote" ? (
						<InlineActionRow>
							<TextAction
								label={copy.replacePhoto}
								onPress={() => void choosePhoto("library")}
								disabled={photoBusy}
							/>
							<TextAction
								label={copy.removePhoto}
								onPress={() => replaceVisual(undefined)}
								disabled={photoBusy}
								tone="destructive"
							/>
						</InlineActionRow>
					) : (
						<InlineActionRow>
							<TextAction
								label={copy.takePhoto}
								onPress={() => void choosePhoto("camera")}
								disabled={photoBusy}
							/>
							<TextAction
								label={copy.choosePhoto}
								onPress={() => void choosePhoto("library")}
								disabled={photoBusy}
							/>
						</InlineActionRow>
					)}
				</FormPreview>
				{visual?.kind === "remote" ? (
					<>
						<AppText variant="caption">{copy.cropPosition}</AppText>
						<FormChoiceChips
							options={(
								["center", "top", "bottom", "left", "right"] as const
							).map((position) => ({
								id: position,
								label: copy.cropPositions[position],
							}))}
							selectedId={remoteCrop}
							onSelect={setRemoteCrop}
						/>
					</>
				) : null}
				{visualError ? (
					<AppText selectable accessibilityRole="alert" style={styles.error}>
						{visualError}
					</AppText>
				) : null}
				<FoodVisualMenu
					label={copy.visual}
					options={visualChoices}
					selectedValue={
						visual?.kind === "icon"
							? visual.preset
							: visual === undefined
								? "default"
								: undefined
					}
					onSelect={(id) =>
						replaceVisual(
							id === "default"
								? undefined
								: { kind: "icon", preset: id as FoodVisualPresetId },
						)
					}
				/>
			</FormSection>

			<View
				onLayout={(event) => {
					nameOffset.current = event.nativeEvent.layout.y;
				}}
			>
				<FormSection>
					<FormTextField
						label={copy.name}
						value={primaryName}
						onChangeText={(value) => {
							setPrimaryName(value);
							setNameError(undefined);
						}}
						error={nameError}
						autoCorrect={false}
					/>
				</FormSection>
			</View>

			<FormSection title={copy.classification}>
				{food || seed || reviewNotice ? (
					<View style={styles.segmentedRow}>
						<Segmented
							value={classification}
							onChange={setClassification}
							options={[
								{ value: "ordinary", label: copy.ordinary },
								{ value: "recipe", label: copy.recipe },
							]}
						/>
					</View>
				) : null}
				<FormTextField
					label={copy.description}
					value={description}
					onChangeText={setDescription}
					multiline
				/>
			</FormSection>
			<FormSection title={copy.precision} footer={copy.estimateHelp}>
				<View style={styles.segmentedRow}>
					<Segmented
						value={estimated ? "estimated" : "provided"}
						onChange={(value) => setEstimated(value === "estimated")}
						options={[
							{ value: "provided", label: copy.provided },
							{ value: "estimated", label: copy.estimated },
						]}
					/>
				</View>
			</FormSection>
			<FormSection title={copy.basis}>
				<View style={styles.segmentedRow}>
					<Segmented
						value={basisKind}
						onChange={setBasisKind}
						options={[
							{ value: "per100", label: copy.per100 },
							{ value: "perServing", label: copy.perServing },
						]}
					/>
				</View>
				{basisKind === "perServing" ? (
					<FormTextField
						label={copy.servingLabel}
						value={servingLabel}
						onChangeText={setServingLabel}
					/>
				) : (
					<View style={styles.segmentedRow}>
						<Segmented
							value={baseUnit}
							onChange={setBaseUnit}
							options={[
								{
									value: "g",
									label: copy.grams,
									accessibilityLabel: `${copy.per100} ${copy.grams}`,
								},
								{
									value: "ml",
									label: copy.millilitres,
									accessibilityLabel: `${copy.per100} ${copy.millilitres}`,
								},
							]}
						/>
					</View>
				)}
			</FormSection>

			<FormSection
				title={`${copy.nutrition} ${basisLabel}`}
				footer={copy.nutrientHelper}
			>
				{visibleNutrients.map((key) => (
					<InlineNumberFieldRow
						key={key}
						label={t.nutrition.nutrients[key]}
						suffix={key === "energy" ? "kcal" : "g"}
						value={nutrients[key].amount}
						onChangeText={(amount) => setAmount(key, amount)}
						accessibilityLabel={`${t.nutrition.nutrients[key]} ${basisLabel}`}
						placeholder={nutrients[key].kind === "trace" ? copy.trace : "—"}
						keyboardType="decimal-pad"
						accessory={
							<NutritionMenu
								label={copyWithLabel(
									copy.valueOptions,
									t.nutrition.nutrients[key],
								)}
								closeLabel={copy.close}
								actions={[
									{
										label: copy.unknown,
										onPress: () =>
											updateNutrient(key, { kind: "absent", amount: "" }),
									},
									{
										label: copy.trace,
										onPress: () =>
											updateNutrient(key, { kind: "trace", amount: "" }),
									},
								]}
							/>
						}
					/>
				))}
				<DisclosureRow
					label={moreNutrientsOpen ? copy.fewerNutrients : copy.moreNutrients}
					expanded={moreNutrientsOpen}
					onPress={() => setMoreNutrientsOpen((open) => !open)}
				/>
			</FormSection>

			{basisKind === "per100" ? (
				<FormSection
					footer={servingsOpen ? copy.customServingsHelp : undefined}
				>
					<DisclosureRow
						label={copy.customServings}
						expanded={servingsOpen}
						onPress={() => setServingsOpen((open) => !open)}
					/>
					{servingsOpen
						? servings.map((serving, index) => (
								<EditableValueRow
									key={serving.key}
									label={locale === "en" ? serving.en : serving.nl}
									value={`${serving.amount} ${baseUnit}`}
									deleteLabel={copy.remove}
									deleteAccessibilityLabel={`${copy.removeServing} ${index + 1}`}
									onPress={() => beginEditingServing(index)}
									onDelete={() =>
										setServings((current) =>
											current.filter((_, itemIndex) => itemIndex !== index),
										)
									}
								/>
							))
						: null}
					{servingsOpen && servings.length < 3 && !addingServing ? (
						<AddRow label={copy.addServing} onPress={beginAddingServing} />
					) : null}
					{servingsOpen && addingServing ? (
						<View style={styles.servingEditor}>
							<FormTextField
								autoFocus
								label={copyWithServing(copy.servingName, servingNumber)}
								value={newServingName}
								onChangeText={setNewServingName}
								autoCorrect={false}
							/>
							<FormTextField
								label={copyWithServing(
									copy.servingAmount,
									servingNumber,
									baseUnit,
								)}
								placeholder={`100 ${baseUnit}`}
								keyboardType="decimal-pad"
								value={newServingAmount}
								onChangeText={setNewServingAmount}
								onSubmitEditing={saveServing}
							/>
							<InlineActionRow>
								<TextAction
									label={t.nutrition.personalFood.cancel}
									tone="neutral"
									onPress={closeServingEditor}
								/>
								<PrimaryButton
									label={
										editingServingIndex === undefined
											? copy.saveServing
											: copy.updateServing
									}
									onPress={saveServing}
								/>
							</InlineActionRow>
						</View>
					) : null}
				</FormSection>
			) : null}

			{validationError ? (
				<AppText selectable accessibilityRole="alert" style={styles.error}>
					{validationError}
				</AppText>
			) : null}
		</FormScreen>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		notice: { gap: spacing.xs },
		visualImage: {
			width: 112,
			height: 112,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		segmentedRow: { padding: spacing.md },
		servingEditor: { gap: spacing.sm, backgroundColor: colors.surface2 },
		error: { color: colors.danger },
	});
