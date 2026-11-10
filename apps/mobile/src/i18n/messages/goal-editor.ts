export const goalEditorEn = {
	title: "Nutrition goals",
	loading: "Loading goals",
	save: "Save goals",
	saving: "Saving goals…",
	close: "Close",
	failure: "Your goals could not be saved. Your changes are still here.",
	retry: "Retry",
	appliesFrom: "Applies from",
	today: "Today",
	done: "Done",
	currentSince:
		"Current goals apply since {date}. Earlier days keep their goals.",
	replacesFrom:
		"Replaces the goals set from {date}. Earlier days keep their goals.",
	firstGoals: "Goals apply from this date. Earlier days stay without goals.",
	alsoThrough: "Also applies to {from} through {through}.",
	throughToday: "today",
	earlierKeep: "Days before keep the goals from {date}.",
	earlierNone: "Days before stay without goals.",
	future: "Applies from {date}. Until then, the current goals apply.",
	openedFrom: "Opened from the diary of {date}.",
	startingPoint: "Starting point",
	custom: "Custom",
	noPreset: "No starting point",
	edited: "{count} edited",
	unchanged: "Unchanged",
	presetMenuTitle: "Replaces all goals in this draft",
	restore: "Restore ‘{name}’",
	restoreHint: "Resets the {count} edited values",
	staticFooter:
		"Static values (EU 1169/2011, EFSA). Doesn't use Activity or body data; not personal advice.",
	customFooter:
		"Choose a preset to fill all goals at once. Doesn't use Activity or body data; not personal advice.",
	presetApplied: "{name} applied",
	undo: "Undo",
	goals: "Goals",
	withoutGoal: "No goal",
	referenceHint: "reference {direction} {amount}",
	directionShort: { min: "min.", max: "max." },
	kinds: {
		min: { label: "Minimum", hint: "at least" },
		max: { label: "Maximum", hint: "at most" },
		range: { label: "Range", hint: "between two values" },
	},
	kindMenu: "Goal type for {nutrient}",
	removeGoal: "Remove goal",
	addGoal: "Add {nutrient} goal",
	noGoals: "No goals. The diary shows totals only.",
	removeAll: "Remove all goals",
	removedAll: "All goals removed",
	chooseStart: "Choose a starting point",
	chooseStartBody:
		"Fixed values; you can adjust every goal afterwards. Doesn't use body data.",
	setYourself: "Set it yourself",
	chooseStartFooter:
		"No choice means no goals; the diary then shows totals only.",
	presetSummary: {
		reference: "{energy} kcal · EU 1169/2011 Annex XIII",
		loseWeight: "{energy} kcal · Reference {energyDelta} kcal",
		buildMuscle: "{energy} kcal · protein {protein} g",
	},
	presetMenuHint: {
		reference: "EU 1169/2011 Annex XIII, EFSA fibre",
		loseWeight: "Reference, energy {energyDelta} kcal",
		buildMuscle:
			"Reference, energy {energyDelta} kcal, protein {proteinDelta} g",
	},
	field: "{nutrient} {direction}",
	previousField: "Previous field",
	nextField: "Next field",
	invalid: "Enter a number greater than zero.",
	range: "Minimum is higher than maximum.",
	invalidCount: {
		one: "1 goal needs a fix",
		other: "{count} goals need a fix",
	},
	discardMessage: {
		one: "You changed 1 goal.",
		other: "You changed {count} goals.",
	},
	discard: "Discard changes",
	keepEditing: "Keep editing",
	offlineTitle: "Your goals are not available offline yet.",
	offlineBody: "Reconnect to load your saved goals. Your draft stays here.",
	presets: {
		reference: {
			name: "Reference intake",
			provenance: "EU Regulation 1169/2011 Annex XIII and EFSA fibre guidance.",
		},
		loseWeight: {
			name: "Lose weight",
			provenance:
				"Fixed Reference intake variant: energy −300 kcal. Not personalised advice.",
		},
		buildMuscle: {
			name: "Build muscle",
			provenance:
				"Fixed Reference intake variant: energy +300 kcal and protein +50 g. Not personalised advice.",
		},
	},
};

export const goalEditorNl: typeof goalEditorEn = {
	title: "Voedingsdoelen",
	loading: "Doelen worden geladen",
	save: "Doelen opslaan",
	saving: "Doelen opslaan…",
	close: "Sluiten",
	failure:
		"Je doelen konden niet worden opgeslagen. Je wijzigingen staan er nog.",
	retry: "Opnieuw",
	appliesFrom: "Geldt vanaf",
	today: "Vandaag",
	done: "Klaar",
	currentSince:
		"Huidige doelen gelden sinds {date}. Eerdere dagen houden hun doelen.",
	replacesFrom:
		"Vervangt de doelen vanaf {date}. Eerdere dagen houden hun doelen.",
	firstGoals:
		"Doelen gelden vanaf deze datum. Eerdere dagen blijven zonder doelen.",
	alsoThrough: "Geldt ook voor {from} t/m {through}.",
	throughToday: "vandaag",
	earlierKeep: "De dagen daarvoor houden de doelen van {date}.",
	earlierNone: "De dagen daarvoor blijven zonder doelen.",
	future: "Geldt vanaf {date}. Tot dan gelden de huidige doelen.",
	openedFrom: "Geopend vanuit het dagboek van {date}.",
	startingPoint: "Startpunt",
	custom: "Zelf ingesteld",
	noPreset: "Geen startpunt",
	edited: "{count} aangepast",
	unchanged: "Ongewijzigd",
	presetMenuTitle: "Vervangt alle doelen in dit concept",
	restore: "Herstel ‘{name}’",
	restoreHint: "Zet de {count} aangepaste waarden terug",
	staticFooter:
		"Statische waarden (EU 1169/2011, EFSA). Gebruikt geen Activiteit- of lichaamsgegevens; geen persoonlijk advies.",
	customFooter:
		"Kies een preset om alle doelen in één keer te vullen. Gebruikt geen Activiteit- of lichaamsgegevens; geen persoonlijk advies.",
	presetApplied: "{name} toegepast",
	undo: "Ongedaan maken",
	goals: "Doelen",
	withoutGoal: "Zonder doel",
	referenceHint: "referentie {direction} {amount}",
	directionShort: { min: "min.", max: "max." },
	kinds: {
		min: { label: "Minimum", hint: "ten minste" },
		max: { label: "Maximum", hint: "ten hoogste" },
		range: { label: "Bereik", hint: "tussen twee waarden" },
	},
	kindMenu: "Soort doel voor {nutrient}",
	removeGoal: "Doel verwijderen",
	addGoal: "Doel voor {nutrient} toevoegen",
	noGoals: "Geen doelen. Het dagboek toont alleen totalen.",
	removeAll: "Alle doelen verwijderen",
	removedAll: "Alle doelen verwijderd",
	chooseStart: "Kies een startpunt",
	chooseStartBody:
		"Vaste waarden; je kunt elk doel daarna aanpassen. Gebruikt geen lichaamsgegevens.",
	setYourself: "Zelf instellen",
	chooseStartFooter:
		"Geen keuze = geen doelen; het dagboek toont dan alleen totalen.",
	presetSummary: {
		reference: "{energy} kcal · EU 1169/2011 bijlage XIII",
		loseWeight: "{energy} kcal · Referentie {energyDelta} kcal",
		buildMuscle: "{energy} kcal · eiwit {protein} g",
	},
	presetMenuHint: {
		reference: "EU 1169/2011 bijlage XIII, EFSA vezels",
		loseWeight: "Referentie, energie {energyDelta} kcal",
		buildMuscle:
			"Referentie, energie {energyDelta} kcal, eiwit {proteinDelta} g",
	},
	field: "{nutrient} {direction}",
	previousField: "Vorig veld",
	nextField: "Volgend veld",
	invalid: "Vul een getal groter dan nul in.",
	range: "Minimum is hoger dan maximum.",
	invalidCount: {
		one: "1 doel klopt niet",
		other: "{count} doelen kloppen niet",
	},
	discardMessage: {
		one: "Je hebt 1 doel gewijzigd.",
		other: "Je hebt {count} doelen gewijzigd.",
	},
	discard: "Wijzigingen weggooien",
	keepEditing: "Doorgaan met bewerken",
	offlineTitle: "Je doelen zijn offline nog niet beschikbaar.",
	offlineBody:
		"Maak opnieuw verbinding om je opgeslagen doelen te laden. Je concept blijft bewaard.",
	presets: {
		reference: {
			name: "Referentie-inname",
			provenance:
				"EU-verordening 1169/2011 bijlage XIII en EFSA-richtlijn voor vezels.",
		},
		loseWeight: {
			name: "Afvallen",
			provenance:
				"Vaste variant van Referentie-inname: energie −300 kcal. Geen persoonlijk advies.",
		},
		buildMuscle: {
			name: "Spiermassa opbouwen",
			provenance:
				"Vaste variant van Referentie-inname: energie +300 kcal en eiwit +50 g. Geen persoonlijk advies.",
		},
	},
};
