import type { hosted as hostedEn } from "../en/hosted";

export const hosted: typeof hostedEn = {
	paused: {
		title: "Groepstrainingen staan op pauze",
		description:
			"Groepstrainingen hosten en eraan meedoen kan voorlopig niet. Je eigen trainingen, WODs en scores blijven gewoon staan.",
		home: "Naar Foundry",
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
