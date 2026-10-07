/**
 * Copy for the log food screen.
 *
 * `FoodBrowserTab` keeps its name for the source scopes, but the screen does
 * not present them as exclusive tabs: `pool` is the default and searches every
 * source at once, and the rest narrow what is already in front of you. `all`
 * stays the deliberate broader view (spec #75) — the only place a corrected
 * shipped record is still listed — shown as "Catalogus".
 */
export type FoodBrowserTab =
	| "pool"
	| "recent"
	| "favorites"
	| "combos"
	| "recipes"
	| "all";

type LogFoodCopy = {
	readonly search: string;
	readonly scanBarcode: string;
	readonly aiSearch: string;
	readonly moreActions: string;
	readonly closeMenu: string;
	readonly logOnce: string;
	readonly newPersonalFood: string;
	readonly today: string;
	readonly chooseDate: string;
	readonly doneChoosingDate: string;
	readonly pool: string;
	readonly recent: string;
	readonly favorites: string;
	readonly combos: string;
	readonly recipes: string;
	readonly newRecipe: string;
	readonly allFoods: string;
	readonly mealSummary: (
		meal: string,
		count: number,
		energy: string | undefined,
	) => string;
	readonly mealTally: (count: number, energy: string | undefined) => string;
	readonly mealNothing: string;
	readonly expandMeal: string;
	readonly collapseMeal: string;
	readonly mealEmpty: string;
	readonly mealHint: string;
	readonly forMeal: (meal: string) => string;
	readonly forMealHint: string;
	readonly results: string;
	readonly sourceShipped: string;
	readonly sourceOwn: string;
	readonly favoriteTag: string;
	readonly recipeTag: string;
	readonly servingWord: string;
	readonly logInto: string;
	readonly otherDay: string;
	readonly destinationLabel: (meal: string, day: string) => string;
	readonly logged: (food: string, meal: string) => string;
	readonly undo: string;
	readonly undoFailure: string;
	readonly favorite: string;
	readonly unfavorite: string;
	readonly logPortion: (portion: string) => string;
	readonly otherPortion: string;
	readonly correct: string;
	readonly edit: string;
	readonly delete: string;
	readonly poolNote: (count: string) => string;
	readonly poolEmptyTitle: string;
	readonly poolEmptyBody: string;
	readonly recentEmptyTitle: string;
	readonly recentEmptyBody: string;
	readonly favoritesEmptyTitle: string;
	readonly favoritesEmptyBody: string;
	readonly combosEmptyTitle: string;
	readonly combosEmptyBody: string;
	readonly recipesEmptyTitle: string;
	readonly recipesEmptyBody: string;
	readonly noFoodsTitle: string;
	readonly noFoodsBody: string;
	readonly noResultsTitle: (query: string) => string;
	readonly noResultsBody: string;
	readonly newFoodNamed: (query: string) => string;
	readonly localNone: (query: string) => string;
	readonly quickLog: (food: string) => string;
	readonly quickPortion: (
		portion: string,
		energy: string | undefined,
	) => string;
	readonly details: string;
	readonly log: string;
	readonly wholeCombo: string;
	readonly comboParts: (count: number) => string;
	readonly comboDetail: (combo: string) => string;
	readonly onlineResults: string;
	readonly searchOnline: string;
	readonly searchOnlineQuery: (query: string) => string;
	readonly searchOnlineHint: string;
	readonly searchingOnline: string;
	readonly offCount: (count: number) => string;
	readonly offReviewHint: string;
	readonly offImportHint: string;
	readonly offShowAll: (count: number) => string;
	readonly offNone: (query: string) => string;
	readonly offCooling: (seconds: number) => string;
	readonly scanInstead: string;
	readonly offline: string;
	readonly barcodeNotFound: string;
	readonly barcodeNotFoundBody: string;
	readonly barcodeNewFoodHint: string;
	readonly barcodeSearchByName: string;
	readonly barcodeSearchByNameHint: string;
	readonly barcodeRescan: string;
	readonly barcodeLinking: (barcode: string) => string;
	readonly barcodeLinkingStop: string;
	readonly barcodeLinked: (food: string) => string;
	readonly barcodeLinkFailure: string;
	readonly replaceBarcodeTitle: string;
	readonly replaceBarcodeBody: (food: string, barcode: string) => string;
	readonly replaceBarcodeConfirm: string;
	readonly cancel: string;
};

const copy: Record<"en" | "nl", LogFoodCopy> = {
	en: {
		search: "Search foods",
		scanBarcode: "Scan barcode",
		aiSearch: "Describe a meal",
		moreActions: "More food actions",
		closeMenu: "Close",
		logOnce: "Log once",
		newPersonalFood: "New Personal Food",
		today: "Today",
		chooseDate: "Choose date",
		doneChoosingDate: "Done",
		pool: "All",
		recent: "Recent",
		favorites: "Favorites",
		combos: "Combos",
		recipes: "Recipes",
		newRecipe: "New recipe",
		allFoods: "Catalogue",
		mealSummary: (meal, count, energy) => {
			const items = count === 1 ? "1 item" : `${count} items`;
			return energy ? `${meal} · ${items} · ${energy}` : `${meal} · ${items}`;
		},
		mealTally: (count, energy) => {
			const items = count === 1 ? "1 item" : `${count} items`;
			return energy ? `${items} · ${energy}` : items;
		},
		mealNothing: "nothing yet",
		expandMeal: "Show what is logged",
		collapseMeal: "Hide what is logged",
		mealEmpty: "Nothing logged yet",
		mealHint: "Tap an item to adjust it; swipe to delete.",
		forMeal: (meal) => `For your ${meal.toLocaleLowerCase("en")}`,
		forMealHint: "recent · favorites · combos",
		results: "Results",
		sourceShipped: "NEVO",
		sourceOwn: "Own",
		favoriteTag: "Favorite",
		recipeTag: "Recipe · own",
		servingWord: "serving",
		logInto: "Log into",
		otherDay: "Another day…",
		destinationLabel: (meal, day) => `Logging into ${meal}, ${day}`,
		logged: (food, meal) => `Added ${food} to ${meal}`,
		undo: "Undo",
		undoFailure: "Couldn't undo. Remove it from the meal instead.",
		favorite: "Favorite",
		unfavorite: "Remove favorite",
		logPortion: (portion) => `Log · ${portion}`,
		otherPortion: "Other portion…",
		correct: "Correct…",
		edit: "Edit…",
		delete: "Delete",
		poolNote: (count) =>
			`Searches ${count} NEVO items, your own foods and Open Food Facts.`,
		poolEmptyTitle: "Find food to log",
		poolEmptyBody:
			"Search, scan a barcode or describe what you ate. What you log shows up here for this meal.",
		recentEmptyTitle: "Nothing logged recently",
		recentEmptyBody:
			"Foods you log from this browser will appear here for quick logging.",
		favoritesEmptyTitle: "No favorite foods yet",
		favoritesEmptyBody: "Swipe a food to add it to your favorites.",
		combosEmptyTitle: "No saved Combos",
		combosEmptyBody: "Save foods from a meal as a Combo, then log it here.",
		recipesEmptyTitle: "No saved recipes",
		recipesEmptyBody: "Save a Personal Food as a Recipe to find it here.",
		noFoodsTitle: "No matches",
		noFoodsBody:
			"Try a different name, scan a barcode, or add a Personal Food.",
		noResultsTitle: (query) => `No results for ‘${query}’`,
		noResultsBody: "Search online, scan the package or create it yourself.",
		newFoodNamed: (query) => `New Personal Food ‘${query}’`,
		localNone: (query) => `Nothing in your own foods or NEVO for ‘${query}’.`,
		quickLog: (food) => `Quick log ${food}`,
		quickPortion: (portion, energy) =>
			energy ? `${portion} · ${energy} kcal` : portion,
		details: "Details",
		log: "Log",
		wholeCombo: "Whole Combo",
		comboParts: (count) =>
			count === 1 ? "Combo · 1 food" : `Combo · ${count} foods`,
		comboDetail: (combo) => `Open Combo ${combo}`,
		onlineResults: "Open Food Facts",
		searchOnline: "Search Open Food Facts",
		searchOnlineQuery: (query) => `Search ‘${query}’ in Open Food Facts`,
		searchOnlineHint: "Branded products, with photo and label",
		searchingOnline: "searching…",
		offCount: (count) => (count === 1 ? "1 result" : `${count} results`),
		offReviewHint: "check after importing",
		offImportHint:
			"Tap to check and save it; after that it is one of your own foods, also offline.",
		offShowAll: (count) => `Show all ${count}`,
		offNone: (query) => `Nothing in Open Food Facts for ‘${query}’.`,
		offCooling: (seconds) =>
			`Open Food Facts needs a moment. We'll search again automatically in ${seconds} s.`,
		scanInstead: "Scan the barcode instead",
		offline:
			"Offline. Your own foods and NEVO still work; Open Food Facts and unknown barcodes wait until you're back online. Logged items sync later.",
		barcodeNotFound: "Barcode not found",
		barcodeNotFoundBody: "Not in your own foods and not in Open Food Facts.",
		barcodeNewFoodHint:
			"The barcode is filled in; the next scan finds it straight away",
		barcodeSearchByName: "Search by name",
		barcodeSearchByNameHint: "Link the barcode to the food you choose",
		barcodeRescan: "Scan again",
		barcodeLinking: (barcode) =>
			`Choose one of your own foods for barcode ${barcode}`,
		barcodeLinkingStop: "Stop",
		barcodeLinked: (food) => `Barcode linked to ${food}`,
		barcodeLinkFailure: "Couldn't link the barcode.",
		replaceBarcodeTitle: "Replace barcode?",
		replaceBarcodeBody: (food, barcode) =>
			`${food} already has barcode ${barcode}.`,
		replaceBarcodeConfirm: "Replace",
		cancel: "Cancel",
	},
	nl: {
		search: "Zoek eten",
		scanBarcode: "Barcode scannen",
		aiSearch: "Beschrijf een maaltijd",
		moreActions: "Meer eetacties",
		closeMenu: "Sluiten",
		logOnce: "Eenmalig loggen",
		newPersonalFood: "Nieuw voedingsmiddel",
		today: "Vandaag",
		chooseDate: "Kies datum",
		doneChoosingDate: "Klaar",
		pool: "Alles",
		recent: "Recent",
		favorites: "Favorieten",
		combos: "Combo's",
		recipes: "Recepten",
		newRecipe: "Nieuw recept",
		allFoods: "Catalogus",
		mealSummary: (meal, count, energy) => {
			const items = count === 1 ? "1 item" : `${count} items`;
			return energy ? `${meal} · ${items} · ${energy}` : `${meal} · ${items}`;
		},
		mealTally: (count, energy) => {
			const items = count === 1 ? "1 item" : `${count} items`;
			return energy ? `${items} · ${energy}` : items;
		},
		mealNothing: "nog niets",
		expandMeal: "Toon wat er gelogd is",
		collapseMeal: "Verberg wat er gelogd is",
		mealEmpty: "Nog niets gelogd",
		mealHint: "Tik een item om het aan te passen; veeg om te verwijderen.",
		forMeal: (meal) => `Voor jouw ${meal.toLocaleLowerCase("nl")}`,
		forMealHint: "recent · favorieten · combo's",
		results: "Resultaten",
		sourceShipped: "NEVO",
		sourceOwn: "Eigen",
		favoriteTag: "Favoriet",
		recipeTag: "Recept · eigen",
		servingWord: "portie",
		logInto: "Loggen in",
		otherDay: "Andere dag…",
		destinationLabel: (meal, day) => `Loggen in ${meal}, ${day}`,
		logged: (food, meal) => `${food} toegevoegd aan ${meal}`,
		undo: "Ongedaan maken",
		undoFailure:
			"Ongedaan maken lukte niet. Verwijder het item uit de maaltijd.",
		favorite: "Favoriet",
		unfavorite: "Geen favoriet meer",
		logPortion: (portion) => `Loggen · ${portion}`,
		otherPortion: "Andere portie…",
		correct: "Corrigeren…",
		edit: "Bewerken…",
		delete: "Verwijderen",
		poolNote: (count) =>
			`Doorzoekt ${count} NEVO-items, je eigen voeding en Open Food Facts.`,
		poolEmptyTitle: "Zoek eten om te loggen",
		poolEmptyBody:
			"Zoek, scan een barcode of beschrijf wat je at. Wat je logt, komt hier terug bij deze maaltijd.",
		recentEmptyTitle: "Nog niets recent gelogd",
		recentEmptyBody:
			"Voeding die je vanuit deze browser logt, verschijnt hier voor snel loggen.",
		favoritesEmptyTitle: "Nog geen favoriete voeding",
		favoritesEmptyBody:
			"Veeg over een voedingsmiddel om het als favoriet toe te voegen.",
		combosEmptyTitle: "Geen opgeslagen Combo's",
		combosEmptyBody:
			"Sla voeding uit een maaltijd op als Combo en log hem hier.",
		recipesEmptyTitle: "Geen opgeslagen recepten",
		recipesEmptyBody:
			"Sla persoonlijke voeding op als Recept om het hier te vinden.",
		noFoodsTitle: "Geen resultaten",
		noFoodsBody:
			"Probeer een andere zoekopdracht, scan een barcode of voeg een persoonlijk voedingsmiddel toe.",
		noResultsTitle: (query) => `Geen resultaten voor ‘${query}’`,
		noResultsBody: "Zoek online, scan de verpakking of maak het zelf aan.",
		newFoodNamed: (query) => `Nieuw voedingsmiddel ‘${query}’`,
		localNone: (query) => `Niets in je eigen voeding of NEVO voor ‘${query}’.`,
		quickLog: (food) => `${food} snel loggen`,
		quickPortion: (portion, energy) =>
			energy ? `${portion} · ${energy} kcal` : portion,
		details: "Details",
		log: "Loggen",
		wholeCombo: "Hele combo",
		comboParts: (count) =>
			count === 1
				? "Combo · 1 voedingsmiddel"
				: `Combo · ${count} voedingsmiddelen`,
		comboDetail: (combo) => `Combo ${combo} openen`,
		onlineResults: "Open Food Facts",
		searchOnline: "Zoek in Open Food Facts",
		searchOnlineQuery: (query) => `Zoek ‘${query}’ in Open Food Facts`,
		searchOnlineHint: "Merkproducten, met foto en etiket",
		searchingOnline: "zoeken…",
		offCount: (count) => (count === 1 ? "1 resultaat" : `${count} resultaten`),
		offReviewHint: "controleer na importeren",
		offImportHint:
			"Tik om te controleren en op te slaan; daarna staat het in je eigen voeding, ook offline.",
		offShowAll: (count) => `Toon alle ${count}`,
		offNone: (query) => `Niets in Open Food Facts voor ‘${query}’.`,
		offCooling: (seconds) =>
			`Open Food Facts vraagt even rust. Over ${seconds} s zoeken we automatisch opnieuw.`,
		scanInstead: "Scan liever de barcode",
		offline:
			"Offline. Je eigen voeding en NEVO werken; Open Food Facts en onbekende barcodes wachten tot je weer verbinding hebt. Gelogde items synchroniseren later.",
		barcodeNotFound: "Barcode niet gevonden",
		barcodeNotFoundBody: "Niet in je eigen voeding en niet in Open Food Facts.",
		barcodeNewFoodHint:
			"Barcode is al ingevuld; de volgende scan vindt het direct",
		barcodeSearchByName: "Zoek op naam",
		barcodeSearchByNameHint: "Koppel de barcode aan wat je kiest",
		barcodeRescan: "Opnieuw scannen",
		barcodeLinking: (barcode) =>
			`Kies een eigen voedingsmiddel voor barcode ${barcode}`,
		barcodeLinkingStop: "Stoppen",
		barcodeLinked: (food) => `Barcode gekoppeld aan ${food}`,
		barcodeLinkFailure: "Koppelen van de barcode lukte niet.",
		replaceBarcodeTitle: "Barcode vervangen?",
		replaceBarcodeBody: (food, barcode) =>
			`${food} heeft al barcode ${barcode}.`,
		replaceBarcodeConfirm: "Vervangen",
		cancel: "Annuleren",
	},
};

export type { LogFoodCopy };

export function logFoodCopy(locale: "en" | "nl") {
	return copy[locale];
}
