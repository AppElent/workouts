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
	toast: {
		dismiss: "Melding sluiten",
	},
} satisfies typeof enShell;
