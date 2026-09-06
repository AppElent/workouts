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
			showMore: "Toon meer voedingsmiddelen",
			promotedResults: "Alledaagse voeding",
			allResults: "Alle NEVO-voedingsmiddelen",
			empty: "Geen voedingsmiddelen gevonden.",
			per100: "Voedingswaarde per 100",
			serving: "Portie",
			quantity: "Aantal",
			trace: "Spoor",
			absent: "Niet beschikbaar",
			log: "Eten loggen",
			logging: "Eten loggen…",
			logFailure: "Dit eten kon niet worden gelogd. Je selectie staat er nog.",
		},
		personalFood: {
			createTitle: "Persoonlijk voedingsmiddel maken",
			editTitle: "Persoonlijk voedingsmiddel bewerken",
			resultLabel: "Persoonlijk voedingsmiddel",
			storageTitle: "Alleen op dit apparaat opgeslagen",
			storageBody:
				"Persoonlijke voedingsmiddelen verschijnen niet op een tweede apparaat en kunnen verloren gaan als je Workouts verwijdert. Platformback-up wordt alleen naar beste vermogen uitgevoerd.",
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
			storageTitle: "Alleen op dit apparaat opgeslagen",
			storageBody:
				"Combo's zijn offline beschikbaar op dit apparaat, verschijnen niet op een tweede apparaat en kunnen verloren gaan als je Workouts verwijdert. Loggen synchroniseert met je dagboek zodra je verbonden bent.",
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
				"Een opgeslagen voedingsmiddel staat niet meer op dit apparaat. Het is niet automatisch vervangen. Verwijder deze Combo of maak hem opnieuw met de gewenste items.",
			emptyTitle: "Nog geen Combo's",
			emptyBody:
				"Maak er een door afzonderlijke items in je dagboek te selecteren.",
			deleteTitle: "Deze Combo verwijderen?",
			deleteBody:
				"Eerder gelogde groepen behouden hun opgeslagen voedingswaarden.",
			delete: "Combo verwijderen",
			deleteFailure: "Deze Combo kon niet worden verwijderd.",
			expandGroup: "Klap Combo {name} uit",
			collapseGroup: "Klap Combo {name} in",
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
