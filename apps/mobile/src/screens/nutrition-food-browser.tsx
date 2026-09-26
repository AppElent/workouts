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
	personalFoodServingOptions,
	personalFoodSnapshot,
	previewServing,
	roundForDisplay,
	SALT_DERIVATION_DISCLOSURE,
	type ServingOption,
	type ShippedFood,
	servingOptions,
	shippedLibrary,
	shippedSourceMeta,
	withPersonalMeasures,
} from "@workouts/core/nutrition";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
	type ComponentProps,
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
import {
	formatLongDate,
	formatShortDate,
	todayIsoDate,
} from "../data/calendar-day";
import { useFoodAuthoringIntent } from "../data/food-authoring-intent";
import { foodPhotos } from "../data/food-photo-manager";
import {
	type DiaryEntry,
	MEAL_SLOTS,
	type MealSlot,
	useNutritionDay,
} from "../data/nutrition-day";
import {
	intakeLoggedSince,
	useNutritionDrafts,
} from "../data/nutrition-drafts";
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
import { foodVisualForShippedFood } from "../data/personal-food-repository";
import { usePersonalFoods } from "../data/personal-foods";
import {
	usePersonalMeasureActions,
	usePersonalMeasures,
} from "../data/personal-measures";
import { haptics } from "../feedback/haptics";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { fmt, type Messages, useI18n } from "../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { GhostButton, PrimaryButton } from "../ui/button";
import { Card } from "../ui/coach";
import { useConfirm } from "../ui/confirm-dialog";
import { DatePickerSheet } from "../ui/date-picker-sheet";
import { EmptyState } from "../ui/empty-state";
import { FoodEditorSheet } from "../ui/food-editor-sheet";
import { FoodVisualView } from "../ui/food-visual";
import {
	DisclosureRow,
	FormSection,
	FormSegmentedRow,
	InlineNumberFieldRow,
} from "../ui/form";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { BarcodeScanner } from "./barcode-scanner";
import {
	type FoodBrowserTab,
	nutritionFoodBrowserCopy,
} from "./nutrition-food-browser-copy";
import { FoodBrowserMenu } from "./nutrition-food-browser-menu";
import { PersonalFoodEditor } from "./personal-food-editor";

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

/**
 * A Combo's own kcal, summed from the snapshots it was saved with.
 *
 * A part's `nutrients` are already the figures for the amount that part logs —
 * the same values the diary prints per entry — so this sums them rather than
 * rescaling by `quantity`.
 */
function comboEnergy(combo: Combo): number | undefined {
	let total = 0;
	let known = false;
	for (const part of combo.parts) {
		const energy = part.snapshot.nutrients.energy;
		if (energy.kind !== "value") continue;
		known = true;
		total += energy.amount;
	}
	return known ? roundForDisplay("energy", total) : undefined;
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
	food: {
		nutrients: Record<NutrientKey, NutrientValue>;
		baseUnit: "g" | "ml" | "serving";
	},
	messages: Messages["nutrition"],
	locale: "en" | "nl",
): string {
	const energy = food.nutrients.energy;
	const unit = food.baseUnit;
	if (unit === "serving") {
		const amount =
			energy.kind === "value"
				? `${roundForDisplay("energy", energy.amount)} kcal`
				: energy.kind === "trace"
					? "~0 kcal"
					: "— kcal";
		return `${amount} / ${locale === "nl" ? "portie" : "serving"}`;
	}
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

function offProductCaption(
	provenance: PersonalFood["provenance"],
	fallback: string,
): string {
	const details = [
		provenance.brand,
		provenance.quantity,
		provenance.providerServing?.label,
	].filter(Boolean);
	return details.length ? [fallback, ...details].join(" · ") : fallback;
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
					selectedFood.kind === "shipped"
						? () => {
								// A correction is a new local food, never an edit of the
								// shipped record — so this seeds the authoring screen
								// rather than opening the shipped row for editing.
								const draft = forkShippedFood(selectedFood.food);
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
		const choices = servingChoices(selection, personalMeasures);
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
								<Chip
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
							<FoodBrowserMenu
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
								<Chip
									key={scope}
									label={copy[copyKey]}
									selected={filter === scope}
									role="tab"
									onPress={() => setFilter(scope)}
								/>
							))}
						</ScrollView>
						<MealSummary
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
						<BrowserEmptyState tab={filter} query={query} copy={copy} />
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
							<LibraryRow
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
									<MediaSlot
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
						<FoodRow
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

/** One 40pt square control in the search row. */
function IconButton({
	label,
	symbol,
	onPress,
	accented = false,
}: {
	label: string;
	symbol: ComponentProps<typeof SymbolView>["name"];
	onPress: () => void;
	accented?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={[styles.iconButton, accented && styles.iconButtonAccented]}
		>
			<SymbolView
				name={symbol}
				size={accented ? 18 : 19}
				tintColor={accented ? colors.accentInk : colors.text}
			/>
		</Pressable>
	);
}

/**
 * A meal chip, and a scope chip at `size="small"`.
 *
 * Meals are a radio set — exactly one is the target you are logging into —
 * while scopes read as tabs over one list, which is why the role differs.
 */
function Chip({
	label,
	selected,
	onPress,
	role,
	size = "small",
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	role: "radio" | "tab";
	size?: "small" | "large";
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole={role}
			accessibilityState={
				role === "radio" ? { checked: selected } : { selected }
			}
			onPress={onPress}
			style={[
				size === "large" ? styles.chipLarge : styles.chip,
				selected && styles.chipSelected,
			]}
		>
			<AppText
				style={[
					size === "large" ? styles.chipLargeText : styles.chipText,
					selected && styles.chipTextSelected,
				]}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

/**
 * The 44pt slot every row leads with.
 *
 * Drawn even when a food has no photo and no preset, because the alternative —
 * what the screen used to do — was three different leading indents and titles
 * that never lined up.
 */
function MediaSlot({
	symbol,
	tinted = false,
}: {
	symbol: ComponentProps<typeof SymbolView>["name"];
	tinted?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.mediaSlot}>
			<SymbolView
				name={symbol}
				size={20}
				tintColor={tinted ? colors.accentInk : colors.textFaint}
			/>
		</View>
	);
}

/**
 * The meal's running total, and what is in it.
 *
 * This is the only confirmation a quick log gets: there is no transient "added
 * to Ontbijt" line any more, so the count and kcal moving here — announced,
 * because it is a polite live region — is the feedback.
 */
function MealSummary({
	label,
	expandLabel,
	emptyLabel,
	open,
	entries,
	locale,
	onToggle,
}: {
	label: string;
	expandLabel: string;
	emptyLabel: string;
	open: boolean;
	entries: readonly DiaryEntry[];
	locale: "en" | "nl";
	onToggle: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.mealSummary}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={expandLabel}
				accessibilityState={{ expanded: open }}
				onPress={onToggle}
				style={styles.mealSummaryHeader}
			>
				<AppText
					accessibilityLiveRegion="polite"
					style={[styles.flex, styles.mealSummaryLabel]}
				>
					{label}
				</AppText>
				<SymbolView
					name={
						open
							? {
									ios: "chevron.up",
									android: "expand_less",
									web: "expand_less",
								}
							: {
									ios: "chevron.down",
									android: "expand_more",
									web: "expand_more",
								}
					}
					size={15}
					tintColor={colors.accentInk}
				/>
			</Pressable>
			{open ? (
				<View style={styles.mealSummaryBody}>
					{entries.length === 0 ? (
						<AppText variant="caption">{emptyLabel}</AppText>
					) : (
						entries.map((entry) => (
							<View key={entry.id} style={styles.mealSummaryEntry}>
								<AppText variant="caption" style={styles.flex}>
									{entry.name[locale]} · {entry.serving[locale]}
								</AppText>
								<AppText variant="caption" style={styles.tabular}>
									{entry.nutrients.energy.kind === "value"
										? `${roundForDisplay("energy", entry.nutrients.energy.amount)} kcal`
										: entry.nutrients.energy.kind === "trace"
											? "~0 kcal"
											: "— kcal"}
								</AppText>
							</View>
						))
					)}
				</View>
			) : null}
		</View>
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
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const legacyImageUrl =
		selection.kind === "personal" &&
		selection.food.visualMigrationPending &&
		!selection.food.visual
			? selection.food.provenance.imageUrl
			: undefined;
	return (
		<View style={styles.foodRow}>
			<Pressable
				accessibilityRole="button"
				onPress={onPress}
				style={styles.foodOpen}
			>
				{legacyImageUrl ? (
					<Image
						source={legacyImageUrl}
						accessibilityLabel={selection.food.name[locale]}
						cachePolicy="memory-disk"
						contentFit="contain"
						style={styles.foodImage}
					/>
				) : selection.kind === "personal" ? (
					<FoodVisualView
						visual={selection.food.visual}
						label={selection.food.name[locale]}
						size={MEDIA_SLOT}
					/>
				) : (
					<MediaSlot
						symbol={{
							ios: "fork.knife",
							android: "restaurant",
							web: "restaurant",
						}}
					/>
				)}
				<View style={styles.flex}>
					{/*
					 * Two lines, not one: NEVO names run long in Dutch
					 * ("Aardappel(product) naturel voorgekookt koelvers") and a hard
					 * one-line clamp hides the part that distinguishes them. Two is
					 * enough for almost all of them and still bounds the row.
					 */}
					<AppText numberOfLines={2} style={styles.rowTitle}>
						{selection.food.name[locale]}
					</AppText>
					<AppText variant="caption">
						{selection.kind === "personal"
							? offProductCaption(selection.food.provenance, caption)
							: caption}
					</AppText>
					<AppText variant="caption" style={styles.rowFaint}>
						{energy}
					</AppText>
				</View>
			</Pressable>
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
					name={{ ios: "plus", android: "add", web: "add" }}
					size={18}
					tintColor={colors.onAccent}
				/>
			</Pressable>
		</View>
	);
}

/** A Combo, on the same grid as a food: media slot, three lines, round +. */
function LibraryRow({
	name,
	caption,
	energy,
	portion,
	detailLabel,
	onDetail,
	logLabel,
	onLog,
}: {
	name: string;
	caption: string;
	energy?: string;
	portion?: string;
	detailLabel: string;
	onDetail: () => void;
	logLabel: string;
	onLog: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.foodRow}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={detailLabel}
				onPress={onDetail}
				style={styles.foodOpen}
			>
				<MediaSlot
					symbol={{
						ios: "square.stack.3d.up",
						android: "layers",
						web: "layers",
					}}
				/>
				<View style={styles.flex}>
					<AppText numberOfLines={2} style={styles.rowTitle}>
						{name}
					</AppText>
					<AppText variant="caption">{caption}</AppText>
					{energy ? (
						<AppText variant="caption" style={styles.rowFaint}>
							{energy}
						</AppText>
					) : null}
				</View>
			</Pressable>
			{portion ? (
				<AppText variant="caption" style={styles.quickPortion}>
					{portion}
				</AppText>
			) : null}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${logLabel} ${name}`}
				onPress={onLog}
				style={styles.quickAdd}
			>
				<SymbolView
					name={{ ios: "plus", android: "add", web: "add" }}
					size={18}
					tintColor={colors.onAccent}
				/>
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
		return (
			<EmptyState
				title={copy.noFoodsTitle}
				body={copy.noFoodsBody}
				appearance="search"
			/>
		);
	if (tab === "pool")
		return <EmptyState title={copy.poolEmptyTitle} body={copy.poolEmptyBody} />;
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
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const router = useRouter();
	const operations = useNutritionOperations();
	const personalMeasures = usePersonalMeasures();
	const measureActions = usePersonalMeasureActions();
	const toast = useToast();
	const [logging, setLogging] = useState(false);
	const loggingRef = useRef(false);
	const food = selection.food;
	const choices = useMemo(
		() => servingChoices(selection, personalMeasures),
		[personalMeasures, selection],
	);
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
	const defaultServing =
		remembered?.option ??
		choices.find((choice) => choice.kind !== "personal-measure") ??
		choices[0];
	const [selectedServing, setSelectedServing] =
		useState<ServingOption>(defaultServing);
	const [quantityText, setQuantityText] = useState(() =>
		String(
			remembered?.quantity ??
				(defaultServing?.kind === "base-unit" &&
				defaultServing.unit !== "serving"
					? 100
					: 1),
		),
	);
	const [favorite, setFavorite] = useState(() =>
		subject ? operations.getShortcut(subject, sourceKey)?.favorite : false,
	);
	useEffect(() => {
		if (!measureActions.lastCreatedId) return;
		const created = choices.find(
			(option) =>
				option.kind === "personal-measure" &&
				option.id === measureActions.lastCreatedId,
		);
		if (created) {
			setSelectedServing(created);
			setQuantityText("1");
			measureActions.consumeCreated();
		}
	}, [choices, measureActions]);
	const parsed =
		quantityText.trim() === ""
			? Number.NaN
			: Number(quantityText.replace(",", "."));
	const quantity = Number.isFinite(parsed) ? parsed : 0;
	const preview = servingPreview(
		selection,
		selectedServing,
		quantity > 0 ? quantity : 1,
		locale,
	);
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
						{selection.kind === "personal" &&
						selection.food.visualMigrationPending &&
						!selection.food.visual &&
						selection.food.provenance.imageUrl ? (
							<Image
								source={selection.food.provenance.imageUrl}
								accessibilityLabel={food.name[locale]}
								cachePolicy="memory-disk"
								contentFit="contain"
								style={styles.detailImage}
							/>
						) : selection.kind === "personal" ? (
							<FoodVisualView
								visual={selection.food.visual}
								label={food.name[locale]}
								size={112}
							/>
						) : (
							<AppText variant="display">{selection.food.emoji ?? "🍽️"}</AppText>
						)}
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
							<SymbolView
								name={{
									ios: favorite ? "star.fill" : "star",
									android: favorite ? "star" : "star_border",
									web: favorite ? "star" : "star_border",
								}}
								tintColor={colors.accent}
								size={24}
							/>
						</Pressable>
					</View>
					<FormSection title={t.nutrition.foodBrowser.serving}>
						<FormSegmentedRow
							options={choices.map((candidate, index) => ({
								value: String(index),
								label: candidate.label[locale],
							}))}
							value={String(choices.indexOf(selectedServing))}
							onChange={(value) => {
								const candidate = choices[Number(value)];
								if (!candidate) return;
								if (candidate !== selectedServing) haptics.selectionChanged();
								setSelectedServing(candidate);
								setQuantityText(
									candidate.kind === "base-unit" && candidate.unit !== "serving"
										? "100"
										: "1",
								);
							}}
						/>
						<InlineNumberFieldRow
							label={t.nutrition.foodBrowser.quantity}
							suffix=""
							value={quantityText}
							onChangeText={setQuantityText}
							keyboardType="decimal-pad"
						/>
						<DisclosureRow
							label={t.nutrition.personalMeasures.manage}
							onPress={() =>
								router.push({
									pathname: "/personal-measures",
									params: { returnTo: "picker", baseUnit: food.baseUnit },
								})
							}
						/>
					</FormSection>
					{selectedServing.kind !== "base-unit" ? (
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
					{canLog ? (
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
					) : null}
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

function servingChoices(
	selection: FoodSelection,
	personalMeasures: readonly import("@workouts/core/nutrition").PersonalMeasure[],
): ServingOption[] {
	const foodOptions =
		selection.kind === "shipped"
			? servingOptions(selection.food)
			: personalFoodServingOptions(selection.food);
	return withPersonalMeasures(
		foodOptions,
		selection.food.baseUnit,
		personalMeasures,
	);
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
	const snapshot = personalFoodSnapshot(selection.food, {
		quantity,
		serving: option,
	});
	return {
		amount: snapshot.amount,
		baseUnit: snapshot.baseUnit,
		label: snapshot.serving[locale],
		nutrients: snapshot.nutrients,
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
	if (selection.kind === "personal") {
		const { provenance, ...snapshot } = personalFoodSnapshot(selection.food, {
			quantity,
			serving: selectedServing,
			date,
			meal,
		});
		return {
			common: {
				...snapshot,
				clientEntryId,
				...(selectedServing.kind === "personal-measure"
					? { personalMeasureId: selectedServing.id }
					: {}),
			},
			provenance,
		};
	}
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
		...(selectedServing.kind === "personal-measure"
			? { personalMeasureId: selectedServing.id }
			: {}),
		nutrients: Object.fromEntries(
			NUTRIENT_KEYS.map((key) => [key, preview.nutrients[key]]),
		) as Pick<ShippedFood["nutrients"], (typeof NUTRIENT_KEYS)[number]>,
	};
	const source = shippedSourceMeta(selection.food);
	const provenance: DiaryEntry["provenance"] = {
		source: "shipped",
		sourceId: selection.food.id,
		dataset: source.name,
		edition: source.edition,
		sourceCode: selection.food.code,
		sourceName: selection.food.sourceName,
		saltDerived: source.saltDerived,
	};
	return { common, provenance };
}

/**
 * Every row leads with a slot this wide, drawn whether or not the food has a
 * picture, so titles line up at one indent instead of three.
 */
const MEDIA_SLOT = 44;

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		center: { alignItems: "center", justifyContent: "center" },
		content: { paddingTop: 10, paddingBottom: 40, gap: 12 },
		flex: { flex: 1 },
		tabular: { fontVariant: ["tabular-nums"] },
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
		chip: {
			minHeight: 32,
			justifyContent: "center",
			paddingHorizontal: 12,
			borderRadius: radius.pill,
			backgroundColor: colors.surface2,
		},
		chipLarge: {
			minHeight: 36,
			justifyContent: "center",
			paddingHorizontal: 14,
			borderRadius: radius.pill,
			backgroundColor: colors.surface2,
		},
		chipSelected: { backgroundColor: colors.accentFill },
		chipText: { fontSize: 13, color: colors.text },
		chipLargeText: { fontSize: 15, color: colors.text },
		chipTextSelected: { color: colors.onAccent, fontWeight: "700" },
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
		iconButton: {
			width: 40,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		iconButtonAccented: {
			backgroundColor: colors.accentDim,
			borderWidth: 1,
			borderColor: colors.accent,
		},
		mealSummary: {
			marginHorizontal: spacing.md,
			borderRadius: radius.card,
			borderWidth: 1,
			borderColor: colors.accent,
			backgroundColor: colors.accentDim,
			overflow: "hidden",
		},
		mealSummaryHeader: {
			minHeight: 48,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: 14,
			paddingVertical: spacing.sm,
		},
		mealSummaryLabel: { fontWeight: "700" },
		mealSummaryBody: {
			gap: 6,
			paddingHorizontal: 14,
			paddingBottom: 10,
		},
		mealSummaryEntry: { flexDirection: "row", gap: 10 },
		heading: { gap: spacing.xs, paddingHorizontal: spacing.md },
		poolNote: {
			gap: spacing.xs,
			paddingHorizontal: spacing.md,
			paddingVertical: 14,
		},
		onlineSearchText: { color: colors.accentInk, fontWeight: "600" },
		onlineSearchIdle: { color: colors.textFaint, fontWeight: "600" },
		strong: { fontWeight: "700" },
		rowTitle: { fontWeight: "600", letterSpacing: -0.2 },
		rowFaint: { color: colors.textFaint },
		input: {
			flex: 1,
			minWidth: 0,
			minHeight: 40,
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
			minHeight: 64,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: spacing.md,
			paddingVertical: 10,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.separator,
		},
		foodOpen: {
			flex: 1,
			minWidth: 0,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
		},
		mediaSlot: {
			width: MEDIA_SLOT,
			height: MEDIA_SLOT,
			flexGrow: 0,
			flexShrink: 0,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		foodImage: {
			width: MEDIA_SLOT,
			height: MEDIA_SLOT,
			flexGrow: 0,
			flexShrink: 0,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		detailImage: {
			width: 112,
			height: 112,
			borderRadius: radius.lg,
			backgroundColor: colors.surface2,
		},
		quickAdd: {
			width: 44,
			height: 44,
			flexGrow: 0,
			flexShrink: 0,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
		},
		quickPortion: {
			maxWidth: 104,
			color: colors.textMuted,
			textAlign: "right",
			fontVariant: ["tabular-nums"],
		},
		options: { gap: spacing.md },
		favoriteButton: {
			alignSelf: "flex-end",
			minWidth: 44,
			minHeight: 44,
			alignItems: "center",
			justifyContent: "center",
		},
		preview: { gap: spacing.sm },
		nutrientRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
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
