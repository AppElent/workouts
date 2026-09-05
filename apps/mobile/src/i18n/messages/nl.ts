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

		goals: {
			heading: "Doelen",
			empty: {
				title: "Nog geen doelen",
				body: "Stel een dagelijkse hoeveelheid in voor de voedingsstoffen die jij belangrijk vindt; de dag vult zich daarna vanzelf.",
				action: "Doelen instellen",
			},
			unavailable: "Doelen instellen komt in de volgende update.",
			progress: "{total} van {target} {unit}",
			state: {
				neutral: "Niets gelogd",
				under: "Onder",
				met: "Gehaald",
				within: "Binnen",
				exceeded: "Over",
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
