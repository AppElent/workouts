import type { Locale } from "@workouts/core/nutrition";

export type NutritionCookingCopy = {
	title: string;
	storageTitle: string;
	storageBody: string;
	amount: string;
	logOnce: string;
	oneOffFoodNameEn: string;
	oneOffFoodNameNl: string;
	nutrientAmountHelp: string;
	logging: string;
	logFailure: string;
	estimated: string;
	grams: string;
	servings: string;
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
};

const copy: Record<Locale, NutritionCookingCopy> = {
	en: {
		title: "Capture notes",
		storageTitle: "Stored only on this device",
		storageBody:
			"Capture Drafts stay on this device for this account. They count as intake only after you review and log them.",
		amount: "Amount",
		logOnce: "Log once",
		oneOffFoodNameEn: "Food name in English",
		oneOffFoodNameNl: "Food name in Dutch",
		nutrientAmountHelp:
			"Values for the entire amount above; energy in kcal, all others in g. Leave unknown blank.",
		logging: "Logging…",
		logFailure: "This entry could not be saved. Your values are still here.",
		estimated: "Estimated",
		grams: "Grams",
		servings: "Servings",
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
	},
	nl: {
		title: "Voedingsnotities",
		storageTitle: "Alleen op dit apparaat opgeslagen",
		storageBody:
			"Voedingsnotities blijven op dit apparaat voor dit account. Ze tellen pas mee nadat je ze controleert en logt.",
		amount: "Hoeveelheid",
		logOnce: "Eenmalig loggen",
		oneOffFoodNameEn: "Naam voeding in het Engels",
		oneOffFoodNameNl: "Naam voeding in het Nederlands",
		nutrientAmountHelp:
			"Waarden voor de volledige bovenstaande hoeveelheid; energie in kcal, de rest in gram. Laat onbekende waarden leeg.",
		logging: "Loggen…",
		logFailure: "Dit item kon niet worden opgeslagen. Je waarden staan er nog.",
		estimated: "Geschat",
		grams: "Gram",
		servings: "Porties",
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
	},
};

export function nutritionCookingCopy(locale: Locale): NutritionCookingCopy {
	return copy[locale];
}
