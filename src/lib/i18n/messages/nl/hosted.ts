import type { hosted as hostedEn } from "../en/hosted";

export const hosted: typeof hostedEn = {
	paused: {
		title: "Groepstrainingen staan op pauze",
		description:
			"Groepstrainingen hosten en eraan meedoen kan voorlopig niet. Je eigen trainingen, WODs en scores blijven gewoon staan.",
		home: "Naar Foundry",
	},
	join: {
		loading: "Laden...",
		notFound: "Groepstraining niet gevonden.",
		status: {
			draft: "Concept",
			open: "Open",
			closed: "Gesloten",
		},
		yourName: "Je naam",
		namePlaceholder: "Naam op de ranglijst",
		join: "Doe mee",
		joining: "Bezig met meedoen...",
		joinFailed: "Meedoen is niet gelukt.",
		signIn: "Log in om mee te doen",
		closed: "Deze training is gesloten. De scores staan vast.",
		notStarted:
			"Deze training is nog niet begonnen. Kom terug zodra de host hem opent.",
		host: "Host",
		signedInAthlete: "Ingelogde atleet",
	},
	guest: {
		name: "Gastnaam",
		namePlaceholder: "Naam op de ranglijst",
		submit: "Gastscore insturen",
	},
	blocks: {
		strength: "Kracht",
		timeCap: "Tijdslimiet {time}",
		minutes: "{count} min",
		noMovements: "Geen oefeningen",
		rank: "#",
		athlete: "Atleet",
		level: "Niveau",
		score: "Score",
		noScores: "Nog geen scores.",
		removeScore: "Score verwijderen",
	},
	scoreForm: {
		title: "Score insturen",
		submit: "Score insturen",
		submitHosted: "Groepsscore insturen",
		submitting: "Bezig met insturen...",
		submitted: "Score ingestuurd.",
		failed: "Score insturen is niet gelukt.",
		wod: "WOD",
		notes: "Notities (optioneel)",
		noWods: "Deze groepstraining heeft geen WOD-scores om in te sturen.",
	},
	claim: {
		title: { one: "Bewaar je gastscore", other: "Bewaar je gastscores" },
		signedIn: {
			one: "Zet je gastscore van dit apparaat in je trainingshistorie.",
			other: "Zet je gastscores van dit apparaat in je trainingshistorie.",
		},
		signedInShared:
			"Meerdere mensen hebben op dit apparaat gescoord. Zet alleen de scores onder je eigen naam in je trainingshistorie.",
		signedOut: {
			one: "Maak een gratis account om je gastscore in je eigen trainingshistorie te bewaren.",
			other:
				"Maak een gratis account om je gastscores in je eigen trainingshistorie te bewaren.",
		},
		add: "Zet in mijn historie",
		addAs: "Ik ben {name} ({count})",
		adding: "Bezig...",
		createAccount: "Account maken",
		failed: "Je scores konden niet worden toegevoegd. Probeer het opnieuw.",
	},
};
