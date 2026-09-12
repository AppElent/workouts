/**
 * Dutch. The `satisfies typeof en` at the bottom is the whole safety net: a key
 * present in English and missing here fails typecheck, and a key here that
 * English does not have fails too.
 */
import type { en } from "./en";

export const nl = {
	tabs: {
		home: "Home",
		train: "Trainen",
		nutrition: "Voeding",
		progress: "Voortgang",
		profile: "Profiel",
	},

	common: {
		back: "Terug",
		retry: "Opnieuw proberen",
		offline:
			"Offline — wijzigingen worden gesynchroniseerd zodra je weer verbinding hebt",
	},

	preferences: {
		heading: "Voorkeuren",
		units: "Eenheden",
		notifications: "Meldingen",
		connectedApps: "Gekoppelde apps",
		language: "Taal",
	},

	language: {
		title: "Taal",
		description:
			"Workouts begint in de taal van je telefoon en blijft daarna in de taal die je hier kiest.",
		names: {
			en: "English",
			nl: "Nederlands",
		},
	},

	nutrition: {
		title: "Voeding",

		day: {
			today: "Vandaag",
			yesterday: "Gisteren",
			tomorrow: "Morgen",
			previousDay: "Vorige dag",
			nextDay: "Volgende dag",
			goToToday: "Naar vandaag",
			loading: "Dag wordt geladen",
			energyLogged: "{amount} kcal gelogd",
			energyRemaining: "{amount} kcal resterend",
			energyToMinimum: "{amount} kcal tot minimum",
			energyToRange: "{amount} kcal tot bereik",
			energyTargetReached: "Doel bereikt",
			energyMinimumReached: "Minimum bereikt",
			energyWithinRange: "Binnen doelbereik",
			energyAboveTarget: "{amount} kcal boven doel",
			energyAboveRange: "{amount} kcal boven bereik",
			knownEnergy: "Bekende energie: {amount} kcal · onvolledig",
			unavailableEnergy: "Energie niet beschikbaar",
			approximateEnergy:
				"Geregistreerde energie: {amount} kcal · bij benadering",
			energyReference: "{logged} gelogd / {target} doel",
			energyRangeReference: "{logged} gelogd / {min}–{max} doel",
			energyNoGoal: "Stel een energiedoel in om je inname te vergelijken.",
			reviewGoals: "Doelen controleren",
			additionalGoals: "Extra doelen ({count})",
			showAdditionalGoals: "Extra doelen tonen",
			hideAdditionalGoals: "Extra doelen verbergen",
			syncPending: "Op dit apparaat opgeslagen; wachten op synchronisatie.",
			copyMeal: "Maaltijd kopiëren",
		},
		copyMeal: {
			title: "Maaltijd kopiëren",
			intro:
				"Kies een maaltijd van een andere dag om aan deze dag toe te voegen.",
			sourceDate: "Bron dag",
			sourceMeal: "Bron maaltijd",
			targetDate: "Doel dag",
			targetMeal: "Doel maaltijd",
			selectAll: "Alles selecteren",
			selected: "{count} geselecteerd",
			copy: "{count} voedingsmiddelen naar {meal} kopiëren",
			copying: "Kopiëren…",
			empty: "Er is niets om uit deze maaltijd te kopiëren.",
			uncached: "Deze bronmaaltijd is offline nog niet beschikbaar.",
			incomplete:
				"Deze bronmaaltijd is slechts gedeeltelijk beschikbaar en kan nog niet worden gekopieerd.",
			self: "Kies een andere bronmaaltijd of dag.",
			failure:
				"Deze maaltijd kon niet worden gekopieerd. Je selectie is bewaard.",
		},

		trainingMarker: {
			label: "Getraind",
			description: "Je hebt op deze dag een training voltooid.",
		},

		goals: {
			heading: "Doelen",
			edit: "Doelen bewerken",
			empty: {
				title: "Nog geen doelen",
				body: "Stel een dagelijkse hoeveelheid in voor de voedingsstoffen die jij belangrijk vindt; de dag vult zich daarna vanzelf.",
				action: "Doelen instellen",
			},
			progress: "{total} van {target} {unit}",
			state: {
				neutral: "Niets gelogd",
				under: "Onder",
				met: "Gehaald",
				within: "Binnen",
				exceeded: "Over",
			},
		},
		goalEditor: {
			title: "Jouw voedingsdoelen",
			intro:
				"Kies een statisch startpunt of stel zelf een minimum of maximum in. Deze waarden gebruiken geen Activiteit- of lichaamsgegevens.",
			loading: "Doelen worden geladen",
			amount: "Dagelijkse hoeveelheid",
			remove: "Verwijderen",
			save: "Doelen opslaan",
			saving: "Doelen opslaan…",
			validation: "Vul een hoeveelheid groter dan nul in.",
			failure:
				"Je doelen konden niet worden opgeslagen. Je wijzigingen staan er nog.",
			edited: "{count} bewerkt",
			directions: { min: "Minimum", max: "Maximum" },
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
		},

		meals: {
			breakfast: "Ontbijt",
			lunch: "Lunch",
			dinner: "Diner",
			snacks: "Tussendoortjes",
		},

		addTo: "Voeg eten toe aan {meal}",
		mealEmpty: "Nog niets gelogd. Gebruik + om eten toe te voegen.",
		foodBrowser: {
			title: "Zoek eten voor {meal}",
			searchPlaceholder: "Zoek eten",
			scanBarcode: "Scan barcode",
			searchAll: "Doorzoek alle 2.328 voedingsmiddelen",
			searchOnline: "Zoek in Open Food Facts",
			searchingOnline: "Zoeken in Open Food Facts…",
			onlineResults: "Resultaten uit Open Food Facts",
			showMore: "Toon meer voedingsmiddelen",
			promotedResults: "Alledaagse voeding",
			allResults: "Alle NEVO-voedingsmiddelen",
			empty: "Geen voedingsmiddelen gevonden.",
			per100: "Voedingswaarde per 100",
			closeServingLabel: "Sluit portiekeuze",
			closeServing: "Klaar",
			sheetHandle: "Portiekeuzes",
			serving: "Portie",
			quantity: "Aantal",
			trace: "Spoor",
			absent: "Niet beschikbaar",
			log: "Eten loggen",
			logging: "Eten loggen…",
			logFailure: "Dit eten kon niet worden gelogd. Je selectie staat er nog.",
			energyPer100: "{amount} kcal / 100 {unit}",
			energyUnavailablePer100: "Energie niet beschikbaar / 100 {unit}",
			energyTracePer100: "Spoor / 100 {unit}",
			addFood: "Eten toevoegen",
			addAndContinue: "Toevoegen en doorgaan",
			addAndClose: "Toevoegen en sluiten",
			addedToMeal: "{food} toegevoegd aan {meal}",
			addedThisVisit: "Deze sessie toegevoegd",
			removeAddedFood: "Verwijder {food} uit {meal}",
			mealPicker: "Maaltijd",
			done: "Klaar",
			quantityHalf: "½",
			quantityOne: "1",
			quantityTwo: "2",
			recent: "Recent",
			favorites: "Favorieten",
			allFoods: "Alle voeding",
			combosFilter: "Combo's",
			lastUsed: "Laatst gebruikt",
			favorite: "Favoriet",
			removeFavorite: "Favoriet verwijderen",
			savedOnDevice: "Op dit apparaat opgeslagen, wacht op synchronisatie.",
		},
		barcode: {
			scanTitle: "Scan barcode",
			purpose:
				"Geef cameratoegang om voedingsbarcodes te scannen en voedingswaarden te vinden.",
			allow: "Cameratoegang toestaan",
			requesting: "Cameratoegang aanvragen…",
			denied:
				"Cameratoegang is geweigerd. Je kunt eten nog steeds vinden via Zoeken of Handmatig invoeren.",
			restricted:
				"Cameratoegang is beperkt op dit apparaat. Je kunt eten nog steeds vinden via Zoeken of Handmatig invoeren.",
			hint: "Richt je camera op een barcode.",
			lookingUp: "Barcode wordt opgezocht…",
		},
		foodImport: {
			reviewTitle: "Geïmporteerd eten controleren",
			reviewBody:
				"Gegevens van Open Food Facts kunnen onvolledig zijn of andere namen gebruiken — controleer deze waarden voordat je opslaat. Opslaan maakt een persoonlijk voedingsmiddel dat je altijd kunt bewerken.",
			notFound: "Er is geen product gevonden voor deze barcode.",
			searchNotFound:
				"Geen Open Food Facts-producten gevonden voor deze zoekopdracht.",
			rateLimited:
				"Open Food Facts krijgt op dit moment te veel verzoeken. Probeer het straks opnieuw.",
			timeout: "Het verzoek aan Open Food Facts duurde te lang.",
			networkError:
				"Open Food Facts kon niet worden bereikt. Controleer je verbinding en probeer het opnieuw.",
			unavailable:
				"Open Food Facts is tijdelijk niet beschikbaar. Probeer het straks opnieuw. Je kunt wel lokale voeding gebruiken of zelf voeding toevoegen.",
			incomplete:
				"Dit product heeft te weinig voedingsgegevens om te importeren.",
			invalid: "De gegevens van dit product konden niet worden gelezen.",
		},
		personalFood: {
			createTitle: "Persoonlijk voedingsmiddel maken",
			editTitle: "Persoonlijk voedingsmiddel bewerken",
			resultLabel: "Persoonlijk voedingsmiddel",
			storageTitle: "Lokale opslag en optionele reservekopie",
			storageBody:
				"Persoonlijke voedingsmiddelen staan lokaal. Schakel accountreservekopie in via Meer voedingsfuncties om ze te bewaren en op een ander apparaat te herstellen. Zonder reservekopie kunnen ze bij het verwijderen van Workouts verloren gaan.",
			nameEn: "Engelse naam",
			nameNl: "Nederlandse naam",
			baseUnit: "Basiseenheid voedingswaarde",
			grams: "Gram",
			millilitres: "Milliliter",
			per100: "Voedingswaarde per 100",
			states: {
				absent: "Niet beschikbaar",
				trace: "Spoor",
				value: "Hoeveelheid",
			},
			servings: "Porties",
			servingsHelp:
				"Voeg maximaal drie bekende hoeveelheden in de basiseenheid toe.",
			englishLabel: "Engels label",
			dutchLabel: "Nederlands label",
			amountIn: "hoeveelheid in",
			addServing: "Portie toevoegen",
			removeServing: "Portie verwijderen",
			save: "Persoonlijk voedingsmiddel opslaan",
			saving: "Persoonlijk voedingsmiddel opslaan…",
			cancel: "Annuleren",
			deleteTitle: "Dit persoonlijke voedingsmiddel verwijderen?",
			deleteBody:
				"Bestaande dagboekitems behouden hun opgeslagen momentopname.",
			delete: "Persoonlijk voedingsmiddel verwijderen",
			deleteFailure:
				"Dit persoonlijke voedingsmiddel kon niet worden verwijderd.",
			validation: "Controleer de waarden van het persoonlijke voedingsmiddel.",
			saveFailure:
				"Dit persoonlijke voedingsmiddel kon niet worden opgeslagen. Je wijzigingen staan er nog.",
		},
		combos: {
			create: "Combo maken",
			log: "Combo loggen",
			storageTitle: "Lokale opslag en optionele reservekopie",
			storageBody:
				"Combo's zijn offline beschikbaar. Schakel accountreservekopie in via Meer voedingsfuncties om ze te bewaren en elders te herstellen. Zonder reservekopie kunnen ze bij verwijderen verloren gaan. Dagboekitems synchroniseren afzonderlijk zodra je verbonden bent.",
			name: "Naam van Combo",
			save: "Combo opslaan",
			saving: "Combo opslaan…",
			saved: "Combo opgeslagen.",
			saveFailure:
				"Deze Combo kon niet worden opgeslagen. Je naam en selectie staan er nog.",
			selectionHelp:
				"Kies afzonderlijke dagboekitems. Maaltijdvakken worden nooit automatisch geselecteerd.",
			selectEntry: "Selecteer {name} voor Combo",
			cancel: "Annuleren",
			continueOne: "Ga verder met 1 onderdeel",
			continueMany: "Ga verder met {count} onderdelen",
			destination: "Loggen bij maaltijd",
			logOne: "Log 1 onderdeel",
			logMany: "Log {count} onderdelen",
			logging: "Combo loggen…",
			logFailure:
				"Deze Combo kon niet worden gelogd. Je selectie staat er nog.",
			partsOne: "1 onderdeel",
			partsMany: "{count} onderdelen",
			needsAttention: "Aandacht nodig",
			missing: "Bron ontbreekt",
			missingBody:
				"Een opgeslagen voedingsmiddel staat niet meer op dit apparaat. Het is niet automatisch vervangen. Verwijder niet-beschikbare onderdelen, verwijder deze Combo of maak hem opnieuw met de gewenste items.",
			resolveTitle: "Niet-beschikbare onderdelen verwijderen?",
			resolveBody:
				"Alleen onderdelen waarvan de oorspronkelijke bron nog beschikbaar is, blijven in deze Combo staan.",
			resolve: "Niet-beschikbare onderdelen verwijderen",
			resolveFailure:
				"De niet-beschikbare onderdelen konden niet worden verwijderd.",
			emptyTitle: "Nog geen Combo's",
			emptyBody:
				"Maak er een door afzonderlijke items in je dagboek te selecteren.",
			deleteTitle: "Deze Combo verwijderen?",
			deleteBody:
				"Eerder gelogde groepen behouden hun opgeslagen voedingswaarden.",
			delete: "Combo verwijderen",
			deleting: "Combo verwijderen…",
			deleteFailure: "Deze Combo kon niet worden verwijderd.",
			expandGroup: "Klap Combo {name} uit",
			collapseGroup: "Klap Combo {name} in",
		},

		/** Zie de Engelse toelichting bij `fork`. */
		fork: {
			correct: "Dit voedingsmiddel corrigeren",
			title: "Meegeleverd voedingsmiddel corrigeren",
			intro:
				"Dit slaat je eigen kopie op. Het meegeleverde voedingsmiddel blijft zoals het is gepubliceerd en jouw kopie vervangt het in de gewone zoekresultaten.",
			resultLabel: "Jouw correctie",
			forkedFrom: "Jouw correctie van {name}",
			locallyEdited: "Je hebt deze waarden aangepast.",
			unchanged: "Je hebt deze waarden nog niet aangepast.",
			shadowed: "Vervangen door jouw correctie",
			deleteTitle: "Deze correctie verwijderen?",
			deleteBody:
				"Het meegeleverde voedingsmiddel komt terug in de zoekresultaten. Dagboekitems behouden de voedingswaarde waarmee ze zijn vastgelegd.",
		},

		offline: {
			title: "Je dagboek voor deze dag staat nog niet op deze telefoon",
			body: "Het verschijnt zodra je weer online bent. Je kunt nu al eten zoeken en toevoegen — items worden verstuurd zodra je weer verbinding hebt.",
			slot: "Niet beschikbaar zonder verbinding",
		},

		entryActions: {
			menuTitle: "{name}",
			close: "Sluiten",
			edit: "Wijzig",
			delete: "Verwijder",
		},

		entryEditor: {
			title: "Item bewerken",
			editEntry: "Item bewerken: {name}",
			meal: "Maaltijd",
			date: "Datum",
			save: "Wijzigingen opslaan",
			saving: "Opslaan…",
			saveFailure:
				"Dit item kon niet worden bijgewerkt. Je wijzigingen staan er nog.",
			delete: "Item verwijderen",
			deleting: "Verwijderen…",
			deleteFailure:
				"Dit item kon niet worden verwijderd. Het staat nog in je dagboek.",
			deleteConfirmTitle: "Dit item verwijderen?",
			deleteConfirmMessage: "{name} wordt verwijderd uit {meal} op {date}.",
			keepEntry: "Item behouden",
		},

		otherNutrients: {
			heading: "Overige voedingsstoffen",
			show: "Toon overige voedingsstoffen",
			hide: "Verberg overige voedingsstoffen",
		},

		nutrients: {
			energy: "Energie",
			protein: "Eiwitten",
			carbs: "Koolhydraten",
			fat: "Vet",
			saturatedFat: "Verzadigd vet",
			fibre: "Vezels",
			sugars: "Suikers",
			salt: "Zout",
		},

		units: {
			kcal: "kcal",
			g: "g",
		},

		attribution: {
			nevo: "Voedingswaarden bevatten gegevens uit NEVO 2025/9.0.",
			salt: "Zout wordt door Appelent afgeleid uit het natrium in de bron.",
			incomplete: "Totalen worden gemarkeerd wanneer bronwaarden ontbreken.",
		},

		error: {
			title: "Deze dag kon niet worden geopend",
			body: "Er ging iets mis bij het opbouwen van dit scherm.",
		},
	},
} satisfies typeof en;
