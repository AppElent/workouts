import {
	type FoodResult,
	foodResults,
	forkShippedFood,
	forkSource,
	formatServingSelection,
	getShippedFood,
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
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	use,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatLongDate } from "../data/calendar-day";
import {
	type CookingRecipe,
	type NutritionCookingRepository,
	openNutritionCookingRepository,
} from "../data/nutrition-cooking-repository";
import type { DiaryEntry, MealSlot } from "../data/nutrition-day";
import {
	mintNutritionUuid,
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../data/nutrition-operation-service";
import {
	foodSourceKey,
	portionMemoryFor,
	rememberedSelection,
} from "../data/nutrition-shortcuts";
import type {
	OffLookupOutcome,
	OffSearchOutcome,
} from "../data/open-food-facts";
import { useOpenFoodFacts } from "../data/open-food-facts-context";
import type {
	Combo,
	PersonalFood,
	PersonalFoodDraft,
} from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import { haptics } from "../feedback/haptics";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { fmt, type Messages, useI18n } from "../i18n";
import { colors, radius, spacing } from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card } from "../ui/coach";
import { useConfirm } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { BarcodeScanner } from "./barcode-scanner";
import {
	type FoodBrowserTab,
	nutritionFoodBrowserCopy,
} from "./nutrition-food-browser-copy";
import { PersonalFoodEditor } from "./personal-food-editor";

const RESULT_PAGE_SIZE = 50;

type FoodSelection =
	| { readonly kind: "shipped"; readonly food: ShippedFood }
	| { readonly kind: "personal"; readonly food: PersonalFood };

type LogOutcome = "continue" | "close";
type FoodFilter = FoodBrowserTab;

type BrowserItem =
	| {
			readonly kind: "food";
			readonly selection: FoodSelection;
			readonly caption: string;
	  }
	| { readonly kind: "combo"; readonly combo: Combo }
	| { readonly kind: "recipe"; readonly recipe: CookingRecipe }
	| {
			readonly kind: "online";
			readonly draft: PersonalFoodDraft;
			readonly id: number;
	  };

const FoodBrowserCookingRepositoryContext = createContext<
	NutritionCookingRepository | undefined
>(undefined);

/** Test and host seam: production opens the device store only when Recipes is visited. */
export function FoodBrowserCookingRepositoryProvider({
	repository,
	children,
}: {
	repository: NutritionCookingRepository;
	children: ReactNode;
}) {
	return (
		<FoodBrowserCookingRepositoryContext value={repository}>
			{children}
		</FoodBrowserCookingRepositoryContext>
	);
}

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

function resultEnergyCaption(
	food: { nutrients: Record<NutrientKey, NutrientValue>; baseUnit: "g" | "ml" },
	messages: Messages["nutrition"],
): string {
	const energy = food.nutrients.energy;
	const unit = food.baseUnit;
	if (energy.kind === "value") {
		return fmt(messages.foodBrowser.energyPer100, {
			amount: roundForDisplay("energy", energy.amount),
			unit,
		});
	}
	return energy.kind === "trace"
		? fmt(messages.foodBrowser.energyTracePer100, { unit })
		: fmt(messages.foodBrowser.energyUnavailablePer100, { unit });
}

function quickEnergyAmount(
	preview: ReturnType<typeof servingPreview>,
): string | undefined {
	const energy = preview.nutrients.energy;
	return energy.kind === "value"
		? String(roundForDisplay("energy", energy.amount))
		: undefined;
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
		case "unavailable":
			return foodImport.unavailable;
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
	const copy = nutritionFoodBrowserCopy(locale);
	const router = useRouter();
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const reduceMotion = useReduceMotion();
	const personalFoods = usePersonalFoods();
	const openFoodFacts = useOpenFoodFacts();
	const confirm = useConfirm();
	const toast = useToast();
	const suppliedCookingRepository = use(FoodBrowserCookingRepositoryContext);
	const [ownedCookingRepository, setOwnedCookingRepository] =
		useState<NutritionCookingRepository>();
	const cookingRepository = suppliedCookingRepository ?? ownedCookingRepository;
	const [query, setQuery] = useState("");
	const [showCaptureTools, setShowCaptureTools] = useState(false);
	const [showMealChoices, setShowMealChoices] = useState(false);
	const [filter, setFilter] = useState<FoodFilter>("recent");
	const [selectedMeal, setSelectedMeal] = useState<MealSlot>(meal);
	const [addedFeedback, setAddedFeedback] = useState<string>();
	const servingPendingRef = useRef(false);
	const [servingPending, setServingPending] = useState(false);
	const [selectedFood, setSelectedFood] = useState<FoodSelection>();
	const [editingFood, setEditingFood] = useState<PersonalFood>();
	const [forkDraft, setForkDraft] = useState<PersonalFoodDraft>();
	const [creatingFood, setCreatingFood] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
	const [reviewingImport, setReviewingImport] = useState<PersonalFoodDraft>();
	const [onlineSearching, setOnlineSearching] = useState(false);
	const [onlineFeedback, setOnlineFeedback] = useState<string>();
	const searchRevision = useRef(0);
	const [onlineResults, setOnlineResults] =
		useState<readonly PersonalFoodDraft[]>();
	const quickLoggingRef = useRef(new Set<string>());
	const [quickLoggingKeys, setQuickLoggingKeys] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	useEffect(() => {
		if (filter !== "recipes" || cookingRepository) return;
		setOwnedCookingRepository(openNutritionCookingRepository());
	}, [cookingRepository, filter]);
	useEffect(
		() => () => ownedCookingRepository?.close(),
		[ownedCookingRepository],
	);
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
				scope: filter === "all" ? "all" : "promoted",
				localMatches: personalFoods.search(query, locale),
				localFoods: personalFoods.forks(),
				limit: filter === "all" ? 2328 : RESULT_PAGE_SIZE,
			}),
		[filter, locale, personalFoods, query],
	);
	// The operation-version subscription above deliberately refreshes these
	// durable shortcuts after a quick log or a favorite toggle.
	const shortcuts = subject
		? filter === "favorites"
			? operations.listFavorites(subject)
			: operations.listRecent(subject)
		: [];
	const shortcutSelections = useMemo<FoodSelection[]>(
		() =>
			shortcuts.reduce<FoodSelection[]>((selections, shortcut) => {
				const separator = shortcut.sourceKey.indexOf(":");
				const kind = shortcut.sourceKey.slice(0, separator);
				const id = shortcut.sourceKey.slice(separator + 1);
				if (kind === "shipped") {
					const food = getShippedFood(id);
					if (food) selections.push({ kind: "shipped", food });
					return selections;
				}
				if (kind === "personal") {
					const food = personalFoods.find(id);
					if (food) selections.push({ kind: "personal", food });
					return selections;
				}
				return selections;
			}, []),
		[personalFoods, shortcuts],
	);
	const combos = personalFoods.listCombos();
	const recipes =
		subject && cookingRepository ? cookingRepository.listRecipes(subject) : [];
	const visibleItems = useMemo<readonly BrowserItem[]>(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		if (filter === "combos") {
			return combos
				.filter(
					(combo) =>
						!normalizedQuery ||
						combo.name.toLocaleLowerCase().includes(normalizedQuery),
				)
				.map((combo) => ({ kind: "combo" as const, combo }));
		}
		if (filter === "recipes") {
			return recipes
				.filter(
					(recipe) =>
						!normalizedQuery ||
						`${recipe.name.en} ${recipe.name.nl}`
							.toLocaleLowerCase()
							.includes(normalizedQuery),
				)
				.map((recipe) => ({ kind: "recipe" as const, recipe }));
		}
		const foods =
			filter === "recent" || filter === "favorites"
				? shortcutSelections
						.filter(
							(selection) =>
								!normalizedQuery ||
								selection.food.name[locale]
									.toLocaleLowerCase()
									.includes(normalizedQuery),
						)
						.map((selection) => ({
							kind: "food" as const,
							selection,
							caption: t.nutrition.foodBrowser.lastUsed,
						}))
				: allResults.map((result) => ({
						kind: "food" as const,
						selection: asSelection(result),
						caption: resultCaption(result, t.nutrition, locale),
					}));
		return [
			...foods,
			...(onlineResults ?? []).map((draft, id) => ({
				kind: "online" as const,
				draft,
				id,
			})),
		];
	}, [
		allResults,
		combos,
		filter,
		locale,
		onlineResults,
		query,
		recipes,
		shortcutSelections,
		t.nutrition,
	]);

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
		const revision = searchRevision.current;
		setOnlineSearching(true);
		setOnlineFeedback(undefined);
		setOnlineResults(undefined);
		try {
			const outcome = await openFoodFacts.search(query);
			if (revision !== searchRevision.current) return;
			if (outcome.kind === "found") {
				setOnlineResults(outcome.drafts);
				return;
			}
			setOnlineFeedback(
				offFailureMessage(outcome.kind, t.nutrition.foodImport, true),
			);
		} catch {
			if (revision === searchRevision.current)
				setOnlineFeedback(t.nutrition.foodImport.networkError);
		} finally {
			setOnlineSearching(false);
		}
	}

	if (scanning) {
		return (
			<Modal
				visible
				presentationStyle="fullScreen"
				animationType={modalAnimation(reduceMotion, "slide")}
				onRequestClose={() => setScanning(false)}
			>
				<BarcodeScanner
					onScanned={handleBarcodeScanned}
					onCancel={() => setScanning(false)}
				/>
			</Modal>
		);
	}

	if (lookingUpBarcode) {
		return (
			<View style={[styles.root, styles.center]}>
				<AppText>{t.nutrition.barcode.lookingUp}</AppText>
			</View>
		);
	}

	let editor = null;
	if (reviewingImport) {
		editor = (
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
		editor = (
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

	const servingSheet =
		selectedFood && !editor ? (
			<ServingDetail
				key={`${selectedFood.kind}:${selectedFood.food.id}`}
				selection={selectedFood}
				meal={selectedMeal}
				date={date}
				onBack={() => {
					if (!servingPendingRef.current) setSelectedFood(undefined);
				}}
				onPendingChange={(pending) => {
					servingPendingRef.current = pending;
					setServingPending(pending);
				}}
				onLogged={(outcome, foodName) => {
					if (outcome === "close") {
						onClose();
						return;
					}
					setSelectedFood(undefined);
					setAddedFeedback(
						fmt(t.nutrition.foodBrowser.addedToMeal, {
							food: foodName,
							meal: t.nutrition.meals[selectedMeal],
						}),
					);
				}}
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

	function quickLog(selection: FoodSelection) {
		const sourceKey = foodSourceKey(
			selection.kind === "shipped" ? "shipped" : "personal",
			selection.food.id,
		);
		if (!subject || quickLoggingRef.current.has(sourceKey)) return;
		const quickSelection = resolveQuickSelection(selection);
		if (!quickSelection) return;
		const { option: selectedServing, quantity } = quickSelection;
		quickLoggingRef.current.add(sourceKey);
		setQuickLoggingKeys((keys) => new Set(keys).add(sourceKey));
		try {
			const clientEntryId = mintNutritionUuid();
			const { common, provenance } = createFoodSnapshot(
				selection,
				selectedServing,
				quantity,
				date,
				selectedMeal,
				clientEntryId,
				locale,
			);
			operations.create(
				subject,
				{ ...common, provenance },
				{
					sourceKey,
					portion: portionMemoryFor(
						selectedServing,
						quantity,
						selection.food.baseUnit,
					),
				},
				() => {
					quickLoggingRef.current.delete(sourceKey);
					setQuickLoggingKeys((keys) => {
						const next = new Set(keys);
						next.delete(sourceKey);
						return next;
					});
					toast.error(t.nutrition.foodBrowser.logFailure);
				},
				() => {
					quickLoggingRef.current.delete(sourceKey);
					setQuickLoggingKeys((keys) => {
						const next = new Set(keys);
						next.delete(sourceKey);
						return next;
					});
					haptics.entryLogged();
					setAddedFeedback(
						fmt(t.nutrition.foodBrowser.addedToMeal, {
							food: selection.food.name[locale],
							meal: t.nutrition.meals[selectedMeal],
						}),
					);
				},
			);
		} catch {
			quickLoggingRef.current.delete(sourceKey);
			setQuickLoggingKeys((keys) => {
				const next = new Set(keys);
				next.delete(sourceKey);
				return next;
			});
			toast.error(t.nutrition.foodBrowser.logFailure);
		}
	}

	function resolveQuickSelection(selection: FoodSelection) {
		const choices = servingChoices(selection);
		const sourceKey = foodSourceKey(
			selection.kind === "shipped" ? "shipped" : "personal",
			selection.food.id,
		);
		const remembered = rememberedSelection(
			choices,
			selection.food.baseUnit,
			subject ? operations.getShortcut(subject, sourceKey)?.portion : undefined,
		);
		const option = remembered?.option ?? choices[0];
		const quantity =
			remembered?.quantity ?? (option?.kind === "base-unit" ? 100 : 1);
		return option && quantity > 0 ? { option, quantity } : undefined;
	}

	return (
		<>
			<Modal
				visible={Boolean(servingSheet || editor)}
				presentationStyle={servingSheet ? "formSheet" : "pageSheet"}
				animationType={modalAnimation(reduceMotion, "slide")}
				allowSwipeDismissal={!servingPending}
				onRequestClose={() => {
					if (servingPendingRef.current) return;
					setReviewingImport(undefined);
					closeEditor();
					setSelectedFood(undefined);
				}}
			>
				{editor ?? servingSheet}
			</Modal>
			<FlatList
				data={visibleItems}
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.content}
				keyExtractor={(item) =>
					item.kind === "food"
						? `food:${item.selection.kind}:${item.selection.food.id}`
						: item.kind === "combo"
							? `combo:${item.combo.id}`
							: item.kind === "recipe"
								? `recipe:${item.recipe.id}`
								: `online:${item.id}`
				}
				ListHeaderComponent={
					<View style={styles.headerContent}>
						<View style={styles.targetPicker}>
							<View style={styles.pickerRow}>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={fmt(t.nutrition.foodBrowser.title, {
										meal: t.nutrition.meals[selectedMeal],
									})}
									accessibilityState={{ expanded: showMealChoices }}
									onPress={() => setShowMealChoices((open) => !open)}
									style={styles.mealPicker}
								>
									<View style={styles.flex}>
										<AppText style={styles.strong}>
											{t.nutrition.meals[selectedMeal]}
										</AppText>
										<AppText variant="caption" style={styles.dateLabel}>
											{formatLongDate(date, locale)}
										</AppText>
									</View>
									<SymbolView
										name={{
											ios: "chevron.up.chevron.down",
											android: "arrow_drop_down",
											web: "expand_more",
										}}
										size={18}
										tintColor={colors.textMuted}
									/>
								</Pressable>
								<GhostButton
									label={copy.done}
									onPress={onClose}
									disabled={servingPending}
								/>
							</View>
							{showMealChoices ? (
								<View style={styles.mealMenu} accessibilityRole="menu">
									{(["breakfast", "lunch", "dinner", "snacks"] as const).map(
										(slot) => (
											<Pressable
												key={slot}
												accessibilityRole="radio"
												accessibilityState={{ checked: selectedMeal === slot }}
												onPress={() => {
													setSelectedMeal(slot);
													setShowMealChoices(false);
												}}
												style={styles.mealChoice}
											>
												<AppText>{t.nutrition.meals[slot]}</AppText>
											</Pressable>
										),
									)}
								</View>
							) : null}
						</View>
						{addedFeedback ? (
							<AppText accessibilityLiveRegion="polite" style={styles.feedback}>
								{addedFeedback}
							</AppText>
						) : null}
						<View style={styles.findControls}>
							<TextInput
								value={query}
								onChangeText={(value) => {
									if (filter === "recent" && value.trim()) setFilter("all");
									setQuery(value);
									searchRevision.current += 1;
									setOnlineFeedback(undefined);
									setOnlineResults(undefined);
								}}
								placeholder={copy.search}
								placeholderTextColor={colors.textFaint}
								accessibilityLabel={copy.search}
								style={[styles.input, styles.flex]}
								autoCorrect={false}
							/>
							<IconButton
								label={copy.scanBarcode}
								symbol={{
									ios: "barcode.viewfinder",
									android: "barcode_scanner",
									web: "barcode",
								}}
								onPress={() => setScanning(true)}
							/>
							<IconButton
								label={copy.moreActions}
								symbol={{ ios: "plus.circle.fill", android: "add", web: "add" }}
								onPress={() => setShowCaptureTools((open) => !open)}
								selected={showCaptureTools}
							/>
						</View>
						{showCaptureTools ? (
							<View style={styles.actionMenu} accessibilityRole="menu">
								<Pressable
									accessibilityRole="menuitem"
									onPress={() =>
										router.push({
											pathname: "/nutrition-cooking",
											params: { date, meal: selectedMeal, mode: "oneoff-log" },
										})
									}
									style={styles.actionMenuItem}
								>
									<AppText>{copy.logOnce}</AppText>
								</Pressable>
								<Pressable
									accessibilityRole="menuitem"
									onPress={() => setCreatingFood(true)}
									style={styles.actionMenuItem}
								>
									<AppText>{copy.newPersonalFood}</AppText>
								</Pressable>
								<Pressable
									accessibilityRole="menuitem"
									onPress={() =>
										router.push({
											pathname: "/nutrition-cooking",
											params: { date, meal: selectedMeal, mode: "draft-new" },
										})
									}
									style={styles.actionMenuItem}
								>
									<AppText>{copy.captureLater}</AppText>
								</Pressable>
							</View>
						) : null}
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.tabList}
						>
							{(
								["recent", "favorites", "combos", "recipes", "all"] as const
							).map((tab) => (
								<Pressable
									key={tab}
									accessibilityRole="tab"
									accessibilityState={{ selected: filter === tab }}
									onPress={() => setFilter(tab)}
									style={[styles.tab, filter === tab && styles.tabSelected]}
								>
									<AppText
										style={filter === tab ? styles.tabTextSelected : undefined}
									>
										{tab === "all" ? copy.allFoods : copy[tab]}
									</AppText>
								</Pressable>
							))}
						</ScrollView>
						{query.trim().length > 0 && filter === "all" ? (
							<Pressable
								onPress={runOnlineSearch}
								disabled={onlineSearching}
								accessibilityRole="button"
								style={styles.onlineSearch}
							>
								<AppText style={styles.onlineSearchText}>
									{onlineSearching ? copy.searchingOnline : copy.searchOnline}
								</AppText>
							</Pressable>
						) : null}
						{filter === "all" && onlineFeedback ? (
							<View
								testID="off-search-feedback"
								accessibilityRole="alert"
								accessibilityLiveRegion="polite"
								style={styles.heading}
							>
								<AppText>{onlineFeedback}</AppText>
							</View>
						) : null}
					</View>
				}
				ListEmptyComponent={
					filter === "all" && (onlineFeedback || onlineSearching) ? null : (
						<BrowserEmptyState tab={filter} query={query} copy={copy} />
					)
				}
				renderItem={({ item }) => {
					if (item.kind === "combo")
						return (
							<LibraryRow
								name={item.combo.name}
								caption={
									item.combo.parts.length === 1
										? locale === "nl"
											? "1 voedingsmiddel"
											: "1 food"
										: locale === "nl"
											? `${item.combo.parts.length} voedingsmiddelen`
											: `${item.combo.parts.length} foods`
								}
								detailLabel={copy.comboDetail(item.combo.name)}
								onDetail={() =>
									router.push({
										pathname: "/nutrition-combos",
										params: {
											date,
											meal: selectedMeal,
											comboId: item.combo.id,
										},
									})
								}
								logLabel={copy.log}
								onLog={() =>
									router.push({
										pathname: "/nutrition-combos",
										params: {
											date,
											meal: selectedMeal,
											comboId: item.combo.id,
										},
									})
								}
							/>
						);
					if (item.kind === "recipe")
						return (
							<LibraryRow
								name={item.recipe.name[locale]}
								caption={item.recipe.versionName[locale]}
								detailLabel={copy.recipeDetail(item.recipe.name[locale])}
								onDetail={() =>
									router.push({
										pathname: "/nutrition-cooking",
										params: {
											date,
											meal: selectedMeal,
											mode: "recipe-log",
											recipeId: item.recipe.id,
										},
									})
								}
								logLabel={copy.log}
								onLog={() =>
									router.push({
										pathname: "/nutrition-cooking",
										params: {
											date,
											meal: selectedMeal,
											mode: "recipe-log",
											recipeId: item.recipe.id,
										},
									})
								}
							/>
						);
					if (item.kind === "online")
						return (
							<Pressable
								onPress={() => setReviewingImport(item.draft)}
								accessibilityRole="button"
								style={styles.foodRow}
							>
								<AppText variant="heading">◈</AppText>
								<View style={styles.flex}>
									<AppText style={styles.strong}>
										{item.draft.name[locale]}
									</AppText>
									<AppText variant="caption">
										{copy.onlineResults} · {item.draft.provenance.provider}
									</AppText>
									<AppText variant="caption">
										{resultEnergyCaption(item.draft, t.nutrition)}
									</AppText>
								</View>
							</Pressable>
						);
					const sourceKey = foodSourceKey(
						item.selection.kind === "shipped" ? "shipped" : "personal",
						item.selection.food.id,
					);
					const quickSelection = resolveQuickSelection(item.selection);
					const quickPreview = quickSelection
						? servingPreview(
								item.selection,
								quickSelection.option,
								quickSelection.quantity,
								locale,
							)
						: undefined;
					return (
						<FoodRow
							selection={item.selection}
							caption={item.caption}
							energy={resultEnergyCaption(item.selection.food, t.nutrition)}
							locale={locale}
							quickLabel={copy.quickLog(item.selection.food.name[locale])}
							quickPortion={
								quickPreview
									? copy.quickPortion(
											quickPreview.label,
											quickEnergyAmount(quickPreview),
										)
									: undefined
							}
							quickLogging={quickLoggingKeys.has(sourceKey)}
							onPress={() => setSelectedFood(item.selection)}
							onQuickLog={() => quickLog(item.selection)}
						/>
					);
				}}
			/>
		</>
	);
}

function IconButton({
	label,
	symbol,
	onPress,
	selected = false,
}: {
	label: string;
	symbol: ComponentProps<typeof SymbolView>["name"];
	onPress: () => void;
	selected?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={[styles.iconButton, selected && styles.iconButtonSelected]}
		>
			<SymbolView name={symbol} size={19} tintColor={colors.text} />
		</Pressable>
	);
}

function FoodRow({
	selection,
	caption,
	energy,
	locale,
	quickLabel,
	quickPortion,
	quickLogging,
	onPress,
	onQuickLog,
}: {
	selection: FoodSelection;
	caption: string;
	energy: string;
	locale: "en" | "nl";
	quickLabel: string;
	quickPortion: string | undefined;
	quickLogging: boolean;
	onPress: () => void;
	onQuickLog: () => void;
}) {
	return (
		<View style={styles.foodRow}>
			<Pressable
				accessibilityRole="button"
				onPress={onPress}
				style={styles.foodOpen}
			>
				<AppText variant="heading">
					{selection.kind === "shipped" ? (selection.food.emoji ?? "•") : "◇"}
				</AppText>
				<View style={styles.flex}>
					<AppText style={styles.strong}>{selection.food.name[locale]}</AppText>
					<AppText variant="caption">{caption}</AppText>
					<AppText variant="caption">{energy}</AppText>
				</View>
			</Pressable>
			<View style={styles.quickLogControl}>
				{quickPortion ? (
					<AppText variant="caption" style={styles.quickPortion}>
						{quickPortion}
					</AppText>
				) : null}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={quickLabel}
					accessibilityState={{ busy: quickLogging, disabled: quickLogging }}
					disabled={quickLogging}
					onPress={onQuickLog}
					style={styles.quickAdd}
				>
					<SymbolView
						name={{ ios: "plus.circle.fill", android: "add", web: "add" }}
						size={18}
						tintColor={colors.onAccent}
					/>
				</Pressable>
			</View>
		</View>
	);
}

function LibraryRow({
	name,
	caption,
	detailLabel,
	onDetail,
	logLabel,
	onLog,
}: {
	name: string;
	caption: string;
	detailLabel: string;
	onDetail: () => void;
	logLabel: string;
	onLog: () => void;
}) {
	return (
		<View style={styles.foodRow}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={detailLabel}
				onPress={onDetail}
				style={styles.foodOpen}
			>
				<View style={styles.flex}>
					<AppText style={styles.strong}>{name}</AppText>
					<AppText variant="caption">{caption}</AppText>
				</View>
			</Pressable>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${logLabel} ${name}`}
				onPress={onLog}
				style={styles.quickAdd}
			>
				<AppText style={styles.quickAddText}>{logLabel}</AppText>
			</Pressable>
		</View>
	);
}

function BrowserEmptyState({
	tab,
	query,
	copy,
}: {
	tab: FoodFilter;
	query: string;
	copy: ReturnType<typeof nutritionFoodBrowserCopy>;
}) {
	if (query.trim())
		return <EmptyState title={copy.noFoodsTitle} body={copy.noFoodsBody} />;
	if (tab === "recent")
		return (
			<EmptyState title={copy.recentEmptyTitle} body={copy.recentEmptyBody} />
		);
	if (tab === "favorites")
		return (
			<EmptyState
				title={copy.favoritesEmptyTitle}
				body={copy.favoritesEmptyBody}
			/>
		);
	if (tab === "combos")
		return (
			<EmptyState title={copy.combosEmptyTitle} body={copy.combosEmptyBody} />
		);
	if (tab === "recipes")
		return (
			<EmptyState title={copy.recipesEmptyTitle} body={copy.recipesEmptyBody} />
		);
	return <EmptyState title={copy.noFoodsTitle} body={copy.noFoodsBody} />;
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
	onPendingChange,
	onEdit,
	onDelete,
	onCorrect,
}: {
	selection: FoodSelection;
	meal: MealSlot;
	date: string;
	onBack: () => void;
	onLogged: (outcome: LogOutcome, foodName: string, entry: DiaryEntry) => void;
	onPendingChange: (pending: boolean) => void;
	onEdit?: () => void;
	onDelete?: () => void;
	/** Start a correction of this shipped food. Absent for a local food. */
	onCorrect?: () => void;
}) {
	const { t, locale } = useI18n();
	const operations = useNutritionOperations();
	const toast = useToast();
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);
	const food = selection.food;
	const choices = useMemo(() => servingChoices(selection), [selection]);
	const subject = operations.getSubject();
	const sourceKey = foodSourceKey(
		selection.kind === "shipped" ? "shipped" : "personal",
		food.id,
	);
	const remembered = useMemo(
		() =>
			rememberedSelection(
				choices,
				food.baseUnit,
				subject
					? operations.getShortcut(subject, sourceKey)?.portion
					: undefined,
			),
		[choices, food.baseUnit, operations, sourceKey, subject],
	);
	const [selectedServing, setSelectedServing] = useState<ServingOption>(
		() => remembered?.option ?? choices[0],
	);
	const [quantityText, setQuantityText] = useState(() =>
		String(
			remembered?.quantity ?? (choices[0]?.kind === "base-unit" ? 100 : 1),
		),
	);
	const [favorite, setFavorite] = useState(() =>
		subject ? operations.getShortcut(subject, sourceKey)?.favorite : false,
	);
	const parsed =
		quantityText.trim() === ""
			? Number.NaN
			: Number(quantityText.replace(",", "."));
	const quantity = Number.isFinite(parsed) ? parsed : 0;
	const preview = servingPreview(selection, selectedServing, quantity, locale);
	const canLog = quantity > 0;
	/** The shipped record behind a correction — the original, still nameable. */
	const correctedSource =
		selection.kind === "personal" ? forkSource(selection.food) : undefined;

	async function logFood(outcome: LogOutcome) {
		if (!canLog || loggingRef.current) return;
		loggingRef.current = true;
		setLogging(true);
		onPendingChange(true);
		try {
			const subject = operations.getSubject();
			if (!subject) throw new Error("Not signed in.");
			const clientEntryId = mintNutritionUuid();
			const { common, provenance } = createFoodSnapshot(
				selection,
				selectedServing,
				quantity,
				date,
				meal,
				clientEntryId,
				locale,
			);
			operations.create(
				subject,
				{ ...common, provenance },
				{
					sourceKey,
					portion: portionMemoryFor(selectedServing, quantity, food.baseUnit),
				},
				(_error) => {
					loggingRef.current = false;
					setLogging(false);
					onPendingChange(false);
					toast.error(t.nutrition.foodBrowser.logFailure);
				},
				() => {
					haptics.entryLogged();
					onLogged(outcome, food.name[locale], {
						id: `client:${clientEntryId}`,
						...common,
						provenance,
					});
					loggingRef.current = false;
					setLogging(false);
					onPendingChange(false);
				},
			);
		} catch {
			loggingRef.current = false;
			setLogging(false);
			onPendingChange(false);
			toast.error(t.nutrition.foodBrowser.logFailure);
		}
	}

	return (
		<View style={styles.sheet}>
			<View
				accessible
				accessibilityLabel={t.nutrition.foodBrowser.sheetHandle}
				style={styles.sheetHandle}
			/>
			<View style={styles.sheetHeader}>
				<AppText variant="heading" style={styles.flex} numberOfLines={2}>
					{food.name[locale]}
				</AppText>
				<Pressable
					onPress={onBack}
					disabled={logging}
					hitSlop={12}
					accessibilityRole="button"
					// Its own name, not "Go back": the browser's header back is
					// still on screen behind the sheet, and two controls called
					// the same thing is two controls a screen reader cannot tell
					// apart.
					accessibilityLabel={t.nutrition.foodBrowser.closeServingLabel}
					style={styles.sheetClose}
				>
					<AppText style={styles.sheetCloseGlyph}>×</AppText>
				</Pressable>
			</View>
			<KeyboardAvoidingView
				style={styles.sheetBody}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					contentInsetAdjustmentBehavior="automatic"
					automaticallyAdjustKeyboardInsets
					keyboardDismissMode="interactive"
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
						{remembered ? (
							<AppText variant="caption">
								{t.nutrition.foodBrowser.lastUsed}
								{remembered.reset
									? ` · ${t.nutrition.foodBrowser.allFoods}`
									: ""}
							</AppText>
						) : null}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={
								favorite
									? t.nutrition.foodBrowser.removeFavorite
									: t.nutrition.foodBrowser.favorite
							}
							onPress={() => {
								if (!subject) return;
								const next = !favorite;
								operations.toggleFavorite(subject, sourceKey, next);
								setFavorite(next);
							}}
							style={styles.favoriteButton}
						>
							<AppText>{favorite ? "★" : "☆"}</AppText>
						</Pressable>
					</View>
					<AppText variant="label">{t.nutrition.foodBrowser.serving}</AppText>
					<View style={styles.options}>
						{choices.map((candidate) => (
							<Pressable
								key={candidate.kind === "authored" ? candidate.index : "base"}
								onPress={() => {
									// A meaningful selection: it changes the figures below and the
									// numbers that will be written. The list itself is silent.
									if (candidate !== selectedServing) haptics.selectionChanged();
									setSelectedServing(candidate);
									setQuantityText(candidate.kind === "base-unit" ? "100" : "1");
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
					<AppText variant="label">{t.nutrition.foodBrowser.quantity}</AppText>
					<TextInput
						value={quantityText}
						onChangeText={setQuantityText}
						accessibilityLabel={t.nutrition.foodBrowser.quantity}
						keyboardType="decimal-pad"
						style={styles.input}
					/>
					{selectedServing.kind === "authored" ? (
						<View style={styles.quantityShortcuts}>
							{[
								[t.nutrition.foodBrowser.quantityHalf, "0.5"],
								[t.nutrition.foodBrowser.quantityOne, "1"],
								[t.nutrition.foodBrowser.quantityTwo, "2"],
							].map(([label, value]) => (
								<Pressable
									key={label}
									onPress={() => setQuantityText(value)}
									accessibilityRole="button"
									style={styles.quantityShortcut}
								>
									<AppText>{label}</AppText>
								</Pressable>
							))}
						</View>
					) : null}
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
				</ScrollView>
				<SafeAreaView edges={["bottom"]} style={styles.sheetFooter}>
					<PrimaryButton
						label={
							logging
								? t.nutrition.foodBrowser.logging
								: t.nutrition.foodBrowser.addAndContinue
						}
						onPress={() => logFood("continue")}
						loading={logging}
						disabled={!canLog}
					/>
					<GhostButton
						label={t.nutrition.foodBrowser.addAndClose}
						onPress={() => logFood("close")}
						disabled={!canLog || logging}
					/>
				</SafeAreaView>
			</KeyboardAvoidingView>
		</View>
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

function createFoodSnapshot(
	selection: FoodSelection,
	selectedServing: ServingOption,
	quantity: number,
	date: string,
	meal: MealSlot,
	clientEntryId: string,
	locale: "en" | "nl",
) {
	const preview = servingPreview(selection, selectedServing, quantity, locale);
	const common = {
		date,
		meal,
		clientEntryId,
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
	const provenance: DiaryEntry["provenance"] =
		selection.kind === "shipped"
			? (() => {
					const meta = shippedLibraryMeta();
					return {
						source: "shipped" as const,
						sourceId: selection.food.id,
						dataset: meta.dataset.name,
						edition: meta.dataset.edition,
						sourceCode: selection.food.code,
						sourceName: selection.food.sourceName,
						saltDerived: true,
					};
				})()
			: {
					source: selection.food.provenance.recordOrigin,
					sourceId: selection.food.id,
					nutritionSource: selection.food.provenance.nutritionSource,
					locallyEdited: selection.food.provenance.locallyEdited,
					...(selection.food.provenance.forkedFrom
						? { forkedFrom: selection.food.provenance.forkedFrom }
						: {}),
					...(selection.food.provenance.provider
						? { provider: selection.food.provenance.provider }
						: {}),
					...(selection.food.provenance.barcode
						? { barcode: selection.food.provenance.barcode }
						: {}),
					...(selection.food.provenance.attribution
						? { attribution: selection.food.provenance.attribution }
						: {}),
				};
	return { common, provenance };
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	center: { alignItems: "center", justifyContent: "center" },
	content: { padding: 16, paddingTop: 8, paddingBottom: 40, gap: spacing.xs },
	flex: { flex: 1 },
	headerContent: { gap: spacing.sm, paddingBottom: spacing.sm },
	targetPicker: { gap: spacing.xs },
	pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	mealPicker: {
		minHeight: 48,
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
	},
	mealMenu: {
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface2,
		overflow: "hidden",
	},
	mealChoice: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	dateLabel: { color: colors.textMuted },
	feedback: { color: colors.accent, fontWeight: "700" },
	findControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	iconButton: {
		width: 48,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surface2,
	},
	iconButtonSelected: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim,
	},
	actionMenu: {
		gap: 2,
		padding: spacing.xs,
		borderRadius: radius.md,
		backgroundColor: colors.surface2,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	actionMenuItem: {
		minHeight: 44,
		justifyContent: "center",
		paddingHorizontal: spacing.md,
	},
	tabList: {
		flexDirection: "row",
		gap: spacing.md,
		paddingHorizontal: spacing.xs,
	},
	tab: {
		minHeight: 44,
		justifyContent: "center",
		borderBottomWidth: 2,
		borderBottomColor: "transparent",
	},
	tabSelected: { borderBottomColor: colors.accent },
	tabTextSelected: { color: colors.accent, fontWeight: "800" },
	onlineSearch: {
		minHeight: 36,
		alignSelf: "flex-start",
		justifyContent: "center",
	},
	onlineSearchText: { color: colors.accent, fontWeight: "700" },
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
	quantityShortcuts: { flexDirection: "row", gap: spacing.sm },
	quantityShortcut: {
		minWidth: 52,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.pill,
	},
	foodRow: {
		minHeight: 56,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.sm,
		borderBottomWidth: 1,
		borderBottomColor: colors.border,
	},
	foodOpen: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},
	quickAdd: {
		width: 44,
		height: 44,
		paddingHorizontal: spacing.sm,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
	},
	quickLogControl: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	quickPortion: { maxWidth: 104, color: colors.textMuted, textAlign: "right" },
	quickAddText: { color: colors.onAccent, fontWeight: "800", fontSize: 12 },
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
	favoriteButton: {
		minWidth: 44,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	preview: { gap: spacing.sm },
	nutrientRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	attribution: { gap: spacing.xs },
	sheet: {
		flex: 1,
		gap: spacing.sm,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.md,
		paddingTop: spacing.sm,
	},
	sheetHandle: {
		alignSelf: "center",
		width: 36,
		height: 4,
		borderRadius: radius.pill,
		backgroundColor: colors.borderStrong,
	},
	sheetBody: { flex: 1 },
	sheetHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		minHeight: 44,
	},
	sheetClose: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	sheetCloseGlyph: {
		color: colors.accent,
		fontSize: 30,
		fontWeight: "400",
		lineHeight: 32,
	},
	sheetContent: { gap: spacing.md, paddingBottom: spacing.md },
	sheetFooter: { gap: spacing.sm, paddingTop: spacing.sm },
});
