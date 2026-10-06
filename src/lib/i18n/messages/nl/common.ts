import type { common as enCommon } from "../en/common";

export const common = {
	feedback: {
		attachmentError:
			"Kies een PNG-, JPEG- of WebP-afbeelding kleiner dan 5 MB.",
		report: "Probleem melden",
		description:
			"Beschrijf wat er gebeurde. Screenshots zijn optioneel; verwijder persoonlijke informatie voordat je ze verstuurt.",
		submit: "Melding versturen",
		cancel: "Annuleren",
		add: "Screenshot toevoegen",
		take: "Screenshot maken",
		remove: "Screenshot verwijderen",
		error: "Je melding kon niet worden verstuurd. Probeer het opnieuw.",
		success: "Bedankt voor je melding!",
		message: "Wat gebeurde er?",
		placeholder: "Wat gebeurde er en wat verwachtte je?",
		trigger: "Het meldformulier kon niet worden geopend. Probeer het opnieuw.",
	},
	actions: {
		start: "Start",
		cancel: "Annuleren",
		close: "Sluiten",
		save: "Opslaan",
		delete: "Verwijderen",
		copy: "Kopiëren",
		copied: "Gekopieerd!",
		retry: "Opnieuw proberen",
		back: "Terug",
	},
	errors: {
		somethingWentWrong: "Er ging iets mis. Probeer het opnieuw.",
		notFound: "Niet gevonden.",
		loading: "Laden…",
	},
	header: {
		switchLanguage: "Overschakelen naar {language}",
	},
} satisfies typeof enCommon;
