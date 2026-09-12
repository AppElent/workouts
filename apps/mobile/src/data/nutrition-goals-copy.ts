export const nutritionGoalsCopy = {
	en: {
		applyFrom: "Apply changes from",
		applyFromHint:
			"Goals apply to this date and every later day until changed.",
		chooseNutrient: "Add a nutrient",
		showMoreNutrients: "Show more nutrients",
		showLessNutrients: "Show fewer nutrients",
		addMinimum: "Add lower bound",
		addMaximum: "Add upper bound",
		removeBound: "Remove bound",
		preview: "Preview",
		previewEmpty: "No goals will be saved.",
		unsaved: "Unsaved changes are kept while goals refresh.",
		invalid: "Enter a number greater than zero.",
		range: "The minimum cannot be greater than the maximum.",
		effective: "Effective goals",
		reference: "Reference (legacy before first dated version)",
		offlineTitle: "Your goals are not available offline yet.",
		offlineBody: "Reconnect to load your saved goals. Your draft stays here.",
		retry: "Try again",
	},
	nl: {
		applyFrom: "Wijzigingen toepassen vanaf",
		applyFromHint: "Doelen gelden vanaf deze datum totdat je ze wijzigt.",
		chooseNutrient: "Voedingsstof toevoegen",
		showMoreNutrients: "Meer voedingsstoffen tonen",
		showLessNutrients: "Minder voedingsstoffen tonen",
		addMinimum: "Ondergrens toevoegen",
		addMaximum: "Bovengrens toevoegen",
		removeBound: "Grens verwijderen",
		preview: "Voorbeeld",
		previewEmpty: "Er worden geen doelen opgeslagen.",
		unsaved:
			"Niet-opgeslagen wijzigingen blijven staan terwijl doelen vernieuwen.",
		invalid: "Voer een getal groter dan nul in.",
		range: "De ondergrens mag niet groter zijn dan de bovengrens.",
		effective: "Actieve doelen",
		reference: "Referentie (oud vóór de eerste gedateerde versie)",
		offlineTitle: "Je doelen zijn offline nog niet beschikbaar.",
		offlineBody:
			"Maak opnieuw verbinding om je opgeslagen doelen te laden. Je concept blijft bewaard.",
		retry: "Opnieuw proberen",
	},
} as const;

export type NutritionGoalsCopy = {
	[Key in keyof (typeof nutritionGoalsCopy)["en"]]: string;
};

export function getNutritionGoalsCopy(locale: string): NutritionGoalsCopy {
	return locale === "nl" ? nutritionGoalsCopy.nl : nutritionGoalsCopy.en;
}
