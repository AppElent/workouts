import type { Locale } from "@workouts/core/nutrition";

export type OneOffLogCopy = {
	title: string;
	subtitle: string;
	namePlaceholder: string;
	nameRequired: string;
	amount: string;
	iAte: string;
	units: Record<"serving" | "g" | "ml", string>;
	unitMenu: string;
	nutrition: string;
	basisMenu: string;
	forAmount: (amount: string, unit: string) => string;
	forWholeAmount: string;
	wholeAmount: string;
	per100: (unit: "g" | "ml") => string;
	totals: (values: {
		amount: string;
		unit: string;
		energy: string;
		protein: string;
		carbs: string;
		fat: string;
	}) => string;
	footer: string;
	invalidAmount: string;
	invalidNutrient: string;
	log: string;
	logging: string;
	cancel: string;
	logFailure: string;
	discardTitle: string;
	discardBody: (name: string) => string;
	discard: string;
	keepEditing: string;
};

const copy: Record<Locale, OneOffLogCopy> = {
	en: {
		title: "One-off",
		subtitle: "One-off · not saved to your library",
		namePlaceholder: "Name",
		nameRequired: "Enter a name.",
		amount: "Amount",
		iAte: "I ate",
		units: { serving: "portion", g: "g", ml: "ml" },
		unitMenu: "Unit",
		nutrition: "Nutrition",
		basisMenu: "Values are for",
		forAmount: (amount, unit) => `for ${amount} ${unit}`,
		forWholeAmount: "for the whole amount",
		wholeAmount: "For the whole amount",
		per100: (unit) => `per 100 ${unit}`,
		totals: (v) =>
			`You ate ${v.amount} ${v.unit}, that is: ${v.energy} kcal · ${v.protein} g protein · ${v.carbs} g carbs · ${v.fat} g fat`,
		footer:
			"— is unknown; type 0 for a real zero. One-offs are estimated: totals show ~.",
		invalidAmount: "Enter an amount greater than zero.",
		invalidNutrient:
			"Enter zero or a positive number, or leave unknown values empty.",
		log: "Log",
		logging: "Logging…",
		cancel: "Cancel",
		logFailure: "This item could not be logged. Your values are still here.",
		discardTitle: "Discard this item?",
		discardBody: (name) =>
			name ? `${name} will not be logged.` : "It will not be logged.",
		discard: "Discard",
		keepEditing: "Keep editing",
	},
	nl: {
		title: "Eenmalig",
		subtitle: "Eenmalig · komt niet in je bibliotheek",
		namePlaceholder: "Naam",
		nameRequired: "Vul een naam in.",
		amount: "Hoeveelheid",
		iAte: "Ik at",
		units: { serving: "portie", g: "g", ml: "ml" },
		unitMenu: "Eenheid",
		nutrition: "Voedingswaarde",
		basisMenu: "Waarden gelden",
		forAmount: (amount, unit) => `voor ${amount} ${unit}`,
		forWholeAmount: "voor de hele hoeveelheid",
		wholeAmount: "Voor de hele hoeveelheid",
		per100: (unit) => `per 100 ${unit}`,
		totals: (v) =>
			`Je at ${v.amount} ${v.unit}, dat is: ${v.energy} kcal · ${v.protein} g eiwit · ${v.carbs} g koolh. · ${v.fat} g vet`,
		footer:
			"— is onbekend; typ 0 voor echt nul. Eenmalige items zijn geschat: totalen tonen ~.",
		invalidAmount: "Vul een hoeveelheid groter dan nul in.",
		invalidNutrient:
			"Vul nul of een positief getal in, of laat onbekende waarden leeg.",
		log: "Loggen",
		logging: "Bezig met loggen…",
		cancel: "Annuleren",
		logFailure: "Dit item kon niet worden gelogd. Je waarden staan er nog.",
		discardTitle: "Dit item weggooien?",
		discardBody: (name) =>
			name ? `${name} wordt niet gelogd.` : "Het wordt niet gelogd.",
		discard: "Weggooien",
		keepEditing: "Doorgaan",
	},
};

export function oneOffLogCopy(locale: Locale): OneOffLogCopy {
	return copy[locale];
}
