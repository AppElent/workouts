export type AssistanceLocale = "en" | "nl";

export type AssistanceMessages = {
	title: string;
	intro: string;
	textMode: string;
	labelMode: string;
	context: string;
	textPlaceholder: string;
	parse: string;
	reparse: string;
	reviewBatch: string;
	editBatch: string;
	logBatch: string;
	logging: string;
	selectionPrompt: string;
	selected: string;
	noMatch: string;
	ambiguous: string;
	unsupportedQuantity: string;
	tooLong: string;
	tooManyRows: string;
	unitMismatch: string;
	batchFailure: string;
	batchAccepted: string;
	labelTitle: string;
	labelIntro: string;
	labelPlaceholder: string;
	parseLabel: string;
	invalidLabel: string;
	labelReview: string;
	nameEnglish: string;
	nameDutch: string;
	baseUnit: string;
	grams: string;
	millilitres: string;
	portion: string;
	saveAndLog: string;
	saving: string;
	labelFailure: string;
	labelAccepted: string;
	energyConverted: string;
	photoGated: string;
	mealPhotoGated: string;
	allNutrients: string;
	weeklyTitle: string;
	previousWeek: string;
	nextWeek: string;
	loading: string;
	averageEnergy: string;
	averageProtein: string;
	noAverage: string;
	day: string;
	days: string;
	factualOnly: string;
	entry: string;
	entries: string;
	noEntries: string;
	today: string;
	upcoming: string;
	openDay: string;
	noGoal: string;
	below: string;
	met: string;
	within: string;
	exceeded: string;
	incomplete: string;
	atLeast: string;
	upTo: string;
	energy: string;
	protein: string;
	carbs: string;
	fat: string;
	close: string;
	offlineTitle: string;
	offlineBody: string;
	retry: string;
	pendingNotice: string;
};

export const nutritionAssistanceMessages: Record<
	AssistanceLocale,
	AssistanceMessages
> = {
	en: {
		title: "Nutrition assistance",
		intro: "Review every match before anything is added to your diary.",
		textMode: "Text log",
		labelMode: "Pasted label",
		context: "Logging to {meal} on {date}",
		textPlaceholder: "250 g yoghurt, 30 g oats",
		parse: "Parse text",
		reparse: "Reparse row",
		reviewBatch: "Review batch",
		editBatch: "Edit rows",
		logBatch: "Log reviewed batch",
		logging: "Saving on this device…",
		selectionPrompt: "Choose an exact local food:",
		selected: "Selected",
		noMatch: "No local match. Edit the row or choose another food.",
		ambiguous: "Several local matches. Choose one explicitly.",
		unsupportedQuantity: "Use an explicit quantity such as 250 g or 200 ml.",
		tooLong: "Shorten the text before parsing it.",
		tooManyRows: "Review up to 100 foods per batch.",
		unitMismatch:
			"This food uses a different base unit. Choose a matching row.",
		batchFailure: "The batch could not be saved. Your review is still here.",
		batchAccepted: "Batch saved on this device and queued for sync.",
		labelTitle: "Review a pasted nutrition label",
		labelIntro:
			"Paste the per-100 g or per-100 ml text from a package. Missing nutrients stay blank.",
		labelPlaceholder:
			"Name: Plain yoghurt\nPer 100 g\nEnergy 250 kJ\nProtein 5 g",
		parseLabel: "Parse label",
		invalidLabel: "Paste label text that includes Per 100 g or Per 100 ml.",
		labelReview: "Editable label review",
		nameEnglish: "English food name",
		nameDutch: "Dutch food name",
		baseUnit: "Label basis",
		grams: "Per 100 g",
		millilitres: "Per 100 ml",
		portion: "Portion to log",
		saveAndLog: "Save food and log portion",
		saving: "Saving food and portion…",
		labelFailure:
			"The label food could not be saved. Your review is still here.",
		labelAccepted: "Food saved and portion queued on this device.",
		energyConverted: "Energy shown in kJ was converted to kcal (kJ ÷ 4.184).",
		photoGated: "Photo/OCR label capture is gated and not implemented in v1.",
		mealPhotoGated:
			"Meal-photo estimation is a separate gated experiment and is not implemented.",
		allNutrients: "All eight nutrients; blank means not supplied",
		weeklyTitle: "Week overview",
		previousWeek: "Previous week",
		nextWeek: "Next week",
		loading: "Loading Week overview",
		averageEnergy: "Energy average",
		averageProtein: "Protein average",
		noAverage: "No average available",
		day: "day",
		days: "days",
		factualOnly:
			"This is a factual summary of logged values, not dietary advice.",
		entry: "entry",
		entries: "entries",
		noEntries: "No entries",
		today: "Today",
		upcoming: "Upcoming",
		openDay: "Open",
		noGoal: "No goal",
		below: "Below",
		met: "Met",
		within: "Within",
		exceeded: "Exceeded",
		incomplete: "Incomplete",
		atLeast: "At least",
		upTo: "Up to",
		energy: "Energy",
		protein: "Protein",
		carbs: "Carbohydrates",
		fat: "Fat",
		close: "Close",
		offlineTitle: "This Week overview is not on this phone yet",
		offlineBody:
			"Reconnect to load the seven-day overview. Missing data is unknown, not zero.",
		retry: "Try again",
		pendingNotice:
			"Some saved meals are still waiting to sync; this overview shows synced diary data only.",
	},
	nl: {
		title: "Voedingshulp",
		intro:
			"Controleer elke match voordat er iets aan je dagboek wordt toegevoegd.",
		textMode: "Tekst loggen",
		labelMode: "Geplakt etiket",
		context: "Loggen bij {meal} op {date}",
		textPlaceholder: "250 g yoghurt, 30 g havermout",
		parse: "Tekst ontleden",
		reparse: "Rij opnieuw ontleden",
		reviewBatch: "Batch controleren",
		editBatch: "Rijen bewerken",
		logBatch: "Gecontroleerde batch loggen",
		logging: "Op dit apparaat opslaan…",
		selectionPrompt: "Kies een exacte lokale voeding:",
		selected: "Gekozen",
		noMatch: "Geen lokale match. Bewerk de rij of kies andere voeding.",
		ambiguous: "Meerdere lokale matches. Kies er één expliciet.",
		unsupportedQuantity:
			"Gebruik een expliciete hoeveelheid, zoals 250 g of 200 ml.",
		tooLong: "Maak de tekst korter voordat je hem ontleedt.",
		tooManyRows: "Controleer maximaal 100 voedingsmiddelen per batch.",
		unitMismatch:
			"Deze voeding gebruikt een andere basiseenheid. Kies een passende rij.",
		batchFailure:
			"De batch kon niet worden opgeslagen. Je controle staat er nog.",
		batchAccepted:
			"Batch op dit apparaat opgeslagen en klaar voor synchronisatie.",
		labelTitle: "Geplakt voedingsetiket controleren",
		labelIntro:
			"Plak de tekst per 100 g of per 100 ml van een verpakking. Ontbrekende voedingsstoffen blijven leeg.",
		labelPlaceholder:
			"Naam: Magere yoghurt\nPer 100 g\nEnergie 250 kJ\nEiwitten 5 g",
		parseLabel: "Etiket ontleden",
		invalidLabel: "Plak etikettekst met Per 100 g of Per 100 ml.",
		labelReview: "Bewerkbare etiketcontrole",
		nameEnglish: "Engelse voedingsnaam",
		nameDutch: "Nederlandse voedingsnaam",
		baseUnit: "Etiketbasis",
		grams: "Per 100 g",
		millilitres: "Per 100 ml",
		portion: "Te loggen portie",
		saveAndLog: "Voeding opslaan en portie loggen",
		saving: "Voeding en portie opslaan…",
		labelFailure:
			"De etiketvoeding kon niet worden opgeslagen. Je controle staat er nog.",
		labelAccepted: "Voeding opgeslagen en portie op dit apparaat klaargezet.",
		energyConverted: "Energie in kJ is omgerekend naar kcal (kJ ÷ 4,184).",
		photoGated:
			"Etiket vastleggen met foto/OCR is afgeschermd en niet geïmplementeerd in v1.",
		mealPhotoGated:
			"Schatten met een maaltijdfoto is een apart afgeschermd experiment en niet geïmplementeerd.",
		allNutrients: "Alle acht voedingsstoffen; leeg betekent niet aangeleverd",
		weeklyTitle: "Weekoverzicht",
		previousWeek: "Vorige week",
		nextWeek: "Volgende week",
		loading: "Weekoverzicht wordt geladen",
		averageEnergy: "Gemiddelde energie",
		averageProtein: "Gemiddeld eiwit",
		noAverage: "Geen gemiddelde beschikbaar",
		day: "dag",
		days: "dagen",
		factualOnly:
			"Dit is een feitelijk overzicht van gelogde waarden, geen voedingsadvies.",
		entry: "item",
		entries: "items",
		noEntries: "Geen items",
		today: "Vandaag",
		upcoming: "Binnenkort",
		openDay: "Open",
		noGoal: "Geen doel",
		below: "Onder doel",
		met: "Behaald",
		within: "Binnen doel",
		exceeded: "Overschreden",
		incomplete: "Onvolledig",
		atLeast: "Minimaal",
		upTo: "Maximaal",
		energy: "Energie",
		protein: "Eiwit",
		carbs: "Koolhydraten",
		fat: "Vet",
		close: "Sluiten",
		offlineTitle: "Dit weekoverzicht staat nog niet op dit apparaat",
		offlineBody:
			"Maak opnieuw verbinding om het weekoverzicht te laden. Ontbrekende gegevens zijn onbekend, niet nul.",
		retry: "Opnieuw proberen",
		pendingNotice:
			"Sommige opgeslagen maaltijden wachten nog op synchronisatie; dit overzicht toont alleen gesynchroniseerde dagboekgegevens.",
	},
};

export function getNutritionAssistanceMessages(
	locale: AssistanceLocale,
): AssistanceMessages {
	return nutritionAssistanceMessages[locale];
}
