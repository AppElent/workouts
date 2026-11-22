import type { wods as wodsEn } from "../en/wods";

export const wods: typeof wodsEn = {
	type: {
		forTime: "Op tijd",
		amrap: "AMRAP",
		emom: "EMOM",
		load: "Gewicht",
	},
	timing: {
		timeCapSeconds: "Tijdslimiet",
		durationSeconds: "Duur",
	},
	timingMinutes: {
		timeCapSeconds: "Tijdslimiet (min)",
		durationSeconds: "Duur (min)",
	},
	timingAria: {
		timeCapSeconds: "WOD {number} tijdslimiet in minuten",
		durationSeconds: "WOD {number} duur in minuten",
	},
	score: {
		reps: "Herh.",
		rounds: "Rondes",
		minutes: "Min",
		seconds: "Sec",
		minutesUnit: "min",
		secondsUnit: "sec",
		load: "Gewicht",
		loadUnit: "Gewichtseenheid",
		timeCapped: "Tijdslimiet gehaald (niet afgemaakt)",
	},
	scoreErrors: {
		timeRequired: "Vul een tijd in voor deze WOD.",
		cappedRepsRequired: "Vul de herhalingen in als je de tijdslimiet haalde.",
		roundsOrRepsRequired: "Vul rondes of herhalingen in voor deze WOD.",
		repsOrRoundsRequired:
			"Vul de voltooide herhalingen of rondes in voor deze WOD.",
		loadRequired: "Vul een gewicht in voor deze WOD.",
		loadUnitRequired: "Kies een gewichtseenheid voor deze WOD.",
		timeOutOfRange: "De tijd valt buiten het bereik.",
		roundsOutOfRange: "Het aantal rondes valt buiten het bereik.",
		repsOutOfRange: "Het aantal herhalingen valt buiten het bereik.",
		loadOutOfRange: "Het gewicht valt buiten het bereik.",
	},
	logResult: {
		title: "Resultaat vastleggen",
		submit: "Resultaat vastleggen",
		notes: "Notities (optioneel)",
		failed: "Resultaat vastleggen is niet gelukt.",
	},
};
