export type FoodBrowserTab =
	| "recent"
	| "favorites"
	| "combos"
	| "recipes"
	| "all";

type FoodBrowserCopy = {
	readonly done: string;
	readonly search: string;
	readonly scanBarcode: string;
	readonly moreActions: string;
	readonly logOnce: string;
	readonly newPersonalFood: string;
	readonly captureLater: string;
	readonly recent: string;
	readonly favorites: string;
	readonly combos: string;
	readonly recipes: string;
	readonly allFoods: string;
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
	readonly recipeDetail: (recipe: string) => string;
	readonly comboDetail: (combo: string) => string;
	readonly onlineResults: string;
	readonly searchOnline: string;
	readonly searchingOnline: string;
};

const copy: Record<"en" | "nl", FoodBrowserCopy> = {
	en: {
		done: "Done",
		search: "Search foods",
		scanBarcode: "Scan barcode",
		moreActions: "More food actions",
		logOnce: "Log once",
		newPersonalFood: "New Personal Food",
		captureLater: "Capture later",
		recent: "Recent",
		favorites: "Favorites",
		combos: "Combos",
		recipes: "Recipes",
		allFoods: "All foods",
		recentEmptyTitle: "Nothing logged recently",
		recentEmptyBody:
			"Foods you log from this browser will appear here for quick logging.",
		favoritesEmptyTitle: "No favorite foods yet",
		favoritesEmptyBody: "Open a food to add it to your favorites.",
		combosEmptyTitle: "No saved Combos",
		combosEmptyBody: "Save foods from a meal as a Combo, then log it here.",
		recipesEmptyTitle: "No saved recipes",
		recipesEmptyBody: "Create recipes in Cooking and they will appear here.",
		noFoodsTitle: "No foods found",
		noFoodsBody: "Try another search, scan a barcode, or add a Personal Food.",
		quickLog: (food) => `Quick log ${food}`,
		quickPortion: (portion, energy) =>
			energy ? `${portion} · ${energy} kcal` : portion,
		details: "Details",
		log: "Log",
		recipeDetail: (recipe) => `Open recipe ${recipe}`,
		comboDetail: (combo) => `Open Combo ${combo}`,
		onlineResults: "Open Food Facts results",
		searchOnline: "Search Open Food Facts",
		searchingOnline: "Searching Open Food Facts…",
	},
	nl: {
		done: "Klaar",
		search: "Zoek eten",
		scanBarcode: "Barcode scannen",
		moreActions: "Meer eetacties",
		logOnce: "Eenmalig loggen",
		newPersonalFood: "Nieuw persoonlijk voedingsmiddel",
		captureLater: "Later vastleggen",
		recent: "Recent",
		favorites: "Favorieten",
		combos: "Combo's",
		recipes: "Recepten",
		allFoods: "Alle voeding",
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
		recipesEmptyBody: "Maak recepten in Koken; ze verschijnen hier.",
		noFoodsTitle: "Geen voeding gevonden",
		noFoodsBody:
			"Probeer een andere zoekopdracht, scan een barcode of voeg een persoonlijk voedingsmiddel toe.",
		quickLog: (food) => `${food} snel loggen`,
		quickPortion: (portion, energy) =>
			energy ? `${portion} · ${energy} kcal` : portion,
		details: "Details",
		log: "Loggen",
		recipeDetail: (recipe) => `Recept ${recipe} openen`,
		comboDetail: (combo) => `Combo ${combo} openen`,
		onlineResults: "Resultaten van Open Food Facts",
		searchOnline: "Zoek in Open Food Facts",
		searchingOnline: "Open Food Facts doorzoeken…",
	},
};

export function nutritionFoodBrowserCopy(locale: "en" | "nl") {
	return copy[locale];
}
