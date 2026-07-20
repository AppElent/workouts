import type { common as enCommon } from "../en/common";

export const common = {
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
