import type { Locale } from "@workouts/core/nutrition";

export type NutritionCookingCopy = {
	title: string;
	storageTitle: string;
	storageBody: string;
	amount: string;
	logOnce: string;
	logOnceConfirm: string;
	oneOffFoodNameEn: string;
	oneOffFoodNameNl: string;
	nutrientAmountHelp: string;
	estimated: string;
	grams: string;
	servings: string;
	millilitres: string;
	cancel: string;
	conversionFailure: string;
};

const copy: Record<Locale, NutritionCookingCopy> = {
	en: {
		title: "Quick capture",
		storageTitle: "Log a one-off food",
		storageBody:
			"Use this for food you do not want to add to your personal library.",
		amount: "Amount",
		logOnce: "Log once",
		logOnceConfirm: "Log once",
		oneOffFoodNameEn: "Food name in English",
		oneOffFoodNameNl: "Food name in Dutch",
		nutrientAmountHelp:
			"Values for the entire amount above; energy in kcal, all others in g. Leave unknown blank.",
		estimated: "Estimated",
		grams: "Grams",
		servings: "Servings",
		millilitres: "Millilitres",
		cancel: "Cancel",
		conversionFailure:
			"This entry could not be logged. Your values are still here.",
	},
	nl: {
		title: "Snel vastleggen",
		storageTitle: "Eenmalige voeding loggen",
		storageBody:
			"Gebruik dit voor voeding die je niet aan je persoonlijke bibliotheek wilt toevoegen.",
		amount: "Hoeveelheid",
		logOnce: "Eenmalig loggen",
		logOnceConfirm: "Eenmalig loggen",
		oneOffFoodNameEn: "Naam voeding in het Engels",
		oneOffFoodNameNl: "Naam voeding in het Nederlands",
		nutrientAmountHelp:
			"Waarden voor de volledige bovenstaande hoeveelheid; energie in kcal, de rest in gram. Laat onbekende waarden leeg.",
		estimated: "Geschat",
		grams: "Gram",
		servings: "Porties",
		millilitres: "Milliliter",
		cancel: "Annuleren",
		conversionFailure:
			"Dit item kon niet worden gelogd. Je waarden staan er nog.",
	},
};

export function nutritionCookingCopy(locale: Locale): NutritionCookingCopy {
	return copy[locale];
}
