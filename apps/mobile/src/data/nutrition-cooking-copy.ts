import type { Locale } from "@workouts/core/nutrition";

export type NutritionCookingCopy = {
	title: string;
	storageTitle: string;
	storageBody: string;
	recipes: string;
	newRecipe: string;
	noRecipes: string;
	recipeNameEn: string;
	recipeNameNl: string;
	versionNameEn: string;
	versionNameNl: string;
	chooseIngredient: string;
	ingredientSearch: string;
	amount: string;
	addIngredient: string;
	removeIngredient: string;
	yield: string;
	yieldGrams: string;
	yieldPortions: string;
	saveRecipe: string;
	savingRecipe: string;
	recipeSaved: string;
	recipeSaveFailure: string;
	missingRecipeFields: string;
	logRecipe: string;
	requestGrams: string;
	requestPortions: string;
	logOnce: string;
	oneOffFoodNameEn: string;
	oneOffFoodNameNl: string;
	nutrientAmountHelp: string;
	logging: string;
	logFailure: string;
	estimated: string;
	grams: string;
	millilitres: string;
	unfinished: string;
	captureNote: string;
	notePlaceholder: string;
	meal: string;
	saveDraft: string;
	savingDraft: string;
	draftSaved: string;
	draftSaveFailure: string;
	noDrafts: string;
	editDraft: string;
	deleteDraft: string;
	deleteDraftTitle: string;
	deleteDraftBody: string;
	deleteDraftConfirm: string;
	cancel: string;
	convertDraft: string;
	conversionFailure: string;
	comboScale: string;
	comboScaleHelp: string;
	comboScaleInvalid: string;
};

const copy: Record<Locale, NutritionCookingCopy> = {
	en: {
		title: "Home cooking",
		storageTitle: "Stored only on this device",
		storageBody:
			"Recipes and unfinished notes stay on this device and are scoped to this account. Recipe sync is not available yet. Diary logs sync through the normal diary path when connected.",
		recipes: "Recipes",
		newRecipe: "New recipe",
		noRecipes: "No recipes yet. Add ingredients and save a named version.",
		recipeNameEn: "Recipe name in English",
		recipeNameNl: "Recipe name in Dutch",
		versionNameEn: "Version name in English",
		versionNameNl: "Version name in Dutch",
		chooseIngredient: "Choose an ingredient",
		ingredientSearch: "Search shipped or personal foods",
		amount: "Amount",
		addIngredient: "Add ingredient",
		removeIngredient: "Remove ingredient",
		yield: "Cooked yield",
		yieldGrams: "Total grams",
		yieldPortions: "Number of portions",
		saveRecipe: "Save recipe",
		savingRecipe: "Saving recipe…",
		recipeSaved: "Recipe saved on this device.",
		recipeSaveFailure:
			"This recipe could not be saved. Your ingredients are still here.",
		missingRecipeFields:
			"Add names, a positive yield and at least one ingredient.",
		logRecipe: "Log recipe",
		requestGrams: "Grams to log",
		requestPortions: "Portions to log",
		logOnce: "Log once",
		oneOffFoodNameEn: "Food name in English",
		oneOffFoodNameNl: "Food name in Dutch",
		nutrientAmountHelp:
			"Values for the entire amount above; energy in kcal, all others in g. Leave unknown blank.",
		logging: "Logging…",
		logFailure: "This entry could not be saved. Your values are still here.",
		estimated: "Estimated",
		grams: "Grams",
		millilitres: "Millilitres",
		unfinished: "Unfinished",
		captureNote: "Capture a note",
		notePlaceholder: "What did you eat? Add a short note to finish later.",
		meal: "Meal",
		saveDraft: "Save for later",
		savingDraft: "Saving note…",
		draftSaved: "Note saved on this device.",
		draftSaveFailure: "This note could not be saved. It is still here.",
		noDrafts: "No unfinished notes.",
		editDraft: "Edit note",
		deleteDraft: "Delete note",
		deleteDraftTitle: "Delete this unfinished note?",
		deleteDraftBody: "The note will be removed from this device.",
		deleteDraftConfirm: "Delete note",
		cancel: "Cancel",
		convertDraft: "Finish and log once",
		conversionFailure: "This note could not be logged. It is still here.",
		comboScale: "Scale this Combo",
		comboScaleHelp: "Changes this log only; the saved Combo stays unchanged.",
		comboScaleInvalid: "Enter a positive number.",
	},
	nl: {
		title: "Thuis koken",
		storageTitle: "Alleen op dit apparaat opgeslagen",
		storageBody:
			"Recepten en onafgemaakte notities blijven op dit apparaat en zijn aan dit account gekoppeld. Receptsync is nog niet beschikbaar. Dagboekitems gebruiken de normale synchronisatie zodra je verbonden bent.",
		recipes: "Recepten",
		newRecipe: "Nieuw recept",
		noRecipes:
			"Nog geen recepten. Voeg ingrediënten toe en sla een benoemde versie op.",
		recipeNameEn: "Naam recept in het Engels",
		recipeNameNl: "Naam recept in het Nederlands",
		versionNameEn: "Versienaam in het Engels",
		versionNameNl: "Versienaam in het Nederlands",
		chooseIngredient: "Ingrediënt kiezen",
		ingredientSearch: "Zoek meegeleverde of persoonlijke voeding",
		amount: "Hoeveelheid",
		addIngredient: "Ingrediënt toevoegen",
		removeIngredient: "Ingrediënt verwijderen",
		yield: "Gekookte opbrengst",
		yieldGrams: "Totaal gram",
		yieldPortions: "Aantal porties",
		saveRecipe: "Recept opslaan",
		savingRecipe: "Recept opslaan…",
		recipeSaved: "Recept op dit apparaat opgeslagen.",
		recipeSaveFailure:
			"Dit recept kon niet worden opgeslagen. Je ingrediënten staan er nog.",
		missingRecipeFields:
			"Vul namen, een positieve opbrengst en minstens één ingrediënt in.",
		logRecipe: "Recept loggen",
		requestGrams: "Te loggen gram",
		requestPortions: "Te loggen porties",
		logOnce: "Eenmalig loggen",
		oneOffFoodNameEn: "Naam voeding in het Engels",
		oneOffFoodNameNl: "Naam voeding in het Nederlands",
		nutrientAmountHelp:
			"Waarden voor de volledige bovenstaande hoeveelheid; energie in kcal, de rest in gram. Laat onbekende waarden leeg.",
		logging: "Loggen…",
		logFailure: "Dit item kon niet worden opgeslagen. Je waarden staan er nog.",
		estimated: "Geschat",
		grams: "Gram",
		millilitres: "Milliliter",
		unfinished: "Onafgewerkt",
		captureNote: "Notitie vastleggen",
		notePlaceholder:
			"Wat heb je gegeten? Voeg een korte notitie toe om later af te maken.",
		meal: "Maaltijd",
		saveDraft: "Bewaar voor later",
		savingDraft: "Notitie opslaan…",
		draftSaved: "Notitie op dit apparaat opgeslagen.",
		draftSaveFailure:
			"Deze notitie kon niet worden opgeslagen. Hij staat er nog.",
		noDrafts: "Geen onafgemaakte notities.",
		editDraft: "Notitie bewerken",
		deleteDraft: "Notitie verwijderen",
		deleteDraftTitle: "Deze onafgemaakte notitie verwijderen?",
		deleteDraftBody: "De notitie wordt van dit apparaat verwijderd.",
		deleteDraftConfirm: "Notitie verwijderen",
		cancel: "Annuleren",
		convertDraft: "Afronden en eenmalig loggen",
		conversionFailure: "Deze notitie kon niet worden gelogd. Hij staat er nog.",
		comboScale: "Deze Combo schalen",
		comboScaleHelp:
			"Dit verandert alleen deze log; de opgeslagen Combo blijft gelijk.",
		comboScaleInvalid: "Vul een positief getal in.",
	},
};

export function nutritionCookingCopy(locale: Locale): NutritionCookingCopy {
	return copy[locale];
}
