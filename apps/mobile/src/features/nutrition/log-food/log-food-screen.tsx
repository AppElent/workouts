import {
	forkShippedFood,
	NUTRIENT_KEYS,
	roundForDisplay,
	type ServingOption,
	type ShippedFood,
	type SupplementaryServing,
	shippedLibrary,
} from "@workouts/core/nutrition";
import { useConvexConnectionState } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	type TextInput,
	View,
} from "react-native";
import type { SearchBarCommands } from "react-native-screens";
import {
	formatLongDate,
	formatShortDate,
	todayIsoDate,
} from "../../../data/calendar-day";
import { useDeleteDiaryEntry } from "../../../data/delete-diary-entry";
import { useFoodAuthoringIntent } from "../../../data/food-authoring-intent";
import { foodPhotos } from "../../../data/food-photo-manager";
import { comboEnergy } from "../../../data/nutrition-combo";
import {
	type DiaryEntry,
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
	portionMemoryFor,
	rememberedSelection,
} from "../../../data/nutrition-shortcuts";
import { useOpenFoodFacts } from "../../../data/open-food-facts-context";
import type {
	PersonalFood,
	PersonalFoodDraft,
} from "../../../data/personal-food-repository";
import { foodVisualForShippedFood } from "../../../data/personal-food-repository";
import { usePersonalFoods } from "../../../data/personal-foods";
import { usePersonalMeasures } from "../../../data/personal-measures";
import { useStalledOffline } from "../../../data/stalled-offline";
import { useSupplementaryServings } from "../../../data/supplementary-servings";
import { haptics } from "../../../feedback/haptics";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../feedback/reduce-motion";
import { fmt, useI18n } from "../../../i18n";
import { BarcodeScanner } from "../../../screens/barcode-scanner";
import { PersonalFoodEditor } from "../../../screens/personal-food-editor";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { useConfirm } from "../../../ui/confirm-dialog";
import { DatePickerSheet } from "../../../ui/date-picker-sheet";
import { FoodEditorSheet } from "../../../ui/food-editor-sheet";
import { isIOS26OrLater } from "../../../ui/platform";
import type { RowAction } from "../../../ui/swipeable-row";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { comboPartFromEntry } from "../combo/combo-parts";
import { useComboTarget } from "../combo/use-combo-target";
import type { FoodRowPosition } from "../components/food-row-layout";
import { NutritionScopeChip } from "../components/nutrition-scope-chip";
import { requestDiaryDate } from "../diary/use-diary-date-request";
import { LogFoodAmountSheet } from "./components/log-food-amount-sheet";
import { LogFoodBarcodeSheet } from "./components/log-food-barcode-sheet";
import { LogFoodComboRow } from "./components/log-food-combo-row";
import { LogFoodDestinationMenu } from "./components/log-food-destination-menu";
import { LogFoodEmptyState } from "./components/log-food-empty-state";
import { LogFoodFindControls } from "./components/log-food-find-controls";
import { LogFoodMealSummary } from "./components/log-food-meal-summary";
import type { LogFoodMenuProps } from "./components/log-food-menu-props";
import { LogFoodOffSection } from "./components/log-food-off-section";
import { LogFoodRow } from "./components/log-food-row";
import { LogFoodSectionHeader } from "./components/log-food-section-header";
import { LogFoodToolbar } from "./components/log-food-toolbar";
import {
	compactEnergyPer100,
	offFailureMessage,
	quickEnergyAmount,
} from "./log-food-captions";
import { type FoodBrowserTab, logFoodCopy } from "./log-food-copy";
import {
	createFoodSnapshot,
	type FoodFilter,
	type FoodSelection,
	selectionSourceKey,
	servingChoices,
	servingPreview,
} from "./log-food-selection";
import { logFoodItemKey, useLogFoodItems } from "./use-log-food-items";
import { useOffSearch } from "./use-off-search";

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

/** How long a row's + shows ✓ after a quick log. */
const JUST_LOGGED_MS = 2000;

/** A new Personal Food with nothing filled in but the name and the barcode. */
function blankFoodDraft(name: string, barcode?: string): PersonalFoodDraft {
	return {
		name: { en: name, nl: name },
		baseUnit: "g",
		nutrients: Object.fromEntries(
			NUTRIENT_KEYS.map((key) => [key, { kind: "absent" }]),
		) as PersonalFoodDraft["nutrients"],
		servings: [],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
			...(barcode ? { barcode } : {}),
		},
	};
}

/** A correction is a new local food, never an edit of the shipped record. */
function correctionDraft(
	food: ShippedFood,
	supplementary: readonly SupplementaryServing[],
): PersonalFoodDraft {
	const original = forkShippedFood(food);
	const visual = foodVisualForShippedFood(food);
	return {
		...original,
		servings: [
			...original.servings,
			...supplementary
				.filter((item) => item.unit === food.baseUnit)
				.map((item) => ({
					label: { en: item.name, nl: item.name },
					amount: item.amount,
				})),
		],
		...(visual ? { visual } : {}),
	};
}

function energyLabel(entries: readonly DiaryEntry[]): string | undefined {
	if (!entries.length) return undefined;
	const total = entries.reduce((sum, entry) => {
		const energy = entry.nutrients.energy;
		return energy.kind === "value" ? sum + energy.amount : sum;
	}, 0);
	return `${roundForDisplay("energy", total)} kcal`;
}

/**
 * Finding and logging food into one meal on one day.
 *
 * The title is the destination ("Lunch ⌄", day below). On iOS 26 search and
 * its companion actions sit in the system bottom toolbar; elsewhere the same
 * actions are an in-content row. Local results come first; Open Food Facts is
 * its own section under them. A row's + logs at once and offers undo, and the
 * meal summary shows — and lets you fix — what is already in the meal.
 */
export function LogFoodScreen({
	meal,
	date: initialDate,
	draftId,
	initialQuery,
	initialCreateKind,
	target,
	onClose,
}: {
	meal: MealSlot;
	date: string;
	draftId?: string;
	initialQuery?: string;
	initialCreateKind?: "personal" | "recipe";
	/**
	 * Browser target mode: a picked food goes into this combo, added at the
	 * end or in the place of `replacePartId`, instead of into the diary.
	 */
	target?: { comboId: string; replacePartId?: string };
	onClose: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const copy = logFoodCopy(locale);
	const router = useRouter();
	const authoringIntent = useFoodAuthoringIntent();
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const reduceMotion = useReduceMotion();
	const personalFoods = usePersonalFoods();
	const comboTarget = useComboTarget(target?.comboId, target?.replacePartId);
	const comboCopy = t.nutrition.comboEditor;
	const personalMeasures = usePersonalMeasures();
	const openFoodFacts = useOpenFoodFacts();
	const confirm = useConfirm();
	const toast = useToast();
	const drafts = useNutritionDrafts();
	const { deleteEntry } = useDeleteDiaryEntry();
	const connected = useConvexConnectionState().isWebSocketConnected;
	const offline = useStalledOffline(true, connected);
	const bottomToolbar = isIOS26OrLater();
	const searchBarRef = useRef<SearchBarCommands>(null);
	const searchInputRef = useRef<TextInput>(null);
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
	 * lands on the pool, which already searches the whole catalogue.
	 */
	const [filter, setFilter] = useState<FoodFilter>(
		initialCreateKind === "recipe" ? "recipes" : "pool",
	);
	const [selectedMeal, setSelectedMeal] = useState<MealSlot>(meal);
	const [mealOpen, setMealOpen] = useState(false);
	const [mealFlash, setMealFlash] = useState(0);
	// Rows logged with + show ✓ briefly (design: "✓ op de rij").
	const [justLogged, setJustLogged] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const servingPendingRef = useRef(false);
	const [servingPending, setServingPending] = useState(false);
	const [selectedFood, setSelectedFood] = useState<FoodSelection>();
	const supplementary = useSupplementaryServings(
		selectedFood?.kind === "shipped" ? selectedFood.food.id : undefined,
	);
	const [editingFood, setEditingFood] = useState<PersonalFood>();
	const [forkDraft, setForkDraft] = useState<PersonalFoodDraft>();
	const [newFoodSeed, setNewFoodSeed] = useState<PersonalFoodDraft>();
	const [creatingFood, setCreatingFood] = useState(
		initialCreateKind !== undefined,
	);
	useEffect(() => {
		if (!authoringIntent.intent) return;
		setFilter(authoringIntent.intent === "recipe" ? "recipes" : "pool");
		setCreatingFood(true);
		authoringIntent.consume();
	}, [authoringIntent]);
	const [scanning, setScanning] = useState(false);
	const [barcodeStatus, setBarcodeStatus] = useState<string>();
	const [unknownBarcode, setUnknownBarcode] = useState<string>();
	const [linkingBarcode, setLinkingBarcode] = useState<string>();
	const [reviewingImport, setReviewingImport] = useState<PersonalFoodDraft>();
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
	// Resolving a Capture Draft: once something was logged for it, it is done.
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
	// The native search bar owns its text; seed it with a note being resolved.
	useEffect(() => {
		if (bottomToolbar && initialQuery)
			searchBarRef.current?.setText(initialQuery);
	}, [bottomToolbar, initialQuery]);

	// Durable shortcuts, refreshed by the operation-version subscription above
	// after a quick log or a favorite toggle.
	const recentShortcuts = subject ? operations.listRecent(subject) : [];
	const favoriteShortcuts = subject ? operations.listFavorites(subject) : [];
	const favoriteKeys = useMemo(
		() => new Set(favoriteShortcuts.map((shortcut) => shortcut.sourceKey)),
		[favoriteShortcuts],
	);
	const browsed = useLogFoodItems({
		query,
		filter,
		locale,
		personalFoods,
		recentShortcuts,
		favoriteShortcuts,
		messages: t.nutrition,
		copy,
	});
	// A combo cannot hold another combo.
	const items = comboTarget
		? browsed.filter((item) => item.kind !== "combo")
		: browsed;
	const off = useOffSearch(query, {
		client: openFoodFacts,
		online: !offline,
		isImported: (barcode) => Boolean(personalFoods.findByBarcode(barcode)),
	});
	const day = useNutritionDay(date);
	const entriesFor = (slot: MealSlot) =>
		day.status === "ready" ? day.day.entries[slot] : [];
	const mealEntries = entriesFor(selectedMeal);
	const mealName = t.nutrition.meals[selectedMeal];
	const catalogueSize = useMemo(() => shippedLibrary().active.length, []);
	const hasQuery = query.trim().length > 0;
	// Whether Open Food Facts is showing (or about to show) something for this
	// query; if not, an empty local list is a dead end that needs a way out.
	const offAnswering = ["loading", "found", "cooling"].includes(off.state.kind);

	function changeDate(next: string) {
		setDate(next);
		// The diary underneath follows, so going back shows where this went.
		requestDiaryDate(next);
	}

	function closeEditor() {
		setCreatingFood(false);
		setEditingFood(undefined);
		setForkDraft(undefined);
		setNewFoodSeed(undefined);
	}

	function showSavedFood(food: PersonalFood) {
		// Unmount the SwiftUI editor Host before exposing the serving modal. A
		// hidden Host over the picker intercepted taps after saving a new food.
		setSelectedFood({ kind: "personal", food });
	}

	function createFood(name: string, barcode?: string) {
		setNewFoodSeed(blankFoodDraft(name, barcode));
		setCreatingFood(true);
	}

	function startCorrection(food: ShippedFood) {
		setForkDraft(
			correctionDraft(
				food,
				subject ? operations.getSupplementaryServings(subject, food.id) : [],
			),
		);
		setSelectedFood(undefined);
	}

	async function deletePersonalFood(food: PersonalFood) {
		// Deleting a correction restores the shipped food to search, which is a
		// different promise from deleting a Personal Food that stands alone.
		const isCorrection = food.provenance.forkedFrom !== undefined;
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
			const removed = personalFoods.remove(food.id);
			if (removed) foodPhotos.remove(food.visual);
			setSelectedFood(undefined);
		} catch {
			toast.error(t.nutrition.personalFood.deleteFailure);
		}
	}

	async function handleBarcodeScanned(barcode: string) {
		// Local foods are checked before any network call reaches Open Food
		// Facts (spec #68) — a Personal Food carrying this barcode wins outright.
		const localMatch = personalFoods.findByBarcode(barcode);
		if (localMatch) {
			setScanning(false);
			setSelectedFood({ kind: "personal", food: localMatch });
			return;
		}
		// The lookup runs in the camera, so the screen is never empty meanwhile.
		setBarcodeStatus(t.nutrition.barcode.lookingUp);
		try {
			const outcome = await openFoodFacts.lookupBarcode(barcode);
			setScanning(false);
			if (outcome.kind === "found") {
				setReviewingImport(outcome.draft);
				return;
			}
			if (outcome.kind === "not-found") {
				setUnknownBarcode(barcode);
				return;
			}
			toast.error(
				offline
					? copy.offline
					: offFailureMessage(outcome.kind, t.nutrition.foodImport, false),
			);
		} catch {
			setScanning(false);
			toast.error(t.nutrition.foodImport.unavailable);
		} finally {
			setBarcodeStatus(undefined);
		}
	}

	/** "Zoek op naam": the barcode goes to the Personal Food picked next. */
	async function linkBarcode(food: PersonalFood, barcode: string) {
		const existing = food.provenance.barcode;
		if (existing && existing !== barcode) {
			const approved = await confirm({
				title: copy.replaceBarcodeTitle,
				message: copy.replaceBarcodeBody(food.name[locale], existing),
				confirmLabel: copy.replaceBarcodeConfirm,
				cancelLabel: copy.cancel,
			});
			if (!approved) return false;
		}
		try {
			const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = food;
			personalFoods.update(food.id, {
				...draft,
				provenance: { ...food.provenance, barcode },
			});
			setLinkingBarcode(undefined);
			toast.success(copy.barcodeLinked(food.name[locale]));
			return true;
		} catch {
			toast.error(copy.barcodeLinkFailure);
			return false;
		}
	}

	async function openFood(selection: FoodSelection) {
		if (linkingBarcode) {
			// Only a Personal Food can carry the barcode; a shipped pick is just
			// logged, and either way the linking task is over.
			if (selection.kind === "personal")
				await linkBarcode(selection.food, linkingBarcode);
			else setLinkingBarcode(undefined);
		}
		setSelectedFood(selection);
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

	function resolveQuickSelection(selection: FoodSelection) {
		const choices = servingChoices(
			selection,
			personalMeasures,
			selection.kind === "shipped" && subject
				? operations.getSupplementaryServings(subject, selection.food.id)
				: [],
		);
		const sourceKey = selectionSourceKey(selection);
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

	/** Target mode: the food at this amount goes into the combo, with undo. */
	function pickForCombo(
		selection: FoodSelection,
		serving: ServingOption,
		quantity: number,
	) {
		if (!comboTarget) return;
		const name = selection.food.name[locale];
		try {
			const { common, provenance } = createFoodSnapshot(
				selection,
				serving,
				quantity,
				date,
				selectedMeal,
				mintNutritionUuid(),
				locale,
			);
			const undo = comboTarget.write(
				comboPartFromEntry({ ...common, provenance }),
			);
			toast.success(
				fmt(comboTarget.replacing ? comboCopy.replaced : comboCopy.added, {
					name,
				}),
				{ action: { label: comboCopy.undo, onPress: undo } },
			);
		} catch {
			toast.error(t.nutrition.combos.saveFailure);
			return;
		}
		setSelectedFood(undefined);
		if (comboTarget.replacing) {
			onClose();
			return;
		}
		const sourceKey = selectionSourceKey(selection);
		setJustLogged((keys) => new Set(keys).add(sourceKey));
		setTimeout(
			() =>
				setJustLogged((keys) => {
					const next = new Set(keys);
					next.delete(sourceKey);
					return next;
				}),
			JUST_LOGGED_MS,
		);
	}

	function quickLog(selection: FoodSelection) {
		if (comboTarget) {
			const quick = resolveQuickSelection(selection);
			if (quick) pickForCombo(selection, quick.option, quick.quantity);
			return;
		}
		const sourceKey = selectionSourceKey(selection);
		if (!subject || quickLoggingRef.current.has(sourceKey)) return;
		const quickSelection = resolveQuickSelection(selection);
		if (!quickSelection) return;
		const { option: selectedServing, quantity } = quickSelection;
		const release = () => {
			quickLoggingRef.current.delete(sourceKey);
			setQuickLoggingKeys((keys) => {
				const next = new Set(keys);
				next.delete(sourceKey);
				return next;
			});
		};
		quickLoggingRef.current.add(sourceKey);
		setQuickLoggingKeys((keys) => new Set(keys).add(sourceKey));
		const foodName = selection.food.name[locale];
		const loggedMeal = t.nutrition.meals[selectedMeal];
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
					release();
					toast.error(t.nutrition.foodBrowser.logFailure);
				},
				() => {
					release();
					haptics.entryLogged();
					setMealFlash((key) => key + 1);
					setJustLogged((keys) => new Set(keys).add(sourceKey));
					setTimeout(
						() =>
							setJustLogged((keys) => {
								const next = new Set(keys);
								next.delete(sourceKey);
								return next;
							}),
						JUST_LOGGED_MS,
					);
					toast.success(copy.logged(foodName, loggedMeal), {
						action: {
							label: copy.undo,
							onPress: () =>
								operations.remove(
									subject,
									{ kind: "clientEntryId", id: clientEntryId },
									undefined,
									() => toast.error(copy.undoFailure),
								),
						},
					});
				},
			);
		} catch {
			release();
			toast.error(t.nutrition.foodBrowser.logFailure);
		}
	}

	function rowActions(
		selection: FoodSelection,
		quickPreview: string | undefined,
	): RowAction[] {
		const sourceKey = selectionSourceKey(selection);
		const isFavorite = favoriteKeys.has(sourceKey);
		// Menu order follows the design: log, other portion, favorite, then the
		// food's own edits. Only Favorite is offered on swipe.
		return [
			...(quickPreview
				? [
						{
							key: "log",
							systemImage: "plus" as const,
							label: copy.logPortion(quickPreview),
							onPress: () => quickLog(selection),
							swipe: false,
						},
					]
				: []),
			{
				key: "portion",
				systemImage: "pencil",
				label: copy.otherPortion,
				onPress: () => void openFood(selection),
				swipe: false,
				dividerAfter: true,
			},
			{
				key: "favorite",
				systemImage: isFavorite ? "star.fill" : "star",
				label: isFavorite ? copy.unfavorite : copy.favorite,
				dividerAfter: true,
				onPress: () => {
					if (subject)
						operations.toggleFavorite(subject, sourceKey, !isFavorite);
				},
			},
			...(selection.kind === "shipped"
				? [
						{
							key: "correct",
							systemImage: "square.and.pencil" as const,
							label: copy.correct,
							onPress: () => startCorrection(selection.food),
							swipe: false,
						},
					]
				: [
						{
							key: "edit",
							systemImage: "square.and.pencil" as const,
							label: copy.edit,
							onPress: () => setEditingFood(selection.food),
							swipe: false,
						},
						{
							key: "delete",
							systemImage: "trash" as const,
							label: copy.delete,
							destructive: true,
							onPress: () => void deletePersonalFood(selection.food),
							swipe: false,
						},
					]),
		];
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
					onCancel={() => {
						setScanning(false);
						setBarcodeStatus(undefined);
					}}
					status={barcodeStatus}
				/>
			</Modal>
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
				seed={forkDraft ?? newFoodSeed}
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

	const servingSheet =
		selectedFood && !editor ? (
			<LogFoodAmountSheet
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
					// The meal summary's count and kcal moving is the feedback.
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
								setForkDraft(
									correctionDraft(selectedFood.food, supplementary.servings),
								);
								setSelectedFood(undefined);
							}
						: undefined
				}
				onDelete={
					selectedFood.kind === "personal"
						? () => void deletePersonalFood(selectedFood.food)
						: undefined
				}
				pick={
					comboTarget
						? {
								title: comboTarget.combo.name,
								confirmLabel: comboTarget.replacing
									? comboCopy.confirm
									: comboCopy.add,
								onPick: (serving, quantity) =>
									pickForCombo(selectedFood, serving, quantity),
							}
						: undefined
				}
			/>
		) : null;

	const menu: LogFoodMenuProps = {
		label: copy.moreActions,
		closeLabel: copy.closeMenu,
		logOnceLabel: copy.logOnce,
		newFoodLabel: copy.newPersonalFood,
		newRecipeLabel: copy.newRecipe,
		saveAsNoteLabel: t.nutrition.drafts.saveAsNote,
		canSaveAsNote: !draftId && hasQuery,
		onLogOnce: () =>
			router.push({
				pathname: "/nutrition-cooking",
				params: { date, meal: selectedMeal, mode: "oneoff-log" },
			}),
		onNewFood: () => setCreatingFood(true),
		onNewRecipe: () => {
			setFilter("recipes");
			setCreatingFood(true);
		},
		onSaveAsNote: saveAsNote,
	};
	const describe = () =>
		router.push({
			pathname: "/nutrition-assistance",
			params: { date, meal: selectedMeal },
		});
	const dayLabel =
		date === today
			? `${copy.today} · ${formatShortDate(date, locale)}`
			: formatShortDate(date, locale);
	const listHeading = hasQuery
		? {
				title: copy.results,
				detail: items.length ? String(items.length) : undefined,
			}
		: filter === "pool"
			? { title: copy.forMeal(mealName), detail: copy.forMealHint }
			: undefined;

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
					changeDate(next);
					setShowCalendar(false);
				}}
				onClose={() => setShowCalendar(false)}
			/>
			{comboTarget ? (
				<Stack.Screen
					options={{
						title: fmt(
							comboTarget.replacing
								? comboCopy.replaceTitle
								: comboCopy.addTitle,
							{ name: comboTarget.combo.name },
						),
						headerTitle: undefined,
						headerRight: () => (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={comboCopy.done}
								onPress={onClose}
								style={styles.headerButton}
							>
								<SymbolView
									name={{ ios: "checkmark", android: "check", web: "check" }}
									size={20}
									tintColor={colors.accentInk}
								/>
							</Pressable>
						),
					}}
				/>
			) : (
				<Stack.Screen
					options={{
						title: mealName,
						headerTitle: () => (
							<LogFoodDestinationMenu
								label={copy.destinationLabel(
									mealName,
									formatLongDate(date, locale),
								)}
								mealName={mealName}
								dayLabel={dayLabel}
								sectionTitle={copy.logInto}
								closeLabel={copy.closeMenu}
								otherDayLabel={copy.otherDay}
								options={MEAL_SLOTS.map((slot) => {
									const entries = entriesFor(slot);
									return {
										slot,
										selected: slot === selectedMeal,
										label: t.nutrition.meals[slot],
										detail: entries.length
											? copy.mealTally(entries.length, energyLabel(entries))
											: copy.mealNothing,
									};
								})}
								onSelectMeal={setSelectedMeal}
								onOtherDay={() => setShowCalendar(true)}
							/>
						),
						// The calendar stays the one direct route to the day.
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
			)}
			{bottomToolbar ? (
				<LogFoodToolbar
					searchRef={searchBarRef}
					placeholder={copy.search}
					scanLabel={copy.scanBarcode}
					describeLabel={copy.aiSearch}
					menu={comboTarget ? undefined : menu}
					onChangeQuery={setQuery}
					onSubmit={off.commit}
					onScan={() => setScanning(true)}
					onDescribe={comboTarget ? undefined : describe}
				/>
			) : null}
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
			<LogFoodBarcodeSheet
				barcode={unknownBarcode}
				copy={copy}
				closeLabel={copy.closeMenu}
				onClose={() => setUnknownBarcode(undefined)}
				onCreate={() => {
					const barcode = unknownBarcode;
					setUnknownBarcode(undefined);
					createFood("", barcode);
				}}
				onSearchByName={() => {
					setLinkingBarcode(unknownBarcode);
					setUnknownBarcode(undefined);
					if (bottomToolbar) searchBarRef.current?.focus();
					else searchInputRef.current?.focus();
				}}
				onRescan={() => {
					setUnknownBarcode(undefined);
					setScanning(true);
				}}
			/>
			<FlatList
				data={items}
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				keyboardDismissMode="interactive"
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.content}
				keyExtractor={logFoodItemKey}
				ListHeaderComponent={
					<View style={styles.headerContent}>
						{bottomToolbar ? null : (
							<LogFoodFindControls
								inputRef={searchInputRef}
								query={query}
								placeholder={copy.search}
								scanLabel={copy.scanBarcode}
								describeLabel={copy.aiSearch}
								menu={comboTarget ? undefined : menu}
								onChangeQuery={setQuery}
								onSubmit={off.commit}
								onScan={() => setScanning(true)}
								onDescribe={comboTarget ? undefined : describe}
							/>
						)}
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.chipList}
						>
							{SCOPE_CHIPS.map(({ scope, copyKey }) => (
								<NutritionScopeChip
									key={scope}
									label={copy[copyKey]}
									selected={filter === scope}
									onPress={() => setFilter(scope)}
								/>
							))}
						</ScrollView>
						{comboTarget ? null : (
							<LogFoodMealSummary
								label={copy.mealSummary(
									mealName,
									mealEntries.length,
									energyLabel(mealEntries),
								)}
								expandLabel={mealOpen ? copy.collapseMeal : copy.expandMeal}
								hint={copy.mealHint}
								open={mealOpen}
								entries={mealEntries}
								flashKey={mealFlash}
								locale={locale}
								editLabel={t.nutrition.entryActions.edit}
								deleteLabel={t.nutrition.entryActions.delete}
								onToggle={() => setMealOpen((open) => !open)}
								onOpenEntry={(entry) =>
									router.push({
										pathname: "/nutrition-entry",
										params: { id: entry.id, date, meal: selectedMeal },
									})
								}
								onDeleteEntry={(entry) =>
									void deleteEntry({ entry, meal: selectedMeal, date })
								}
							/>
						)}
						{linkingBarcode ? (
							<View style={styles.linking} accessibilityLiveRegion="polite">
								<AppText variant="caption" style={styles.flex}>
									{copy.barcodeLinking(linkingBarcode)}
								</AppText>
								<Pressable
									accessibilityRole="button"
									onPress={() => setLinkingBarcode(undefined)}
									style={styles.linkingStop}
								>
									<AppText style={styles.accent}>
										{copy.barcodeLinkingStop}
									</AppText>
								</Pressable>
							</View>
						) : null}
						{items.length && listHeading ? (
							<LogFoodSectionHeader
								title={listHeading.title}
								detail={listHeading.detail}
							/>
						) : null}
						{!items.length && hasQuery && offAnswering ? (
							<AppText variant="caption" style={styles.localNone}>
								{copy.localNone(query.trim())}
							</AppText>
						) : null}
					</View>
				}
				ListEmptyComponent={
					hasQuery && offAnswering ? null : (
						<LogFoodEmptyState
							tab={filter}
							query={query}
							copy={copy}
							offPending={off.state.kind === "waiting"}
							onSearchOnline={off.commit}
							onCreateFood={(name) => createFood(name)}
						/>
					)
				}
				ListFooterComponent={
					<View>
						{/* With no local results the empty card already offers the
						    search, so the section's own manual row would repeat it. */}
						{hasQuery && (items.length > 0 || off.state.kind !== "waiting") ? (
							<LogFoodOffSection
								state={off.state}
								query={query}
								copy={copy}
								messages={t.nutrition}
								locale={locale}
								offline={offline}
								onCommit={off.commit}
								onReview={setReviewingImport}
								onScan={() => setScanning(true)}
							/>
						) : null}
						<AppText variant="caption" style={styles.poolNote}>
							{copy.poolNote(catalogueSize.toLocaleString(locale))}
						</AppText>
					</View>
				}
				renderItem={({ item, index }) => {
					const position: FoodRowPosition =
						items.length === 1
							? "only"
							: index === 0
								? "first"
								: index === items.length - 1
									? "last"
									: "middle";
					if (item.kind === "combo") {
						const energy = comboEnergy(item.combo);
						const openCombo = () =>
							router.push({
								pathname: "/nutrition-combo-log",
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
								position={position}
								detailLabel={copy.comboDetail(item.combo.name)}
								onDetail={openCombo}
								logLabel={copy.log}
								onLog={openCombo}
							/>
						);
					}
					const sourceKey = selectionSourceKey(item.selection);
					const quickSelection = resolveQuickSelection(item.selection);
					const quickPreview = quickSelection
						? servingPreview(
								item.selection,
								quickSelection.option,
								quickSelection.quantity,
								locale,
							)
						: undefined;
					const quickKcal = quickPreview
						? quickEnergyAmount(quickPreview)
						: undefined;
					// With a query the caption adds the per-100 figure, so search
					// results can be compared; the pool keeps just why it is there.
					const caption = hasQuery
						? `${item.caption} · ${compactEnergyPer100(item.selection.food, copy.servingWord)}`
						: item.caption;
					return (
						<LogFoodRow
							selection={item.selection}
							caption={caption}
							locale={locale}
							position={position}
							quickLabel={copy.quickLog(item.selection.food.name[locale])}
							quickValue={quickKcal ? `${quickKcal} kcal` : undefined}
							quickPortion={quickPreview?.label}
							quickLogging={quickLoggingKeys.has(sourceKey)}
							justLogged={justLogged.has(sourceKey)}
							actions={rowActions(
								item.selection,
								quickPreview
									? quickKcal
										? `${quickPreview.label}, ${quickKcal} kcal`
										: quickPreview.label
									: undefined,
							)}
							closeMenuLabel={copy.closeMenu}
							onPress={() => void openFood(item.selection)}
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
		content: { paddingTop: 10, paddingBottom: 40 },
		flex: { flex: 1 },
		headerContent: { gap: 12, paddingBottom: spacing.xs },
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
		linking: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			marginHorizontal: spacing.md,
			paddingLeft: spacing.md,
			borderRadius: radius.lg,
			backgroundColor: colors.accentDim,
		},
		linkingStop: {
			minHeight: 44,
			justifyContent: "center",
			paddingHorizontal: spacing.md,
		},
		accent: { color: colors.accentInk, fontWeight: "600" },
		localNone: { paddingHorizontal: spacing.md },
		// Design `.sec-f`, centred under the list.
		poolNote: {
			marginHorizontal: 20,
			marginTop: 10,
			paddingBottom: 14,
			textAlign: "center",
		},
	});
