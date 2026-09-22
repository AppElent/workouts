/**
 * Copy for the food browser.
 *
 * `FoodBrowserTab` keeps its name for the five source scopes, but the screen
 * no longer presents them as exclusive tabs: `pool` is the default and searches
 * every source at once, and the rest narrow what is already in front of you.
 * `all` stays the deliberate broader view (spec #75) — the only place a
 * corrected shipped record is still listed — which is why it survives the
 * redesign as its own chip rather than folding into `pool`.
 */
export type FoodBrowserTab =
	| "pool"
	| "recent"
	| "favorites"
	| "combos"
	| "recipes"
	| "all";

type FoodBrowserCopy = {
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
	readonly expandMeal: string;
	readonly collapseMeal: string;
	readonly mealEmpty: string;
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
	readonly searchingOnline: string;
};

const copy: Record<"en" | "nl", FoodBrowserCopy> = {
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
		allFoods: "Full catalogue",
		mealSummary: (meal, count, energy) => {
			const items = count === 1 ? "1 item" : `${count} items`;
			return energy ? `${meal} · ${items} · ${energy}` : `${meal} · ${items}`;
		},
		expandMeal: "Show what is logged",
		collapseMeal: "Hide what is logged",
		mealEmpty: "Nothing logged yet",
		poolNote: (count) =>
			`Everything is searched in one list — recent, favorites, Combos, recipes and all ${count} catalogue items.`,
		poolEmptyTitle: "Nothing to log yet",
		poolEmptyBody:
			"Search for a food, scan a barcode, or add one with the + button.",
		recentEmptyTitle: "Nothing logged recently",
		recentEmptyBody:
			"Foods you log from this browser will appear here for quick logging.",
		favoritesEmptyTitle: "No favorite foods yet",
		favoritesEmptyBody: "Open a food to add it to your favorites.",
		combosEmptyTitle: "No saved Combos",
		combosEmptyBody: "Save foods from a meal as a Combo, then log it here.",
		recipesEmptyTitle: "No saved recipes",
		recipesEmptyBody: "Save a Personal Food as a Recipe to find it here.",
		noFoodsTitle: "No matches",
		noFoodsBody:
			"Try a different name, scan a barcode, or add a Personal Food.",
		quickLog: (food) => `Quick log ${food}`,
		quickPortion: (portion, energy) =>
			energy ? `${portion} · ${energy} kcal` : portion,
		details: "Details",
		log: "Log",
		wholeCombo: "Whole Combo",
		comboParts: (count) =>
			count === 1 ? "Combo · 1 food" : `Combo · ${count} foods`,
		comboDetail: (combo) => `Open Combo ${combo}`,
		onlineResults: "Open Food Facts results",
		searchOnline: "Search Open Food Facts",
		searchingOnline: "Searching Open Food Facts…",
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
		allFoods: "Volledige lijst",
		mealSummary: (meal, count, energy) => {
			const items = count === 1 ? "1 item" : `${count} items`;
			return energy ? `${meal} · ${items} · ${energy}` : `${meal} · ${items}`;
		},
		expandMeal: "Toon wat er gelogd is",
		collapseMeal: "Verberg wat er gelogd is",
		mealEmpty: "Nog niets gelogd",
		poolNote: (count) =>
			`Alles wordt in één lijst gezocht — recent, favorieten, combo's, recepten en alle ${count} NEVO-items.`,
		poolEmptyTitle: "Nog niets om te loggen",
		poolEmptyBody:
			"Zoek een voedingsmiddel, scan een barcode of voeg er een toe met de +.",
		recentEmptyTitle: "Nog niets recent gelogd",
		recentEmptyBody:
			"Voeding die je vanuit deze browser logt, verschijnt hier voor snel loggen.",
		favoritesEmptyTitle: "Nog geen favoriete voeding",
		favoritesEmptyBody:
			"Open een voedingsmiddel om het als favoriet toe te voegen.",
		combosEmptyTitle: "Geen opgeslagen Combo's",
		combosEmptyBody:
			"Sla voeding uit een maaltijd op als Combo en log hem hier.",
		recipesEmptyTitle: "Geen opgeslagen recepten",
		recipesEmptyBody:
			"Sla persoonlijke voeding op als Recept om het hier te vinden.",
		noFoodsTitle: "Geen resultaten",
		noFoodsBody:
			"Probeer een andere zoekopdracht, scan een barcode of voeg een persoonlijk voedingsmiddel toe.",
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
		onlineResults: "Resultaten van Open Food Facts",
		searchOnline: "Zoek in Open Food Facts",
		searchingOnline: "Open Food Facts doorzoeken…",
	},
};

export function nutritionFoodBrowserCopy(locale: "en" | "nl") {
	return copy[locale];
}
