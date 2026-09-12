import type { Locale } from "../i18n";

export type PersonalFoodEditorCopy = {
	name: string;
	otherName: string;
	addOtherName: string;
	editOtherName: string;
	hideOtherName: string;
	per100: string;
	grams: string;
	millilitres: string;
	nutrition: string;
	nutrientHelper: string;
	moreNutrients: string;
	fewerNutrients: string;
	valueOptions: string;
	unknown: string;
	trace: string;
	close: string;
	customServings: string;
	customServingsHelp: string;
	addServing: string;
	removeServing: string;
	servingName: string;
	servingAmount: string;
};

export const personalFoodEditorCopy: Record<Locale, PersonalFoodEditorCopy> = {
	en: {
		name: "Name",
		otherName: "Dutch name",
		addOtherName: "Add Dutch name (optional)",
		editOtherName: "Edit Dutch name (optional)",
		hideOtherName: "Hide Dutch name",
		per100: "Per 100",
		grams: "g",
		millilitres: "ml",
		nutrition: "Nutrition",
		nutrientHelper: "Blank = unknown · 0 = actual zero",
		moreNutrients: "More nutrients",
		fewerNutrients: "Fewer nutrients",
		valueOptions: "{label} value options",
		unknown: "Unknown",
		trace: "Trace",
		close: "Close",
		customServings: "Custom servings",
		customServingsHelp: "Optional amounts you use often.",
		addServing: "Add serving",
		removeServing: "Remove serving",
		servingName: "Serving {number} name",
		servingAmount: "Serving {number} amount in {unit}",
	},
	nl: {
		name: "Naam",
		otherName: "Engelse naam",
		addOtherName: "Engelse naam toevoegen (optioneel)",
		editOtherName: "Engelse naam bewerken (optioneel)",
		hideOtherName: "Engelse naam verbergen",
		per100: "Per 100",
		grams: "g",
		millilitres: "ml",
		nutrition: "Voedingswaarden",
		nutrientHelper: "Leeg = onbekend · 0 = echte nul",
		moreNutrients: "Meer voedingswaarden",
		fewerNutrients: "Minder voedingswaarden",
		valueOptions: "Opties voor {label}",
		unknown: "Onbekend",
		trace: "Spoor",
		close: "Sluiten",
		customServings: "Aangepaste porties",
		customServingsHelp: "Optionele hoeveelheden die je vaak gebruikt.",
		addServing: "Portie toevoegen",
		removeServing: "Portie verwijderen",
		servingName: "Naam van portie {number}",
		servingAmount: "Hoeveelheid van portie {number} in {unit}",
	},
};

export function copyWithLabel(template: string, label: string): string {
	return template.replace("{label}", label);
}

export function copyWithServing(
	template: string,
	number: number,
	unit?: string,
): string {
	return template
		.replace("{number}", String(number))
		.replace("{unit}", unit ?? "");
}
