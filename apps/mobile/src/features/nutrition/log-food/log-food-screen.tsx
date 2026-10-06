import {
	type FoodResult,
	foodResults,
	forkShippedFood,
	getShippedFood,
	roundForDisplay,
	shippedLibrary,
} from "@workouts/core/nutrition";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import {
	formatLongDate,
	formatShortDate,
	todayIsoDate,
} from "../../../data/calendar-day";
import { useFoodAuthoringIntent } from "../../../data/food-authoring-intent";
import { foodPhotos } from "../../../data/food-photo-manager";
import {
	MEAL_SLOTS,
	type MealSlot,
	useNutritionDay,
} from "../../../data/nutrition-day";
import {
	intakeLoggedSince,
	useNutritionDrafts,
} from "../../../data/nutrition-drafts";
import {
	mintNutritionUuid,
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../../../data/nutrition-operation-service";
import {
	foodSourceKey,
	portionMemoryFor,
	rememberedSelection,
} from "../../../data/nutrition-shortcuts";
import { useOpenFoodFacts } from "../../../data/open-food-facts-context";
import type {
	Combo,
	PersonalFood,
	PersonalFoodDraft,
} from "../../../data/personal-food-repository";
import { foodVisualForShippedFood } from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { usePersonalMeasures } from "../../../data/personal-measures";
import { useSupplementaryServings } from "../../../data/supplementary-servings";
import { haptics } from "../../../feedback/haptics";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../feedback/reduce-motion";
import { useI18n } from "../../../i18n";
import { BarcodeScanner } from "../../../screens/barcode-scanner";
import { PersonalFoodEditor } from "../../../screens/personal-food-editor";
import {
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { DatePickerSheet } from "../../../ui/date-picker-sheet";
import { FoodEditorSheet } from "../../../ui/food-editor-sheet";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { LogFoodChip, LogFoodIconButton } from "./components/log-food-controls";
import { LogFoodEmptyState } from "./components/log-food-empty-state";
import { LogFoodMealSummary } from "./components/log-food-meal-summary";
import { LogFoodMenu } from "./components/log-food-menu";
import {
	LogFoodComboRow,
	LogFoodMediaSlot,
	LogFoodRow,
	MEDIA_SLOT,
} from "./components/log-food-rows";
import { LogFoodServingSheet } from "./components/log-food-serving-sheet";
import {
	comboEnergy,
	offFailureMessage,
	offProductCaption,
	quickEnergyAmount,
	resultCaption,
	resultEnergyCaption,
} from "./log-food-captions";
import { type FoodBrowserTab, nutritionFoodBrowserCopy } from "./log-food-copy";
import {
	createFoodSnapshot,
	type FoodFilter,
	type FoodSelection,
	servingChoices,
	servingPreview,
} from "./log-food-selection";

/**
 * The shipped side is capped, not paged: the list is virtualized, and the cap
 * exists only so an empty-query browse of the broader view has an end.
 */
const CATALOGUE_LIMIT = 2328;

/** Scope chips, in the order they are offered. `pool` leads because it is the default. */
const SCOPE_CHIPS = [
	{ scope: "pool", copyKey: "pool" },
	{ scope: "recent", copyKey: "recent" },
	{ scope: "favorites", copyKey: "favorites" },
	{ scope: "combos", copyKey: "combos" },
	{ scope: "recipes", copyKey: "recipes" },
	{ scope: "all", copyKey: "allFoods" },
] as const satisfies readonly {
	readonly scope: FoodBrowserTab;
	readonly copyKey:
		| "pool"
		| "recent"
		| "favorites"
		| "combos"
		| "recipes"
		| "allFoods";
}[];

type BrowserItem =
	| {
			readonly kind: "food";
			readonly selection: FoodSelection;
			readonly caption: string;
	  }
	| { readonly kind: "combo"; readonly combo: Combo }
	| {
			readonly kind: "online";
			readonly draft: PersonalFoodDraft;
			readonly id: number;
	  };

function asSelection(result: FoodResult<PersonalFood>): FoodSelection {
	return result.kind === "local"
		? { kind: "personal", food: result.food }
		: { kind: "shipped", food: result.food };
}

/** The identity a row keeps across the tiers it can appear in. */
function browserItemKey(item: BrowserItem): string {
	return item.kind === "food"
		? `food:${item.selection.kind}:${item.selection.food.id}`
		: item.kind === "combo"
			? `combo:${item.combo.id}`
			: `online:${item.id}`;
}

/**
 * First occurrence wins.
 *
 * The pooled list is built tier by tier, so a food that is both recent and a
 * favorite — or recent and a search hit — arrives more than once. Keeping the
 * first keeps the tier order meaningful: what you logged yesterday stays above
 * the catalogue rather than being pulled down to where the catalogue found it.
 */
function dedupeItems(items: readonly BrowserItem[]): BrowserItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = browserItemKey(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** Resolves durable shortcut keys back to the foods they point at. */
function useShortcutSelections(
	shortcuts: readonly { readonly sourceKey: string }[],
	personalFoods: ReturnType<typeof usePersonalFoods>,
): FoodSelection[] {
	return useMemo(
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
}

export function LogFoodScreen({
	meal,
	date: initialDate,
	draftId,
	initialQuery,
	initialCreateKind,
	onClose,
}: {
	meal: MealSlot;
	date: string;
	draftId?: string;
	initialQuery?: string;
	initialCreateKind?: "personal" | "recipe";
	onClose: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const copy = nutritionFoodBrowserCopy(locale);
	const router = useRouter();
	const authoringIntent = useFoodAuthoringIntent();
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const reduceMotion = useReduceMotion();
	const personalFoods = usePersonalFoods();
	const personalMeasures = usePersonalMeasures();
	const openFoodFacts = useOpenFoodFacts();
	const confirm = useConfirm();
	const toast = useToast();
	const drafts = useNutritionDrafts();
	const [query, setQuery] = useState(initialQuery ?? "");
	const [savingNote, setSavingNote] = useState(false);
	// Read once per mount: a browser whose "Vandaag" target moves under the
	// person because midnight passed mid-session is worse than one that is
	// right again on the next visit.
	const [today] = useState(todayIsoDate);
	const [date, setDate] = useState(initialDate);
	const [showCalendar, setShowCalendar] = useState(false);
	/*
	 * Arriving to author a recipe scopes the list to recipes; everything else
	 * lands on the pool. A typed query no longer needs its own case — the pool
	 * already searches the whole catalogue, which is what "all" used to be for.
	 */
	const [filter, setFilter] = useState<FoodFilter>(
		initialCreateKind === "recipe" ? "recipes" : "pool",
	);
	const [selectedMeal, setSelectedMeal] = useState<MealSlot>(meal);
	const [mealOpen, setMealOpen] = useState(false);
	const servingPendingRef = useRef(false);
	const [servingPending, setServingPending] = useState(false);
	const [selectedFood, setSelectedFood] = useState<FoodSelection>();
	const supplementary = useSupplementaryServings(
		selectedFood?.kind === "shipped" ? selectedFood.food.id : undefined,
	);
	const [editingFood, setEditingFood] = useState<PersonalFood>();
	const [forkDraft, setForkDraft] = useState<PersonalFoodDraft>();
	const [creatingFood, setCreatingFood] = useState(
		initialCreateKind !== undefined,
	);
	useEffect(() => {
		if (!authoringIntent.intent) return;
		// "all" here meant "search everything", which is the pool's job now;
		// the chip called `all` became the deliberate broader catalogue view.
		setFilter(authoringIntent.intent === "recipe" ? "recipes" : "pool");
		setCreatingFood(true);
		authoringIntent.consume();
	}, [authoringIntent]);
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
	const sessionStartedAt = useRef(Date.now());
	const resolveRef = useRef({
		draftId,
		drafts,
		operations,
		toast,
		removeFailure: t.nutrition.drafts.deleteFailure,
	});
	resolveRef.current = {
		draftId,
		drafts,
		operations,
		toast,
		removeFailure: t.nutrition.drafts.deleteFailure,
	};
	useEffect(
		() => () => {
			const current = resolveRef.current;
			if (!current.draftId) return;
			const draft = current.drafts.get(current.draftId);
			const account = current.operations.getSubject();
			if (
				!draft ||
				!account ||
				!intakeLoggedSince(
					current.operations.getOperations(account),
					draft,
					sessionStartedAt.current,
				)
			)
				return;
			try {
				if (!current.drafts.remove(draft.id))
					current.toast.error(current.removeFailure);
			} catch {
				current.toast.error(current.removeFailure);
			}
		},
		[],
	);
	/**
	 * Ranking and shadowing both live in core (#75). All this screen decides is
	 * which tier the person asked for; which of their corrections stands in
	 * front of which shipped record is not a rendering question.
	 */
	/**
	 * `promoted` is a curated everyday subset, not "the ordinary ranking" — which
	 * is exactly why a food you own could be invisible on the wrong tab. Both the
	 * pool and the broader view therefore search `all`; what separates them is
	 * that only the broader view keeps shipped records someone has corrected.
	 */
	const broaderView = filter === "all";
	const allResults = useMemo(
		() =>
			foodResults<PersonalFood>({
				query,
				locale,
				scope: "all",
				localMatches: personalFoods.search(query, locale),
				localFoods: personalFoods.forks(),
				limit: CATALOGUE_LIMIT,
			}),
		[locale, personalFoods, query],
	);
	// The operation-version subscription above deliberately refreshes these
	// durable shortcuts after a quick log or a favorite toggle. Both tiers are
	// read on every render now rather than whichever the tab asked for: the
	// default view pools them, so "which one do I need" is no longer a question
	// the chip answers.
	const recentShortcuts = subject ? operations.listRecent(subject) : [];
	const favoriteShortcuts = subject ? operations.listFavorites(subject) : [];
	const recentSelections = useShortcutSelections(
		recentShortcuts,
		personalFoods,
	);
	const favoriteSelections = useShortcutSelections(
		favoriteShortcuts,
		personalFoods,
	);
	const combos = personalFoods.listCombos();
	const recipes = personalFoods.search(query, locale, {
		classification: "recipe",
	});
	/**
	 * What the list shows.
	 *
	 * `pool` is the default and the point of the redesign: one list holding
	 * recents, favorites, Combos, recipes and ordinary search at once, so a food
	 * you own can never be invisible because you are standing on the wrong chip.
	 * The other chips narrow that same pool rather than querying a different
	 * place, except `all` — which stays the deliberate broader view (#75), the
	 * one place a shipped record someone has corrected is still listed.
	 */
	const visibleItems = useMemo<readonly BrowserItem[]>(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase();
		const matches = (name: string) =>
			!normalizedQuery || name.toLocaleLowerCase().includes(normalizedQuery);
		const shortcutItems = (
			selections: readonly FoodSelection[],
			caption: string,
		) =>
			selections
				.filter((selection) => matches(selection.food.name[locale]))
				.map((selection) => ({
					kind: "food" as const,
					selection,
					caption,
				}));
		const recentItems = shortcutItems(
			recentSelections,
			t.nutrition.foodBrowser.lastUsed,
		);
		const favoriteItems = shortcutItems(favoriteSelections, copy.favorites);
		const comboItems = combos
			.filter((combo) => matches(combo.name))
			.map((combo) => ({ kind: "combo" as const, combo }));
		const recipeItems = recipes.map((food) => ({
			kind: "food" as const,
			selection: { kind: "personal" as const, food },
			caption: copy.recipes,
		}));
		const searchItems = allResults
			// The pool is ordinary search: a shipped record whose correction is
			// already in the list would be a duplicate of it. The broader view is
			// the one place that keeps both and says which corrected which.
			.filter(
				(result) =>
					broaderView || result.kind === "local" || !result.shadowedBy,
			)
			// An empty query in the pool is not a browse request: it shows what you
			// already keep — recents, favorites, Combos, recipes — rather than the
			// whole catalogue in alphabetical order. That browse is the broader
			// view's job, and it still does it.
			.filter(
				(result) =>
					broaderView || normalizedQuery.length > 0 || result.kind === "local",
			)
			.map((result) => ({
				kind: "food" as const,
				selection: asSelection(result),
				caption: resultCaption(result, t.nutrition, locale),
			}));
		const foods =
			filter === "recent"
				? recentItems
				: filter === "favorites"
					? favoriteItems
					: filter === "combos"
						? comboItems
						: filter === "recipes"
							? recipeItems
							: broaderView
								? searchItems
								: dedupeItems([
										...recentItems,
										...favoriteItems,
										...comboItems,
										...recipeItems,
										...searchItems,
									]);
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
		broaderView,
		combos,
		copy.favorites,
		copy.recipes,
		favoriteSelections,
		filter,
		locale,
		onlineResults,
		query,
		recentSelections,
		recipes,
		t.nutrition,
	]);
	// The meal bar is the confirmation: it is what moves when a row is logged.
	const day = useNutritionDay(date);
	const mealEntries =
		day.status === "ready" ? day.day.entries[selectedMeal] : [];
	const mealEnergy = mealEntries.reduce((total, entry) => {
		const energy = entry.nutrients.energy;
		return energy.kind === "value" ? total + energy.amount : total;
	}, 0);
	const mealEnergyLabel = mealEntries.length
		? `${roundForDisplay("energy", mealEnergy)} kcal`
		: undefined;
	const catalogueSize = useMemo(() => shippedLibrary().active.length, []);

	function closeEditor() {
		setCreatingFood(false);
		setEditingFood(undefined);
		setForkDraft(undefined);
	}

	function showSavedFood(food: PersonalFood) {
		// Unmount the SwiftUI editor Host before exposing the serving modal. A
		// hidden Host over the picker intercepted taps after saving a new food.
		setSelectedFood({ kind: "personal", food });
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
		try {
			const outcome = await openFoodFacts.lookupBarcode(barcode);
			if (outcome.kind === "found") {
				setReviewingImport(outcome.draft);
				return;
			}
			toast.error(
				offFailureMessage(outcome.kind, t.nutrition.foodImport, false),
			);
		} catch {
			toast.error(t.nutrition.foodImport.unavailable);
		} finally {
			setLookingUpBarcode(false);
		}
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
					attribution: reviewingImport.provenance.attribution,
				}}
				onCancel={() => setReviewingImport(undefined)}
				onSaved={(food) => {
					setReviewingImport(undefined);
					showSavedFood(food);
				}}
			/>
		);
	}

	if (creatingFood || editingFood || forkDraft) {
		editor = (
			<PersonalFoodEditor
				food={editingFood}
				seed={forkDraft}
				defaultClassification={filter === "recipes" ? "recipe" : "ordinary"}
				onCreateKindChange={(kind) => {
					if (kind !== "oneOff") return;
					closeEditor();
					router.push({
						pathname: "/nutrition-cooking",
						params: { date, meal: selectedMeal, mode: "oneoff-log" },
					});
				}}
				onCancel={closeEditor}
				onSaved={(food) => {
					closeEditor();
					showSavedFood(food);
				}}
			/>
		);
	}

	function saveAsNote() {
		if (savingNote) return;
		setSavingNote(true);
		try {
			drafts.create({ date, meal: selectedMeal, note: query });
			onClose();
		} catch {
			toast.error(t.nutrition.drafts.saveFailure);
			setSavingNote(false);
		}
	}

	const servingSheet =
		selectedFood && !editor ? (
			<LogFoodServingSheet
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
				onLogged={(outcome) => {
					if (outcome === "close") {
						onClose();
						return;
					}
					// No in-screen confirmation line: the meal bar's count and kcal
					// moving is the feedback, and it is a polite live region so it is
					// announced too.
					setSelectedFood(undefined);
				}}
				onEdit={
					selectedFood.kind === "personal"
						? () => setEditingFood(selectedFood.food)
						: undefined
				}
				onCorrect={
					selectedFood.kind === "shipped" && !supplementary.loading
						? () => {
								// A correction is a new local food, never an edit of the
								// shipped record — so this seeds the authoring screen
								// rather than opening the shipped row for editing.
								const original = forkShippedFood(selectedFood.food);
								const draft = {
									...original,
									servings: [
										...original.servings,
										...supplementary.servings
											.filter(
												(item) => item.unit === selectedFood.food.baseUnit,
											)
											.map((item) => ({
												label: { en: item.name, nl: item.name },
												amount: item.amount,
											})),
									],
								};
								const visual = foodVisualForShippedFood(selectedFood.food);
								setForkDraft({
									...draft,
									...(visual ? { visual } : {}),
								});
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
									const removed = personalFoods.remove(selectedFood.food.id);
									if (removed) foodPhotos.remove(selectedFood.food.visual);
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
		const choices = servingChoices(
			selection,
			personalMeasures,
			selection.kind === "shipped" && subject
				? operations.getSupplementaryServings(subject, selection.food.id)
				: [],
		);
		const sourceKey = foodSourceKey(
			selection.kind === "shipped" ? "shipped" : "personal",
			selection.food.id,
		);
		const remembered = rememberedSelection(
			choices,
			selection.food.baseUnit,
			subject ? operations.getShortcut(subject, sourceKey)?.portion : undefined,
		);
		const option =
			remembered?.option ??
			choices.find((choice) => choice.kind !== "personal-measure");
		const quantity =
			remembered?.quantity ??
			(option?.kind === "base-unit" && option.unit !== "serving" ? 100 : 1);
		return option && quantity > 0 ? { option, quantity } : undefined;
	}

	return (
		<>
			<DatePickerSheet
				visible={showCalendar}
				date={date}
				today={today}
				locale={locale}
				title={copy.chooseDate}
				todayLabel={copy.today}
				doneLabel={copy.doneChoosingDate}
				closeLabel={copy.closeMenu}
				onSelect={(next) => {
					setDate(next);
					setShowCalendar(false);
				}}
				onClose={() => setShowCalendar(false)}
			/>
			{/*
			 * The date is the title, and tapping it opens the system picker.
			 * There is no "Klaar" to confirm — every row commits its own log and
			 * the stack's back chevron closes the browser — so the corner freed
			 * up carries the same picker as a visible affordance.
			 */}
			<Stack.Screen
				options={{
					title: formatShortDate(date, locale),
					headerTitle: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.chooseDate}
							accessibilityValue={{ text: formatLongDate(date, locale) }}
							accessibilityState={{ expanded: showCalendar }}
							onPress={() => setShowCalendar(true)}
							style={styles.headerTitle}
						>
							<AppText style={styles.headerTitleText}>
								{formatShortDate(date, locale)}
							</AppText>
						</Pressable>
					),
					/*
					 * The corner opens the picker rather than holding "Vandaag".
					 * "Vandaag" is disabled exactly when you are already on today —
					 * which is most of the time — so in the corner it reads as a
					 * control that does nothing. It lives inside the picker now,
					 * next to the date it resets.
					 */
					headerRight: () => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={copy.chooseDate}
							accessibilityValue={{ text: formatLongDate(date, locale) }}
							onPress={() => setShowCalendar(true)}
							style={styles.headerButton}
						>
							<SymbolView
								name={{
									ios: "calendar",
									android: "calendar_month",
									web: "calendar_month",
								}}
								size={20}
								tintColor={colors.accentInk}
							/>
						</Pressable>
					),
				}}
			/>
			{editor ? (
				<FoodEditorSheet
					visible
					onClose={() => {
						setReviewingImport(undefined);
						closeEditor();
					}}
				>
					{editor}
				</FoodEditorSheet>
			) : null}
			<Modal
				visible={Boolean(servingSheet)}
				presentationStyle="formSheet"
				animationType={modalAnimation(reduceMotion, "slide")}
				allowSwipeDismissal={!servingPending}
				onRequestClose={() => {
					if (servingPendingRef.current) return;
					setSelectedFood(undefined);
				}}
			>
				{servingSheet}
			</Modal>
			<FlatList
				data={visibleItems}
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.content}
				keyExtractor={browserItemKey}
				ListHeaderComponent={
					<View style={styles.headerContent}>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.chipList}
						>
							{MEAL_SLOTS.map((slot) => (
								<LogFoodChip
									key={slot}
									label={t.nutrition.meals[slot]}
									selected={selectedMeal === slot}
									size="large"
									role="radio"
									onPress={() => setSelectedMeal(slot)}
								/>
							))}
						</ScrollView>
						<View style={styles.findControls}>
							<View style={styles.searchField}>
								<SymbolView
									name={{
										ios: "magnifyingglass",
										android: "search",
										web: "search",
									}}
									size={16}
									tintColor={colors.textFaint}
								/>
								<TextInput
									value={query}
									onChangeText={(value) => {
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
							</View>
							<LogFoodIconButton
								label={copy.scanBarcode}
								symbol={{
									ios: "barcode.viewfinder",
									android: "barcode_scanner",
									web: "barcode",
								}}
								onPress={() => setScanning(true)}
							/>
							<LogFoodIconButton
								label={copy.aiSearch}
								symbol={{
									ios: "sparkles",
									android: "auto_awesome",
									web: "auto_awesome",
								}}
								accented
								onPress={() =>
									router.push({
										pathname: "/nutrition-assistance",
										params: { date, meal: selectedMeal },
									})
								}
							/>
							<LogFoodMenu
								label={copy.moreActions}
								closeLabel={copy.closeMenu}
								logOnceLabel={copy.logOnce}
								newFoodLabel={copy.newPersonalFood}
								newRecipeLabel={copy.newRecipe}
								saveAsNoteLabel={t.nutrition.drafts.saveAsNote}
								canSaveAsNote={!draftId && query.trim().length > 0}
								onLogOnce={() =>
									router.push({
										pathname: "/nutrition-cooking",
										params: { date, meal: selectedMeal, mode: "oneoff-log" },
									})
								}
								onNewFood={() => setCreatingFood(true)}
								onNewRecipe={() => {
									setFilter("recipes");
									setCreatingFood(true);
								}}
								onSaveAsNote={saveAsNote}
							/>
						</View>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.chipList}
						>
							{SCOPE_CHIPS.map(({ scope, copyKey }) => (
								<LogFoodChip
									key={scope}
									label={copy[copyKey]}
									selected={filter === scope}
									role="tab"
									onPress={() => setFilter(scope)}
								/>
							))}
						</ScrollView>
						<LogFoodMealSummary
							label={copy.mealSummary(
								t.nutrition.meals[selectedMeal],
								mealEntries.length,
								mealEnergyLabel,
							)}
							expandLabel={mealOpen ? copy.collapseMeal : copy.expandMeal}
							emptyLabel={copy.mealEmpty}
							open={mealOpen}
							entries={mealEntries}
							locale={locale}
							onToggle={() => setMealOpen((open) => !open)}
						/>
						{query.trim().length > 0 && onlineFeedback ? (
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
				ListFooterComponent={
					<View style={styles.poolNote}>
						<AppText variant="caption">
							{copy.poolNote(catalogueSize.toLocaleString(locale))}
						</AppText>
						{/*
						 * Open Food Facts is a network call on someone else's service,
						 * so it stays an explicit act and only appears once there is
						 * something to search for.
						 */}
						{query.trim().length > 0 ? (
							<AppText
								variant="caption"
								accessibilityRole="button"
								disabled={onlineSearching}
								onPress={onlineSearching ? undefined : runOnlineSearch}
								style={styles.onlineSearchText}
							>
								{onlineSearching ? copy.searchingOnline : copy.searchOnline}
							</AppText>
						) : null}
					</View>
				}
				ListEmptyComponent={
					onlineFeedback || onlineSearching ? null : (
						<LogFoodEmptyState tab={filter} query={query} copy={copy} />
					)
				}
				renderItem={({ item }) => {
					if (item.kind === "combo") {
						const energy = comboEnergy(item.combo);
						const openCombo = () =>
							router.push({
								pathname: "/nutrition-combos",
								params: {
									date,
									meal: selectedMeal,
									comboId: item.combo.id,
								},
							});
						return (
							<LogFoodComboRow
								name={item.combo.name}
								caption={copy.comboParts(item.combo.parts.length)}
								energy={energy === undefined ? undefined : `${energy} kcal`}
								portion={copy.wholeCombo}
								detailLabel={copy.comboDetail(item.combo.name)}
								onDetail={openCombo}
								logLabel={copy.log}
								onLog={openCombo}
							/>
						);
					}
					if (item.kind === "online")
						return (
							<Pressable
								onPress={() => setReviewingImport(item.draft)}
								accessibilityRole="button"
								style={styles.foodRow}
							>
								{item.draft.provenance.imageUrl ? (
									<Image
										source={item.draft.provenance.imageUrl}
										accessibilityLabel={item.draft.name[locale]}
										cachePolicy="memory-disk"
										contentFit="contain"
										style={styles.foodImage}
									/>
								) : (
									<LogFoodMediaSlot
										symbol={{
											ios: "globe",
											android: "public",
											web: "public",
										}}
									/>
								)}
								<View style={styles.flex}>
									<AppText numberOfLines={2} style={styles.rowTitle}>
										{item.draft.name[locale]}
									</AppText>
									<AppText variant="caption">
										{offProductCaption(
											item.draft.provenance,
											`${copy.onlineResults} · ${item.draft.provenance.provider}`,
										)}
									</AppText>
									<AppText variant="caption">
										{resultEnergyCaption(item.draft, t.nutrition, locale)}
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
						<LogFoodRow
							selection={item.selection}
							caption={item.caption}
							energy={resultEnergyCaption(
								item.selection.food,
								t.nutrition,
								locale,
							)}
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

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		center: { alignItems: "center", justifyContent: "center" },
		content: { paddingTop: 10, paddingBottom: 40, gap: 12 },
		flex: { flex: 1 },
		headerContent: { gap: 12, paddingBottom: spacing.sm },
		headerTitle: {
			minHeight: 44,
			justifyContent: "center",
			paddingHorizontal: spacing.sm,
		},
		headerTitleText: { fontWeight: "700", color: colors.text },
		headerButton: {
			minHeight: 44,
			justifyContent: "center",
			paddingHorizontal: spacing.sm,
		},
		chipList: {
			flexDirection: "row",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
		},
		findControls: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
		},
		searchField: {
			flex: 1,
			minWidth: 0,
			minHeight: 40,
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			paddingHorizontal: 10,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		heading: { gap: spacing.xs, paddingHorizontal: spacing.md },
		poolNote: {
			gap: spacing.xs,
			paddingHorizontal: spacing.md,
			paddingVertical: 14,
		},
		onlineSearchText: { color: colors.accentInk, fontWeight: "600" },
		rowTitle: { fontWeight: "600", letterSpacing: -0.2 },
		input: {
			flex: 1,
			minWidth: 0,
			minHeight: 40,
			color: colors.text,
			fontSize: type.secondary.fontSize,
		},
		foodRow: {
			minHeight: 64,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: spacing.md,
			paddingVertical: 10,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		foodImage: {
			width: MEDIA_SLOT,
			height: MEDIA_SLOT,
			flexGrow: 0,
			flexShrink: 0,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
	});
