import type { shell as enShell } from "../en/shell";

export const shell = {
	activeSession: {
		fallbackName: "Actieve training",
		resume: "Hervatten",
	},
	offline: {
		message:
			"Je bent offline — wijzigingen worden gesynchroniseerd zodra je weer verbonden bent",
	},
	routeError: {
		title: "Er is iets misgegaan",
		genericMessage: "Er is een onverwachte fout opgetreden.",
	},
	toast: {
		dismiss: "Melding sluiten",
	},
} satisfies typeof enShell;
