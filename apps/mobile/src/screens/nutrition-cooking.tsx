import type { NutritionProvenance } from "@workouts/core";
import {
	allShippedFoods,
	formatCookingAmount,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	rescaleNutrients,
} from "@workouts/core/nutrition";
import { useEffect, useRef, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { nutritionCookingCopy } from "../data/nutrition-cooking-copy";
import {
	oneOffLogSnapshot,
	positiveCookingNumber,
	recipeLogBatch,
	recipePreview,
} from "../data/nutrition-cooking-helpers";
import {
	type CookingIngredientSnapshot,
	type CookingRecipe,
	type CookingRecipeDraft,
	type CookingYield,
	type NutritionCookingRepository,
	openNutritionCookingRepository,
} from "../data/nutrition-cooking-repository";
import type { MealSlot } from "../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
} from "../data/nutrition-operation-service";
import { usePersonalFoods } from "../data/personal-foods";
import { useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

type ScreenProps = {
	readonly date: string;
	readonly meal: MealSlot;
	readonly repository?: NutritionCookingRepository;
	/** Route intent from the food browser; the hub remains the default. */
	readonly initialMode?: Exclude<Mode, "hub">;
	readonly initialRecipeId?: string;
};

type Mode = "hub" | "recipe-new" | "recipe-log" | "oneoff-log";

type FoodChoice = {
	readonly sourceKey: string;
	readonly name: { readonly en: string; readonly nl: string };
	readonly baseUnit: "g" | "ml";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly provenance: NutritionProvenance;
};

const EMPTY_NUTRIENT_INPUTS = Object.fromEntries(
	NUTRIENT_KEYS.map((key) => [key, ""]),
) as Record<NutrientKey, string>;

function mealLabel(meal: MealSlot, locale: "en" | "nl") {
	const names = {
		breakfast: { en: "Breakfast", nl: "Ontbijt" },
		lunch: { en: "Lunch", nl: "Lunch" },
		dinner: { en: "Dinner", nl: "Diner" },
		snacks: { en: "Snacks", nl: "Tussendoortjes" },
	};
	return names[meal][locale];
}

function nameForLocale(name: { en: string; nl: string }, locale: "en" | "nl") {
	return name[locale] || name.en || name.nl;
}

function foodMatches(name: { en: string; nl: string }, query: string): boolean {
	if (!query.trim()) return true;
	const needle = query.trim().toLocaleLowerCase();
	return `${name.en} ${name.nl}`.toLocaleLowerCase().includes(needle);
}

function parseOptionalNutrient(value: string, label: string): number {
	const parsed = Number(value.replace(",", ".").trim());
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error(`${label} must be zero or greater.`);
	}
	return parsed;
}

function choiceFromPersonalFood(
	food: ReturnType<ReturnType<typeof usePersonalFoods>["list"]>[number],
): FoodChoice {
	return {
		sourceKey: `personal:${food.id}`,
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients: food.nutrients,
		provenance: {
			source: food.provenance.recordOrigin,
			sourceId: food.id,
			nutritionSource: food.provenance.nutritionSource,
			locallyEdited: food.provenance.locallyEdited,
			...(food.provenance.forkedFrom
				? { forkedFrom: food.provenance.forkedFrom }
				: {}),
			...(food.provenance.provider
				? { provider: food.provenance.provider }
				: {}),
			...(food.provenance.barcode ? { barcode: food.provenance.barcode } : {}),
			...(food.provenance.attribution
				? { attribution: food.provenance.attribution }
				: {}),
		},
	};
}

export function NutritionCookingScreen({
	date,
	meal,
	repository: suppliedRepository,
	initialMode,
	initialRecipeId,
}: ScreenProps) {
	const { locale, t } = useI18n();
	const copy = nutritionCookingCopy(locale);
	const operations = useNutritionOperations();
	const foods = usePersonalFoods();
	const toast = useToast();
	const ownsRepository = suppliedRepository === undefined;
	const [repository] = useState(
		() =>
			suppliedRepository ?? openNutritionCookingRepository(mintNutritionUuid),
	);
	const [, setRevision] = useState(0);
	const [mode, setMode] = useState<Mode>(() => initialMode ?? "hub");
	const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>(
		initialRecipeId,
	);
	const bump = () => setRevision((value) => value + 1);

	useEffect(() => {
		if (!ownsRepository) return;
		return () => repository.close();
	}, [ownsRepository, repository]);

	const subject = operations.getSubject();
	const recipes = repository.listRecipes(subject ?? "");

	if (!subject) {
		return <EmptyState body={copy.storageBody} />;
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
		>
			{mode === "hub" ? (
				<Hub
					copy={copy}
					locale={locale}
					recipes={recipes}
					onNewRecipe={() => setMode("recipe-new")}
					onLogOnce={() => setMode("oneoff-log")}
					onLogRecipe={(id) => {
						setSelectedRecipeId(id);
						setMode("recipe-log");
					}}
				/>
			) : mode === "recipe-new" ? (
				<RecipeEditor
					copy={copy}
					locale={locale}
					foods={foods}
					onCancel={() => setMode("hub")}
					onSaved={() => {
						bump();
						setMode("hub");
					}}
					repository={repository}
					subject={subject}
					toast={toast}
				/>
			) : mode === "recipe-log" ? (
				<RecipeLogger
					copy={copy}
					locale={locale}
					recipe={recipes.find((recipe) => recipe.id === selectedRecipeId)}
					date={date}
					meal={meal}
					labels={t.nutrition.nutrients}
					onCancel={() => setMode("hub")}
					onAccepted={() => setMode("hub")}
					operations={operations}
					toast={toast}
				/>
			) : (
				<OneOffLogger
					copy={copy}
					locale={locale}
					date={date}
					meal={meal}
					operations={operations}
					labels={t.nutrition.nutrients}
					toast={toast}
					onAccepted={() => setMode("hub")}
					onCancel={() => setMode("hub")}
				/>
			)}
		</ScrollView>
	);
}

function Hub({
	copy,
	locale,
	recipes,
	onNewRecipe,
	onLogOnce,
	onLogRecipe,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	recipes: readonly CookingRecipe[];
	onNewRecipe: () => void;
	onLogOnce: () => void;
	onLogRecipe: (id: string) => void;
}) {
	return (
		<>
			<Eyebrow>{copy.title}</Eyebrow>
			<AppText variant="title">{copy.title}</AppText>
			<Card style={styles.storageDisclosure}>
				<AppText variant="heading">{copy.storageTitle}</AppText>
				<AppText variant="caption">{copy.storageBody}</AppText>
			</Card>
			<View style={styles.actions}>
				<PrimaryButton label={copy.newRecipe} onPress={onNewRecipe} />
				<GhostButton label={copy.logOnce} onPress={onLogOnce} />
			</View>
			<AppText variant="heading">{copy.recipes}</AppText>
			{recipes.length === 0 ? (
				<EmptyState body={copy.noRecipes} />
			) : (
				<Card>
					{recipes.map((recipe) => (
						<View key={recipe.id} style={styles.row}>
							<View style={styles.flex}>
								<AppText variant="body" style={styles.strong}>
									{nameForLocale(recipe.name, locale)}
								</AppText>
								<AppText variant="caption">
									{nameForLocale(recipe.versionName, locale)} ·{" "}
									{recipe.ingredients.length}{" "}
									{locale === "nl" ? "ingrediënten" : "ingredients"}
								</AppText>
							</View>
							<GhostButton
								label={copy.logRecipe}
								onPress={() => onLogRecipe(recipe.id)}
							/>
						</View>
					))}
				</Card>
			)}
		</>
	);
}

function RecipeEditor({
	copy,
	locale,
	foods,
	onCancel,
	onSaved,
	repository,
	subject,
	toast,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	foods: ReturnType<typeof usePersonalFoods>;
	onCancel: () => void;
	onSaved: () => void;
	repository: NutritionCookingRepository;
	subject: string;
	toast: {
		error: (message: string) => void;
		success: (message: string) => void;
	};
}) {
	const [nameEn, setNameEn] = useState("");
	const [nameNl, setNameNl] = useState("");
	const [versionEn, setVersionEn] = useState("v1");
	const [versionNl, setVersionNl] = useState("v1");
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<FoodChoice>();
	const [amount, setAmount] = useState("");
	const [ingredients, setIngredients] = useState<CookingIngredientSnapshot[]>(
		[],
	);
	const [yieldKind, setYieldKind] = useState<CookingYield["kind"]>("grams");
	const [yieldAmount, setYieldAmount] = useState("");
	const [saving, setSaving] = useState(false);
	const savingRef = useRef(false);
	const personalChoices = foods.list().map(choiceFromPersonalFood);
	const shippedChoices: FoodChoice[] = allShippedFoods()
		.filter((food) => !food.retired && foodMatches(food.name, search))
		.slice(0, 8)
		.map((food) => ({
			sourceKey: food.id,
			name: food.name,
			baseUnit: food.baseUnit,
			nutrients: Object.fromEntries(
				NUTRIENT_KEYS.map((key) => [key, food.nutrients[key]]),
			) as Record<NutrientKey, NutrientValue>,
			provenance: {
				source: "shipped",
				sourceId: food.id,
				dataset: "NEVO",
				edition: "2025/9.0",
				sourceCode: food.code,
				sourceName: food.sourceName,
				saltDerived: true,
			},
		}));
	const choices = [
		...personalChoices.filter((choice) => foodMatches(choice.name, search)),
		...shippedChoices,
	].slice(0, 12);

	function addIngredient() {
		if (!selected) return;
		try {
			const numericAmount = positiveCookingNumber(amount, copy.amount);
			const nutrients = rescaleNutrients(
				selected.nutrients,
				numericAmount / 100,
			);
			setIngredients((current) => [
				...current,
				{
					ingredientId: mintNutritionUuid(),
					sourceKey: selected.sourceKey,
					name: selected.name,
					serving: formatCookingAmount(numericAmount, selected.baseUnit),
					quantity: numericAmount / 100,
					amount: numericAmount,
					baseUnit: selected.baseUnit,
					nutrients,
					provenance: selected.provenance,
				},
			]);
			setAmount("");
			setSelected(undefined);
		} catch {
			toast.error(copy.missingRecipeFields);
		}
	}

	function save() {
		if (savingRef.current) return;
		try {
			const draft: CookingRecipeDraft = {
				name: { en: nameEn.trim(), nl: nameNl.trim() },
				versionName: { en: versionEn.trim(), nl: versionNl.trim() },
				ingredients,
				yield: {
					kind: yieldKind,
					amount: positiveCookingNumber(yieldAmount, copy.yield),
				},
			};
			savingRef.current = true;
			setSaving(true);
			repository.createRecipe(subject, draft);
			toast.success(copy.recipeSaved);
			onSaved();
		} catch {
			toast.error(copy.recipeSaveFailure);
			setSaving(false);
			savingRef.current = false;
		}
	}

	return (
		<>
			<AppText variant="title">{copy.newRecipe}</AppText>
			<Field
				label={copy.recipeNameEn}
				value={nameEn}
				onChangeText={setNameEn}
			/>
			<Field
				label={copy.recipeNameNl}
				value={nameNl}
				onChangeText={setNameNl}
			/>
			<Field
				label={copy.versionNameEn}
				value={versionEn}
				onChangeText={setVersionEn}
			/>
			<Field
				label={copy.versionNameNl}
				value={versionNl}
				onChangeText={setVersionNl}
			/>
			<AppText variant="heading">{copy.chooseIngredient}</AppText>
			<Field
				label={copy.ingredientSearch}
				value={search}
				onChangeText={setSearch}
			/>
			{choices.map((choice) => (
				<Pressable
					key={choice.sourceKey}
					onPress={() => setSelected(choice)}
					accessibilityRole="button"
					style={[
						styles.choice,
						selected?.sourceKey === choice.sourceKey && styles.choiceSelected,
					]}
				>
					<AppText>{nameForLocale(choice.name, locale)}</AppText>
					<AppText variant="caption">{choice.baseUnit}</AppText>
				</Pressable>
			))}
			{selected ? (
				<Card style={styles.addIngredient}>
					<AppText variant="body">
						{nameForLocale(selected.name, locale)}
					</AppText>
					<Field
						label={copy.amount}
						value={amount}
						onChangeText={setAmount}
						keyboardType="decimal-pad"
					/>
					<PrimaryButton label={copy.addIngredient} onPress={addIngredient} />
				</Card>
			) : null}
			{ingredients.length ? (
				<Card>
					{ingredients.map((ingredient, index) => (
						<View key={ingredient.ingredientId} style={styles.row}>
							<AppText style={styles.flex}>
								{nameForLocale(ingredient.name, locale)}
							</AppText>
							<AppText variant="caption">
								{ingredient.amount} {ingredient.baseUnit}
							</AppText>
							<GhostButton
								label={copy.removeIngredient}
								onPress={() =>
									setIngredients((current) =>
										current.filter((_, item) => item !== index),
									)
								}
							/>
						</View>
					))}
				</Card>
			) : null}
			<AppText variant="heading">{copy.yield}</AppText>
			<View style={styles.inlineActions}>
				<GhostButton
					label={copy.yieldGrams}
					onPress={() => setYieldKind("grams")}
					style={yieldKind === "grams" ? styles.selectedButton : undefined}
				/>
				<GhostButton
					label={copy.yieldPortions}
					onPress={() => setYieldKind("portions")}
					style={yieldKind === "portions" ? styles.selectedButton : undefined}
				/>
			</View>
			<Field
				label={yieldKind === "grams" ? copy.yieldGrams : copy.yieldPortions}
				value={yieldAmount}
				onChangeText={setYieldAmount}
				keyboardType="decimal-pad"
			/>
			<View style={styles.actions}>
				<PrimaryButton
					label={saving ? copy.savingRecipe : copy.saveRecipe}
					onPress={save}
					loading={saving}
				/>
				<GhostButton label={copy.cancel} onPress={onCancel} disabled={saving} />
			</View>
		</>
	);
}

function RecipeLogger({
	copy,
	locale,
	recipe,
	date,
	meal,
	labels,
	onCancel,
	onAccepted,
	operations,
	toast,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	recipe: CookingRecipe | undefined;
	date: string;
	meal: MealSlot;
	labels: Readonly<Record<NutrientKey, string>>;
	onCancel: () => void;
	onAccepted: () => void;
	operations: ReturnType<typeof useNutritionOperations>;
	toast: { error: (message: string) => void };
}) {
	const [amount, setAmount] = useState(
		() => recipe?.yield.amount.toString() ?? "",
	);
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);
	if (!recipe) return <EmptyState body={copy.noRecipes} />;
	const activeRecipe = recipe;
	const numericAmount = Number(amount.replace(",", "."));
	const request =
		activeRecipe.yield.kind === "grams"
			? { kind: "grams" as const, amount: numericAmount }
			: { kind: "portions" as const, amount: numericAmount };
	const preview =
		Number.isFinite(request.amount) && request.amount > 0
			? recipePreview(activeRecipe, request)
			: undefined;
	function log() {
		if (!preview || loggingRef.current) return;
		const subject = operations.getSubject();
		if (!subject) return;
		loggingRef.current = true;
		setLogging(true);
		try {
			const entries = recipeLogBatch(
				activeRecipe,
				request,
				date,
				meal,
				mintNutritionUuid(),
				mintNutritionUuid,
			);
			operations.createBatch(subject, date, meal, entries, () =>
				toast.error(copy.logFailure),
			);
			onAccepted();
		} catch {
			toast.error(copy.logFailure);
			setLogging(false);
			loggingRef.current = false;
		}
	}
	return (
		<>
			<AppText variant="title">{copy.logRecipe}</AppText>
			<AppText variant="heading">{nameForLocale(recipe.name, locale)}</AppText>
			<AppText variant="caption">
				{nameForLocale(recipe.versionName, locale)} · {mealLabel(meal, locale)}
			</AppText>
			<Card>
				{recipe.ingredients.map((ingredient) => (
					<View key={ingredient.ingredientId} style={styles.row}>
						<AppText style={styles.flex}>
							{nameForLocale(ingredient.name, locale)}
						</AppText>
						<AppText variant="caption">
							{ingredient.amount} {ingredient.baseUnit}
						</AppText>
					</View>
				))}
			</Card>
			<Field
				label={
					recipe.yield.kind === "grams"
						? copy.requestGrams
						: copy.requestPortions
				}
				value={amount}
				onChangeText={setAmount}
				keyboardType="decimal-pad"
			/>
			{preview ? <NutritionPreview labels={labels} preview={preview} /> : null}
			<PrimaryButton
				label={logging ? copy.logging : copy.logOnce}
				onPress={log}
				disabled={!preview}
				loading={logging}
			/>
			<GhostButton label={copy.cancel} onPress={onCancel} disabled={logging} />
		</>
	);
}

function OneOffLogger({
	copy,
	locale,
	date,
	meal,
	operations,
	labels,
	toast,
	onAccepted,
	onCancel,
}: {
	copy: ReturnType<typeof nutritionCookingCopy>;
	locale: "en" | "nl";
	date: string;
	meal: MealSlot;
	operations: ReturnType<typeof useNutritionOperations>;
	labels: Readonly<Record<NutrientKey, string>>;
	toast: { error: (message: string) => void };
	onAccepted: () => void;
	onCancel: () => void;
}) {
	const [nameEn, setNameEn] = useState("");
	const [nameNl, setNameNl] = useState("");
	const [amount, setAmount] = useState("");
	const [baseUnit, setBaseUnit] = useState<"g" | "ml">("g");
	const [nutrientInputs, setNutrientInputs] = useState(EMPTY_NUTRIENT_INPUTS);
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);
	function log() {
		if (loggingRef.current) return;
		const subject = operations.getSubject();
		if (!subject) return;
		try {
			const numericAmount = positiveCookingNumber(amount, copy.amount);
			const nutrients: Partial<Record<NutrientKey, NutrientValue>> = {};
			for (const key of NUTRIENT_KEYS) {
				if (!nutrientInputs[key].trim()) continue;
				const value = parseOptionalNutrient(nutrientInputs[key], key);
				nutrients[key] = { kind: "value", amount: value };
			}
			loggingRef.current = true;
			setLogging(true);
			const snapshot = oneOffLogSnapshot({
				date,
				meal,
				name: { en: nameEn.trim(), nl: nameNl.trim() },
				amount: numericAmount,
				baseUnit,
				nutrients,
				clientEntryId: mintNutritionUuid(),
			});
			operations.create(subject, snapshot, undefined, () =>
				toast.error(copy.conversionFailure),
			);
			onAccepted();
		} catch {
			toast.error(copy.conversionFailure);
			setLogging(false);
			loggingRef.current = false;
		}
	}
	return (
		<>
			<AppText variant="title">{copy.logOnce}</AppText>
			<AppText variant="caption">
				{date} · {mealLabel(meal, locale)}
			</AppText>
			<Field
				label={copy.oneOffFoodNameEn}
				value={nameEn}
				onChangeText={setNameEn}
			/>
			<Field
				label={copy.oneOffFoodNameNl}
				value={nameNl}
				onChangeText={setNameNl}
			/>
			<Field
				label={copy.amount}
				value={amount}
				onChangeText={setAmount}
				keyboardType="decimal-pad"
			/>
			<View style={styles.inlineActions}>
				<GhostButton
					label={copy.grams}
					onPress={() => setBaseUnit("g")}
					style={baseUnit === "g" ? styles.selectedButton : undefined}
				/>
				<GhostButton
					label={copy.millilitres}
					onPress={() => setBaseUnit("ml")}
					style={baseUnit === "ml" ? styles.selectedButton : undefined}
				/>
			</View>
			<AppText variant="caption">{copy.estimated}</AppText>
			<AppText variant="caption">{copy.nutrientAmountHelp}</AppText>
			{NUTRIENT_KEYS.map((key) => (
				<Field
					key={key}
					label={labels[key]}
					value={nutrientInputs[key]}
					onChangeText={(value) =>
						setNutrientInputs((current) => ({ ...current, [key]: value }))
					}
					keyboardType="decimal-pad"
				/>
			))}
			<PrimaryButton
				label={copy.logOnceConfirm}
				onPress={log}
				disabled={!nameEn.trim() || !nameNl.trim() || !amount.trim()}
				loading={logging}
			/>
			<GhostButton label={copy.cancel} onPress={onCancel} disabled={logging} />
		</>
	);
}

function NutritionPreview({
	labels,
	preview,
}: {
	labels: Readonly<Record<NutrientKey, string>>;
	preview: ReturnType<typeof recipePreview>;
}) {
	return (
		<Card>
			{NUTRIENT_KEYS.map((key) => (
				<AppText key={key} variant="caption">
					{labels[key]}:{" "}
					{preview.nutrients[key].incomplete
						? "≥"
						: preview.nutrients[key].amount}
				</AppText>
			))}
		</Card>
	);
}

function Field({
	label,
	value,
	onChangeText,
	keyboardType,
	multiline,
}: {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
	keyboardType?: "decimal-pad";
	multiline?: boolean;
}) {
	return (
		<View style={styles.field}>
			<AppText variant="label">{label}</AppText>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				accessibilityLabel={label}
				keyboardType={keyboardType}
				multiline={multiline}
				style={[styles.input, multiline && styles.multiline]}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: spacing.md },
	flex: { flex: 1 },
	strong: { fontWeight: "700" },
	storageDisclosure: { gap: spacing.xs },
	actions: { gap: spacing.sm },
	inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	row: {
		minHeight: 52,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingVertical: spacing.xs,
	},
	choice: {
		minHeight: 44,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		paddingHorizontal: spacing.md,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	choiceSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
	addIngredient: { gap: spacing.sm },
	selectedButton: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
	field: { gap: spacing.xs },
	input: {
		minHeight: 48,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		paddingHorizontal: spacing.md,
		color: colors.text,
		fontSize: 15,
	},
	multiline: {
		minHeight: 96,
		paddingTop: spacing.md,
		textAlignVertical: "top",
	},
});
