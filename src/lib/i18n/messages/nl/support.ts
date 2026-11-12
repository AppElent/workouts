import type { support as supportEn } from "../en/support";

export const support: typeof supportEn = {
	title: "Support",
	back: "Terug naar home",
	intro:
		"Vragen, bugs of feedback over Foundry? Mail naar privacy@appelent.nl; we reageren meestal binnen twee werkdagen.",
	contactLabel: "Mail support",
	faq: {
		title: "Veelgestelde vragen",
		items: {
			signIn: {
				q: "Hoe log ik in?",
				a: "Met e-mail en wachtwoord, een e-mailcode, Apple of Microsoft. Hetzelfde account werkt in de app en op het web.",
			},
			oneRm: {
				q: "Hoe schat Foundry mijn 1RM?",
				a: "Elke gelogde set geeft een geschatte one-rep max. Vul een geteste 1RM in om sets als percentage daarvan te plannen.",
			},
			food: {
				q: "Waar komt de voedingsdata vandaan?",
				a: "Uit de NEVO-tabel, Open Food Facts en producten die je zelf toevoegt. AI-hulp stelt invoer voor die je controleert voordat je opslaat.",
			},
			export: {
				q: "Hoe exporteer of verwijder ik mijn gegevens?",
				a: "Open in de app Profiel > Account. Daar kun je al je gegevens exporteren of je account verwijderen.",
			},
		},
	},
	privacyLink: "Privacyverklaring",
};
