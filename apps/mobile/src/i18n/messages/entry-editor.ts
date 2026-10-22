export const entryEditorEn = {
	labs: "Labs",
	labTitle: "Diary Entry redesign",
	labIntro:
		"Choose an entry to try the new editor. Changes are saved to your diary.",
	empty:
		"No entries for this day. Log food in Nutrition, or choose another date.",
	chooseServing: "Choose serving",
	newServing: "New serving",
	changeServing: "Change serving",
	saveServing: "Save",
	foodServings: "Food servings",
	personalMeasures: "My measures",
	personalMeasure: "Personal measure",
	foodScope: "This food",
	ownScope: "Personal measure",
	foodHelp: "Only available with this food.",
	ownHelp: "Available with all foods using {unit}.",
	name: "Name",
	namePlaceholder: "e.g. My glass",
	amount: "Amount",
	add: "Add",
	cancel: "Cancel",
	cancelCreation: "Cancel new serving",
	done: "Done",
	next: "Next",
	more: "Increase quantity",
	less: "Decrease quantity",
	moreBy: "Increase by {step}",
	lessBy: "Decrease by {step}",
	thisItem: "This item",
	logged: "Logged",
	details: "Product details",
	detailsHint: "Tap for product details",
	historicalBasis: "Based on the nutrition saved with this entry.",
	unavailable:
		"The source food is no longer available. Your logged nutrition is preserved.",
	discardTitle: "Discard changes?",
	discardBody:
		"Your changes to this entry will be lost. Servings already added are kept.",
	discard: "Discard changes",
	keepEditing: "Keep editing",
	invalidQuantity: "Enter an amount greater than zero.",
	invalidServing:
		"Enter a name (1–40 characters) and an amount greater than zero, up to 10000.",
	invalidMeasure: "Personal Measures support at most one decimal place.",
	offline:
		"Connect to add a Serving or Personal Measure. Cached choices are still available offline.",
	addFailure:
		"Could not add this serving. Your input is still here; please try again.",
	savedSeparately:
		"Adding saves this definition, even if you cancel editing the entry.",
	yesterday: "Yesterday",
	today: "Today",
	tomorrow: "Tomorrow",
	otherDate: "Other date…",
	missingEntry: "This entry is no longer available.",
	loading: "Loading entry…",
	uncachedDay: "This day is not cached. Connect to load its entries.",
	correctedFor: "Corrected for this entry: ",
	correction: {
		title: "Fill in nutrition",
		save: "Save correction",
		failure: "Could not save. Your changes are still here; try again.",
		sourceSavedDiscard:
			"The Food is already saved. The diary correction has not been saved.",
		updatesSource:
			"Updates the Food and only this diary entry. Other entries stay unchanged.",
		noSource:
			"No source Food is available. You are changing only this diary entry.",
		forkNotice: "A personal version of this shipped Food will be saved.",
		valuesFor: "Values for {amount} {unit}",
		legend: "Blank = unknown · ~ = trace · 0 = zero",
		convertAmount: "How many {unit} equal this entry ({amount} {entryUnit})?",
		invalidNumber: "Enter a valid, nonnegative number.",
		sourceSavedFailure: "Food saved; diary correction failed. Try again.",
	},
	transfer: {
		destinationDate: "Destination date",
		destinationMeal: "Destination meal",
		chooseDate: "Choose destination date",
		modeCopy: "Copy",
		modeMove: "Move",
		snacksShort: "Snacks",
		copy: {
			title: { one: "Copy 1 item", other: "Copy {count} items" },
			submit: "Copy entry",
			pending: "Copying…",
			failure:
				"This entry could not be copied. Your destination is still here.",
		},
		move: {
			title: { one: "Move 1 item", other: "Move {count} items" },
			submit: "Move entry",
			pending: "Moving…",
			failure: "This entry could not be moved. Your destination is still here.",
		},
	},
	sqliteBrowser: "SQLite browser",
};
export const entryEditorNl: typeof entryEditorEn = {
	labs: "Labs",
	labTitle: "Dagboekitem vernieuwd",
	labIntro:
		"Kies een item om de nieuwe editor te proberen. Wijzigingen worden opgeslagen in je dagboek.",
	empty: "Geen items voor deze dag. Log voeding of kies een andere datum.",
	chooseServing: "Portie kiezen",
	newServing: "Nieuwe portie",
	changeServing: "Portie wijzigen",
	saveServing: "Bewaren",
	foodServings: "Productporties",
	personalMeasures: "Eigen maten",
	personalMeasure: "Eigen maat",
	foodScope: "Dit product",
	ownScope: "Eigen maat",
	foodHelp: "Alleen zichtbaar bij dit product.",
	ownHelp: "Beschikbaar bij alle producten in {unit}.",
	name: "Naam",
	namePlaceholder: "bijv. Mijn glas",
	amount: "Hoeveelheid",
	add: "Toevoegen",
	cancel: "Annuleren",
	cancelCreation: "Nieuwe portie annuleren",
	done: "Klaar",
	next: "Volgende",
	more: "Hoeveelheid verhogen",
	less: "Hoeveelheid verlagen",
	moreBy: "{step} meer",
	lessBy: "{step} minder",
	thisItem: "Dit item",
	logged: "Gelogd",
	details: "Productgegevens",
	detailsHint: "Tik voor productgegevens",
	historicalBasis:
		"Gebaseerd op de voedingswaarden die bij dit item zijn opgeslagen.",
	unavailable:
		"Het oorspronkelijke product is niet meer beschikbaar. Je gelogde voedingswaarden blijven behouden.",
	discardTitle: "Wijzigingen verwerpen?",
	discardBody:
		"Je wijzigingen aan dit item gaan verloren. Eerder toegevoegde porties blijven bewaard.",
	discard: "Verwerpen",
	keepEditing: "Verder bewerken",
	invalidQuantity: "Voer een hoeveelheid groter dan nul in.",
	invalidServing:
		"Voer een naam (1–40 tekens) en een hoeveelheid groter dan nul, maximaal 10000 in.",
	invalidMeasure: "Eigen maten ondersteunen maximaal één decimaal.",
	offline:
		"Maak verbinding om een portie of eigen maat toe te voegen. Opgeslagen keuzes blijven offline beschikbaar.",
	addFailure:
		"Deze portie kon niet worden toegevoegd. Je invoer is bewaard; probeer het opnieuw.",
	savedSeparately:
		"Toevoegen slaat deze definitie op, ook als je het bewerken van het item annuleert.",
	yesterday: "Gisteren",
	today: "Vandaag",
	tomorrow: "Morgen",
	otherDate: "Andere datum…",
	missingEntry: "Dit item is niet meer beschikbaar.",
	loading: "Item laden…",
	uncachedDay:
		"Deze dag is niet opgeslagen. Maak verbinding om de items te laden.",
	correctedFor: "Aangevuld voor deze invoer: ",
	correction: {
		title: "Voedingswaarden aanvullen",
		save: "Correctie opslaan",
		failure: "Opslaan mislukt. Je wijzigingen staan er nog; probeer opnieuw.",
		sourceSavedDiscard:
			"Het voedingsmiddel is al opgeslagen. De correctie in het dagboek is nog niet opgeslagen.",
		updatesSource:
			"Wijzigt het voedingsmiddel en alleen dit dagboekitem. Andere invoer blijft gelijk.",
		noSource:
			"Geen beschikbaar voedingsmiddel. Je wijzigt alleen dit dagboekitem.",
		forkNotice:
			"Er wordt een persoonlijke versie van dit voedingsmiddel opgeslagen.",
		valuesFor: "Waarden voor {amount} {unit}",
		legend: "Leeg = onbekend · ~ = spoor · 0 = nul",
		convertAmount:
			"Deze invoer ({amount} {entryUnit}) komt overeen met hoeveel {unit}?",
		invalidNumber: "Vul een geldig, niet-negatief getal in.",
		sourceSavedFailure:
			"Voedingsmiddel opgeslagen; dagboekcorrectie mislukt. Probeer opnieuw.",
	},
	transfer: {
		destinationDate: "Doeldatum",
		destinationMeal: "Doelmaaltijd",
		chooseDate: "Kies doeldatum",
		modeCopy: "Kopiëren",
		modeMove: "Verplaatsen",
		snacksShort: "Snack",
		copy: {
			title: { one: "1 item kopiëren", other: "{count} items kopiëren" },
			submit: "Item kopiëren",
			pending: "Kopiëren…",
			failure:
				"Dit item kon niet worden gekopieerd. Je bestemming staat er nog.",
		},
		move: {
			title: { one: "1 item verplaatsen", other: "{count} items verplaatsen" },
			submit: "Item verplaatsen",
			pending: "Verplaatsen…",
			failure:
				"Dit item kon niet worden verplaatst. Je bestemming staat er nog.",
		},
	},
	sqliteBrowser: "SQLite-browser",
};
