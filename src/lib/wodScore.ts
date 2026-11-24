import {
	buildWodScore,
	type RuleIssue,
	validateWodScore,
	type WodScoreCode,
	type WodScoreField,
	type WodScoreFields,
	type WodScoreInput,
	type WodType,
} from "@foundry/core";

/** Why a WOD score can't be submitted; the catalog's `wods.scoreErrors` words each one. */
export type WodScoreError =
	| "timeRequired"
	| "cappedRepsRequired"
	| "roundsOrRepsRequired"
	| "repsOrRoundsRequired"
	| "loadRequired"
	| "loadUnitRequired"
	| "timeOutOfRange"
	| "roundsOutOfRange"
	| "repsOutOfRange"
	| "loadOutOfRange";

const REQUIRED: Record<WodType, (field: WodScoreField) => WodScoreError> = {
	forTime: (field) =>
		field === "reps" ? "cappedRepsRequired" : "timeRequired",
	amrap: () => "roundsOrRepsRequired",
	emom: () => "repsOrRoundsRequired",
	load: (field) => (field === "loadUnit" ? "loadUnitRequired" : "loadRequired"),
};

const OUT_OF_RANGE: Record<
	Exclude<WodScoreField, "loadUnit">,
	WodScoreError
> = {
	timeSeconds: "timeOutOfRange",
	rounds: "roundsOutOfRange",
	reps: "repsOutOfRange",
	load: "loadOutOfRange",
};

function issueError(
	type: WodType,
	{ field, code }: RuleIssue<WodScoreField, WodScoreCode>,
): WodScoreError {
	if (code === "required" || field === "loadUnit") return REQUIRED[type](field);
	return OUT_OF_RANGE[field];
}

/** The score a WOD form submits, or the first reason it can't be submitted. */
export function wodScoreFromForm(
	type: WodType,
	fields: WodScoreFields,
): { ok: true; score: WodScoreInput } | { ok: false; error: WodScoreError } {
	const result = validateWodScore(type, buildWodScore(type, fields));
	return result.ok
		? { ok: true, score: result.value }
		: { ok: false, error: issueError(type, result.errors[0]) };
}
