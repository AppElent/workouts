import {
	type FoodResult,
	foodResults,
	forkShippedFood,
	forkSource,
	formatServingSelection,
	NEVO_ATTRIBUTION,
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientValue,
	previewServing,
	roundForDisplay,
	SALT_DERIVATION_DISCLOSURE,
	type ServingOption,
	type ShippedFood,
	servingOptions,
	shippedLibraryMeta,
} from "@workouts/core/nutrition";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../convex/api";
import { formatLongDate } from "../data/calendar-day";
import type { MealSlot } from "../data/nutrition-day";
import type {
	OffLookupOutcome,
	OffSearchOutcome,
} from "../data/open-food-facts";
import { useOpenFoodFacts } from "../data/open-food-facts-context";
import type {
	PersonalFood,
	PersonalFoodDraft,
} from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import { haptics } from "../feedback/haptics";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { fmt, type Messages, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card, Eyebrow } from "../ui/coach";
import { useConfirm } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { BarcodeScanner } from "./barcode-scanner";
import { PersonalFoodEditor } from "./personal-food-editor";

const RESULT_PAGE_SIZE = 50;

type FoodSelection =
	| { readonly kind: "shipped"; readonly food: ShippedFood }
	| { readonly kind: "personal"; readonly food: PersonalFood };

function asSelection(result: FoodResult<PersonalFood>): FoodSelection {
	return result.kind === "local"
		? { kind: "personal", food: result.food }
		: { kind: "shipped", food: result.food };
}

/**
 * The line under a result's name.
 *
 * Two of the four cases exist for #75: a correction says so, and — in the
 * deliberate broader view, the only place it is still listed — so does the
 * shipped record it replaced. Neither ever hides the other.
 *
 * #75 left a rule for whoever came next: if this reaches six cases it should
 * become a core function returning a caption *kind* that the screen
 * translates, rather than a screen-local function handed the whole message
 * tree. Checked at #79 — still four. #76's import captions went to the online
 * results list, which renders its provider line directly and never comes
 * through here, so the count did not move. Left as it is: at four one-line
 * branches the indirection would cost a hop through core and buy nothing.
 */
function resultCaption(
	result: FoodResult<PersonalFood>,
	messages: Messages["nutrition"],
	locale: "en" | "nl",
): string {
	if (result.kind === "local") {
		return result.shadows
			? fmt(messages.fork.forkedFrom, {
					name: result.shadows.sourceName[locale],
				})
			: messages.personalFood.resultLabel;
	}
	return result.shadowedBy
		? messages.fork.shadowed
		: `${messages.foodBrowser.per100} ${result.food.baseUnit}`;
}

/** Every non-"found" outcome is a failure exit: report it and leave Search and Enter manually where they already are. */
function offFailureMessage(
	kind: Exclude<OffLookupOutcome["kind"] | OffSearchOutcome["kind"], "found">,
	foodImport: Messages["nutrition"]["foodImport"],
	isSearch: boolean,
): string {
	switch (kind) {
		case "not-found":
			return isSearch ? foodImport.searchNotFound : foodImport.notFound;
		case "rate-limited":
			return foodImport.rateLimited;
		case "timeout":
			return foodImport.timeout;
		case "network-error":
			return foodImport.networkError;
		case "incomplete":
			return foodImport.incomplete;
		case "invalid":
			return foodImport.invalid;
	}
}

export function NutritionFoodBrowser({
	meal,
	date,
	onClose,
}: {
	meal: MealSlot;
	date: string;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const personalFoods = usePersonalFoods();
	const openFoodFacts = useOpenFoodFacts();
	const confirm = useConfirm();
	const toast = useToast();
	const [query, setQuery] = useState("");
	const [searchAll, setSearchAll] = useState(false);
	const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
	const [selectedFood, setSelectedFood] = useState<FoodSelection>();
	const [editingFood, setEditingFood] = useState<PersonalFood>();
	const [forkDraft, setForkDraft] = useState<PersonalFoodDraft>();
	const [creatingFood, setCreatingFood] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
	const [reviewingImport, setReviewingImport] = useState<PersonalFoodDraft>();
	const [onlineSearching, setOnlineSearching] = useState(false);
	const [onlineResults, setOnlineResults] =
		useState<readonly PersonalFoodDraft[]>();
	/**
	 * Ranking and shadowing both live in core (#75). All this screen decides is
	 * which tier the person asked for; which of their corrections stands in
	 * front of which shipped record is not a rendering question.
	 */
	const allResults = useMemo(
		() =>
			foodResults<PersonalFood>({
				query,
				locale,
				scope: searchAll ? "all" : "promoted",
				localMatches: personalFoods.search(query, locale),
				localFoods: personalFoods.forks(),
				limit: searchAll ? 2328 : RESULT_PAGE_SIZE,
			}),
		[locale, personalFoods, query, searchAll],
	);
	const results = allResults.slice(0, visibleCount);

	function closeEditor() {
		setCreatingFood(false);
		setEditingFood(undefined);
		setForkDraft(undefined);
	}

	async function handleBarcodeScanned(barcode: string) {
		setScanning(false);
		// Local foods are checked before any network call reaches Open Food
		// Facts (spec #68) — a Personal Food carrying this barcode wins outright.
		const localMatch = personalFoods.findByBarcode(barcode);
		if (localMatch) {
			setSelectedFood({ kind: "personal", food: localMatch });
			return;
		}
		setLookingUpBarcode(true);
		const outcome = await openFoodFacts.lookupBarcode(barcode);
		setLookingUpBarcode(false);
		if (outcome.kind === "found") {
			setReviewingImport(outcome.draft);
			return;
		}
		toast.error(offFailureMessage(outcome.kind, t.nutrition.foodImport, false));
	}

	async function runOnlineSearch() {
		if (onlineSearching || query.trim().length === 0) return;
		setOnlineSearching(true);
		setOnlineResults(undefined);
		const outcome = await openFoodFacts.search(query);
		setOnlineSearching(false);
		if (outcome.kind === "found") {
			setOnlineResults(outcome.drafts);
			return;
		}
		toast.error(offFailureMessage(outcome.kind, t.nutrition.foodImport, true));
	}

	if (scanning) {
		return (
			<BarcodeScanner
				onScanned={handleBarcodeScanned}
				onCancel={() => setScanning(false)}
			/>
		);
	}

	if (lookingUpBarcode) {
		return (
			<View style={[styles.root, styles.center]}>
				<AppText>{t.nutrition.barcode.lookingUp}</AppText>
			</View>
		);
	}

	if (reviewingImport) {
		return (
			<PersonalFoodEditor
				seed={reviewingImport}
				reviewNotice={{
					title: t.nutrition.foodImport.reviewTitle,
					body: t.nutrition.foodImport.reviewBody,
					attribution: reviewingImport.provenance.attribution,
				}}
				onCancel={() => setReviewingImport(undefined)}
				onSaved={(food) => {
					setReviewingImport(undefined);
					setSelectedFood({ kind: "personal", food });
				}}
			/>
		);
	}

	if (creatingFood || editingFood || forkDraft) {
		return (
			<PersonalFoodEditor
				food={editingFood}
				seed={forkDraft}
				onCancel={closeEditor}
				onSaved={(food) => {
					closeEditor();
					setSelectedFood({ kind: "personal", food });
				}}
			/>
		);
	}

	const servingSheet = selectedFood ? (
		<ServingDetail
			selection={selectedFood}
			meal={meal}
			date={date}
			onBack={() => setSelectedFood(undefined)}
			onLogged={onClose}
			onEdit={
				selectedFood.kind === "personal"
					? () => setEditingFood(selectedFood.food)
					: undefined
			}
			onCorrect={
				selectedFood.kind === "shipped"
					? () => {
							// A correction is a new local food, never an edit of the
							// shipped record — so this seeds the authoring screen
							// rather than opening the shipped row for editing.
							setForkDraft(forkShippedFood(selectedFood.food));
							setSelectedFood(undefined);
						}
					: undefined
			}
			onDelete={
				selectedFood.kind === "personal"
					? async () => {
							// Deleting a correction restores the shipped food to search,
							// which is a different promise from deleting a Personal Food
							// that stands alone.
							const isCorrection =
								selectedFood.food.provenance.forkedFrom !== undefined;
							const approved = await confirm({
								title: isCorrection
									? t.nutrition.fork.deleteTitle
									: t.nutrition.personalFood.deleteTitle,
								message: isCorrection
									? t.nutrition.fork.deleteBody
									: t.nutrition.personalFood.deleteBody,
								confirmLabel: t.nutrition.personalFood.delete,
								cancelLabel: t.nutrition.personalFood.cancel,
								destructive: true,
							});
							if (!approved) return;
							try {
								personalFoods.remove(selectedFood.food.id);
								setSelectedFood(undefined);
							} catch {
								toast.error(t.nutrition.personalFood.deleteFailure);
							}
						}
					: undefined
			}
		/>
	) : null;

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			{servingSheet}
			<Header backLabel={t.common.back} onBack={onClose} />
			<View style={styles.heading}>
				<Eyebrow>{t.nutrition.title}</Eyebrow>
				<AppText variant="title">
					{fmt(t.nutrition.foodBrowser.title, {
						meal: t.nutrition.meals[meal],
					})}
				</AppText>
				<AppText variant="caption">{formatLongDate(date, locale)}</AppText>
			</View>
			<View style={styles.findControls}>
				<TextInput
					value={query}
					onChangeText={(value) => {
						setQuery(value);
						setSearchAll(false);
						setVisibleCount(RESULT_PAGE_SIZE);
						setOnlineResults(undefined);
					}}
					placeholder={t.nutrition.foodBrowser.searchPlaceholder}
					placeholderTextColor={colors.textFaint}
					accessibilityLabel={t.nutrition.foodBrowser.searchPlaceholder}
					style={[styles.input, styles.flex]}
					autoCorrect={false}
				/>
				<GhostButton
					label={t.nutrition.foodBrowser.scanBarcode}
					onPress={() => setScanning(true)}
				/>
			</View>
			<GhostButton
				label={t.nutrition.personalFood.createTitle}
				onPress={() => setCreatingFood(true)}
			/>
			{!searchAll ? (
				<GhostButton
					label={t.nutrition.foodBrowser.searchAll}
					onPress={() => {
						setSearchAll(true);
						setVisibleCount(RESULT_PAGE_SIZE);
					}}
				/>
			) : null}
			{query.trim().length > 0 ? (
				<GhostButton
					label={
						onlineSearching
							? t.nutrition.foodBrowser.searchingOnline
							: t.nutrition.foodBrowser.searchOnline
					}
					loading={onlineSearching}
					onPress={runOnlineSearch}
				/>
			) : null}
			<AppText variant="label">
				{searchAll
					? t.nutrition.foodBrowser.allResults
					: t.nutrition.foodBrowser.promotedResults}
			</AppText>
			{results.length === 0 ? (
				<EmptyState body={t.nutrition.foodBrowser.empty} />
			) : (
				<Card style={styles.results}>
					{results.map((result) => (
						<Pressable
							key={`${result.kind}:${result.food.id}`}
							onPress={() => setSelectedFood(asSelection(result))}
							accessibilityRole="button"
							style={({ pressed }) => [
								styles.foodRow,
								pressed && styles.pressed,
							]}
						>
							<AppText variant="heading">
								{result.kind === "shipped" ? (result.food.emoji ?? "•") : "◇"}
							</AppText>
							<View style={styles.flex}>
								<AppText style={styles.strong}>
									{result.kind === "local"
										? result.food.name[locale]
										: (searchAll ? result.food.sourceName : result.food.name)[
												locale
											]}
								</AppText>
								<AppText variant="caption">
									{resultCaption(result, t.nutrition, locale)}
								</AppText>
							</View>
						</Pressable>
					))}
				</Card>
			)}
			{results.length < allResults.length ? (
				<GhostButton
					label={t.nutrition.foodBrowser.showMore}
					onPress={() => setVisibleCount((count) => count + RESULT_PAGE_SIZE)}
				/>
			) : null}
			{onlineResults && onlineResults.length > 0 ? (
				<>
					<AppText variant="label">
						{t.nutrition.foodBrowser.onlineResults}
					</AppText>
					<Card style={styles.results}>
						{onlineResults.map((draft, index) => (
							<Pressable
								// biome-ignore lint/suspicious/noArrayIndexKey: an online search result has no stable id until it is imported
								key={`off:${index}`}
								onPress={() => setReviewingImport(draft)}
								accessibilityRole="button"
								style={({ pressed }) => [
									styles.foodRow,
									pressed && styles.pressed,
								]}
							>
								<AppText variant="heading">◈</AppText>
								<View style={styles.flex}>
									<AppText style={styles.strong}>{draft.name[locale]}</AppText>
									<AppText variant="caption">
										{draft.provenance.provider}
									</AppText>
								</View>
							</Pressable>
						))}
					</Card>
				</>
			) : null}
		</ScrollView>
	);
}

/**
 * Choosing a serving, presented as a sheet over the results (spec #68: "Choosing
 * a food opens a serving sheet").
 *
 * A sheet rather than another pushed screen because the search you came from is
 * still the context: you are checking a number against a food you just found,
 * and half the time you dismiss and pick a different one. It keeps the results
 * visible behind it, dismisses on a backdrop tap and on Android's back button,
 * and slides from the bottom edge — which is where dismissing sends it — unless
 * the person has asked for reduced motion, in which case it cuts.
 */
function ServingDetail({
	selection,
	meal,
	date,
	onBack,
	onLogged,
	onEdit,
	onDelete,
	onCorrect,
}: {
	selection: FoodSelection;
	meal: MealSlot;
	date: string;
	onBack: () => void;
	onLogged: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	/** Start a correction of this shipped food. Absent for a local food. */
	onCorrect?: () => void;
}) {
	const { t, locale } = useI18n();
	const toast = useToast();
	const insets = useSafeAreaInsets();
	const reduceMotion = useReduceMotion();
	const log = useMutation(api.nutritionDiary.log);
	const [logging, setLogging] = useState(false);
	const food = selection.food;
	const choices = useMemo(() => servingChoices(selection), [selection]);
	const [selectedServing, setSelectedServing] = useState<ServingOption>(
		choices[0],
	);
	const [quantityText, setQuantityText] = useState("1");
	const parsed = Number(quantityText.replace(",", "."));
	const quantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
	const preview = servingPreview(selection, selectedServing, quantity, locale);
	const canLog = quantity > 0;
	/** The shipped record behind a correction — the original, still nameable. */
	const correctedSource =
		selection.kind === "personal" ? forkSource(selection.food) : undefined;

	async function logFood() {
		if (!canLog || logging) return;
		setLogging(true);
		try {
			const common = {
				date,
				meal,
				name: selection.food.name,
				serving: {
					en: formatServingSelection(selectedServing, quantity, "en"),
					nl: formatServingSelection(selectedServing, quantity, "nl"),
				},
				quantity,
				amount: preview.amount,
				baseUnit: selection.food.baseUnit,
				nutrients: Object.fromEntries(
					NUTRIENT_KEYS.map((key) => [key, preview.nutrients[key]]),
				) as Pick<ShippedFood["nutrients"], (typeof NUTRIENT_KEYS)[number]>,
			};
			if (selection.kind === "shipped") {
				const meta = shippedLibraryMeta();
				await log({
					...common,
					provenance: {
						source: "shipped",
						sourceId: selection.food.id,
						dataset: meta.dataset.name,
						edition: meta.dataset.edition,
						sourceCode: selection.food.code,
						sourceName: selection.food.sourceName,
						saltDerived: true,
					},
				});
			} else {
				const provenance = selection.food.provenance;
				await log({
					...common,
					provenance: {
						source: provenance.recordOrigin,
						sourceId: selection.food.id,
						nutritionSource: provenance.nutritionSource,
						locallyEdited: provenance.locallyEdited,
						...(provenance.forkedFrom
							? { forkedFrom: provenance.forkedFrom }
							: {}),
						...(provenance.provider ? { provider: provenance.provider } : {}),
						...(provenance.barcode ? { barcode: provenance.barcode } : {}),
						...(provenance.attribution
							? { attribution: provenance.attribution }
							: {}),
					},
				});
			}
			haptics.entryLogged();
			onLogged();
		} catch {
			toast.error(t.nutrition.foodBrowser.logFailure);
		} finally {
			setLogging(false);
		}
	}

	return (
		<Modal
			visible
			transparent
			animationType={modalAnimation(reduceMotion, "slide")}
			// Android's back button dismisses the sheet rather than the screen
			// underneath it.
			onRequestClose={onBack}
		>
			<Pressable style={styles.sheetBackdrop} onPress={onBack}>
				{/* Swallows taps so pressing the sheet itself does not dismiss it. */}
				<Pressable
					style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
					onPress={() => {}}
				>
					<View style={styles.grabber} />
					<View style={styles.sheetHeader}>
						<AppText variant="heading" style={styles.flex} numberOfLines={2}>
							{food.name[locale]}
						</AppText>
						<Pressable
							onPress={onBack}
							hitSlop={12}
							accessibilityRole="button"
							// Its own name, not "Go back": the browser's header back is
							// still on screen behind the sheet, and two controls called
							// the same thing is two controls a screen reader cannot tell
							// apart.
							accessibilityLabel={t.nutrition.foodBrowser.closeServingLabel}
							style={styles.sheetClose}
						>
							<AppText style={{ color: colors.accent, fontWeight: "800" }}>
								{t.nutrition.foodBrowser.closeServing}
							</AppText>
						</Pressable>
					</View>
					<ScrollView
						contentContainerStyle={styles.sheetContent}
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
					>
						<View style={styles.heading}>
							<AppText variant="display">
								{selection.kind === "shipped"
									? (selection.food.emoji ?? "🍽️")
									: "◇"}
							</AppText>
							{/* The sheet header already carries the name and keeps it in
							    place while this scrolls, so the body shows what the header
							    cannot: the glyph, and where the figures came from. */}
							<AppText variant="caption">
								{selection.kind === "shipped"
									? selection.food.sourceName[locale]
									: correctedSource
										? t.nutrition.fork.resultLabel
										: t.nutrition.personalFood.resultLabel}
							</AppText>
						</View>
						<AppText variant="label">{t.nutrition.foodBrowser.serving}</AppText>
						<View style={styles.options}>
							{choices.map((candidate) => (
								<Pressable
									key={candidate.kind === "authored" ? candidate.index : "base"}
									onPress={() => {
										// A meaningful selection: it changes the figures below and the
										// numbers that will be written. The list itself is silent.
										if (candidate !== selectedServing)
											haptics.selectionChanged();
										setSelectedServing(candidate);
										setQuantityText(
											candidate.kind === "base-unit" ? "100" : "1",
										);
									}}
									accessibilityRole="radio"
									accessibilityState={{
										checked: selectedServing === candidate,
									}}
									style={[
										styles.option,
										selectedServing === candidate && styles.optionSelected,
									]}
								>
									<AppText>{candidate.label[locale]}</AppText>
								</Pressable>
							))}
						</View>
						<AppText variant="label">
							{t.nutrition.foodBrowser.quantity}
						</AppText>
						<TextInput
							value={quantityText}
							onChangeText={setQuantityText}
							accessibilityLabel={t.nutrition.foodBrowser.quantity}
							keyboardType="decimal-pad"
							style={styles.input}
						/>
						<Card style={styles.preview}>
							<AppText variant="heading">{preview.label}</AppText>
							<AppText variant="caption">
								{preview.amount} {preview.baseUnit}
							</AppText>
							{NUTRIENT_KEYS.map((key) => (
								<View key={key} style={styles.nutrientRow}>
									<AppText style={styles.flex}>
										{t.nutrition.nutrients[key]}
									</AppText>
									<AppText style={styles.strong}>
										{formatNutrient(
											preview.nutrients[key],
											key,
											t.nutrition.foodBrowser,
										)}
									</AppText>
								</View>
							))}
						</Card>
						{selection.kind === "shipped" ? (
							<View style={styles.attribution}>
								<AppText variant="caption">{NEVO_ATTRIBUTION}</AppText>
								<AppText variant="caption">
									{SALT_DERIVATION_DISCLOSURE[locale]}
								</AppText>
								<GhostButton
									label={t.nutrition.fork.correct}
									onPress={onCorrect}
								/>
							</View>
						) : (
							<>
								{correctedSource ? (
									// NEVO attribution follows the figures, not the record: these
									// started as NEVO's and are still shown wherever they are used.
									<View style={styles.attribution}>
										<AppText variant="caption">
											{fmt(t.nutrition.fork.forkedFrom, {
												name: correctedSource.sourceName[locale],
											})}
										</AppText>
										<AppText variant="caption">
											{selection.food.provenance.locallyEdited
												? t.nutrition.fork.locallyEdited
												: t.nutrition.fork.unchanged}
										</AppText>
										<AppText variant="caption">{NEVO_ATTRIBUTION}</AppText>
										<AppText variant="caption">
											{SALT_DERIVATION_DISCLOSURE[locale]}
										</AppText>
									</View>
								) : selection.food.provenance.attribution ? (
									// An imported food carries its provider's attribution instead (#76).
									<View style={styles.attribution}>
										<AppText variant="caption">
											{selection.food.provenance.attribution}
										</AppText>
									</View>
								) : null}
								<View style={styles.options}>
									{/* A correction is stored as a Personal Food, so editing one is
						    the same action under the same name. */}
									<GhostButton
										label={t.nutrition.personalFood.editTitle}
										onPress={onEdit}
									/>
									<GhostButton
										label={t.nutrition.personalFood.delete}
										onPress={onDelete}
									/>
								</View>
							</>
						)}
						<PrimaryButton
							label={
								logging
									? t.nutrition.foodBrowser.logging
									: t.nutrition.foodBrowser.log
							}
							onPress={logFood}
							loading={logging}
							disabled={!canLog}
						/>
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function formatNutrient(
	value: NutrientValue,
	key: (typeof NUTRIENT_KEYS)[number],
	messages: { trace: string; absent: string },
): string {
	if (value.kind === "trace") return messages.trace;
	if (value.kind === "absent") return messages.absent;
	return `${roundForDisplay(key, value.amount)} ${NUTRIENT_UNITS[key]}`;
}

function servingChoices(selection: FoodSelection): ServingOption[] {
	if (selection.kind === "shipped") return servingOptions(selection.food);
	const options: ServingOption[] = selection.food.servings.map(
		(serving, index) => ({
			kind: "authored",
			index,
			label: serving.label,
			amount: serving.amount,
		}),
	);
	options.push({
		kind: "base-unit",
		label:
			selection.food.baseUnit === "g"
				? { en: "Gram (g)", nl: "Gram (g)" }
				: { en: "Millilitre (ml)", nl: "Milliliter (ml)" },
		amount: 1,
		unit: selection.food.baseUnit,
	});
	return options;
}

function scalePersonalValue(
	value: NutrientValue,
	factor: number,
): NutrientValue {
	return value.kind === "value"
		? { kind: "value", amount: value.amount * factor }
		: { kind: value.kind };
}

function servingPreview(
	selection: FoodSelection,
	option: ServingOption,
	quantity: number,
	locale: "en" | "nl",
) {
	if (selection.kind === "shipped") {
		return previewServing(selection.food, option, quantity, locale);
	}
	const amount = option.amount * quantity;
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		nutrients[key] = scalePersonalValue(
			selection.food.nutrients[key],
			amount / 100,
		);
	}
	return {
		amount,
		baseUnit: selection.food.baseUnit,
		label: formatServingSelection(option, quantity, locale),
		nutrients,
	};
}

function Header({
	backLabel,
	onBack,
}: {
	backLabel: string;
	onBack: () => void;
}) {
	return (
		<Pressable
			onPress={onBack}
			accessibilityRole="button"
			accessibilityLabel={backLabel}
			style={styles.back}
		>
			<AppText variant="heading" style={{ color: colors.accent }}>
				‹
			</AppText>
			<AppText>{backLabel}</AppText>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	center: { alignItems: "center", justifyContent: "center" },
	content: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: spacing.md },
	flex: { flex: 1 },
	findControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	heading: { gap: spacing.xs },
	strong: { fontWeight: "700" },
	back: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
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
	results: { paddingVertical: spacing.xs },
	foodRow: {
		minHeight: 56,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	pressed: { backgroundColor: colors.surface2 },
	options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	option: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.pill,
	},
	optionSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
	preview: { gap: spacing.sm },
	nutrientRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	attribution: { gap: spacing.xs },

	sheetBackdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: "rgba(0, 0, 0, 0.6)",
	},
	sheet: {
		// Tall, because eight nutrients and a serving picker do not fit in a
		// peek — but never the full height, so the results stay visible behind
		// it and the sheet still reads as something laid over them.
		maxHeight: "90%",
		gap: spacing.sm,
		backgroundColor: colors.bg,
		borderTopLeftRadius: radius.sheet,
		borderTopRightRadius: radius.sheet,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	grabber: {
		alignSelf: "center",
		width: 36,
		height: 4,
		borderRadius: radius.pill,
		backgroundColor: colors.borderStrong,
	},
	sheetHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		minHeight: 44,
	},
	sheetClose: { minHeight: 44, justifyContent: "center" },
	sheetContent: { gap: spacing.md, paddingBottom: spacing.md },
});
