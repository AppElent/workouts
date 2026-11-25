import type { WodTimingField, WodType } from "@foundry/core";
import type { WodScoreError } from "#/lib/wodScore";

export const wods = {
	type: {
		forTime: "For Time",
		amrap: "AMRAP",
		emom: "EMOM",
		load: "Load",
	} satisfies Record<WodType, string>,
	timing: {
		timeCapSeconds: "Time cap",
		durationSeconds: "Duration",
	} satisfies Record<WodTimingField, string>,
	timingMinutes: {
		timeCapSeconds: "Time cap (min)",
		durationSeconds: "Duration (min)",
	} satisfies Record<WodTimingField, string>,
	timingAria: {
		timeCapSeconds: "WOD {number} time cap in minutes",
		durationSeconds: "WOD {number} duration in minutes",
	} satisfies Record<WodTimingField, string>,
	score: {
		reps: "Reps",
		rounds: "Rounds",
		minutes: "Min",
		seconds: "Sec",
		minutesUnit: "min",
		secondsUnit: "sec",
		load: "Load",
		loadUnit: "Load unit",
		timeCapped: "Hit the time cap (didn't finish)",
	},
	scoreErrors: {
		timeRequired: "Time is required for this WOD.",
		cappedRepsRequired: "Reps are required for capped scores.",
		roundsOrRepsRequired: "Rounds or reps are required for this WOD.",
		repsOrRoundsRequired: "Completed reps or rounds are required for this WOD.",
		loadRequired: "Load is required for this WOD.",
		loadUnitRequired: "Load unit is required for this WOD.",
		timeOutOfRange: "Time is out of range.",
		roundsOutOfRange: "Rounds is out of range.",
		repsOutOfRange: "Reps is out of range.",
		loadOutOfRange: "Load is out of range.",
	} satisfies Record<WodScoreError, string>,
	logResult: {
		title: "Log Result",
		submit: "Log Result",
		notes: "Notes (optional)",
		failed: "Failed to log result.",
	},
};
