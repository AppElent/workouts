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

const FIELD_LABELS: Record<WodScoreField, string> = {
	timeSeconds: "Time",
	rounds: "Rounds",
	reps: "Reps",
	load: "Load",
	loadUnit: "Load unit",
};

const REQUIRED_MESSAGES: Record<WodType, (field: WodScoreField) => string> = {
	forTime: (field) =>
		field === "reps"
			? "Reps are required for capped scores."
			: "Time is required for this WOD.",
	amrap: () => "Rounds or reps are required for this WOD.",
	emom: () => "Completed reps or rounds are required for this WOD.",
	load: (field) => `${FIELD_LABELS[field]} is required for this WOD.`,
};

function issueMessage(
	type: WodType,
	{ field, code }: RuleIssue<WodScoreField, WodScoreCode>,
): string {
	return code === "required"
		? REQUIRED_MESSAGES[type](field)
		: `${FIELD_LABELS[field]} is out of range.`;
}

/** The score a WOD form submits, or the first reason it can't be submitted. */
export function wodScoreFromForm(
	type: WodType,
	fields: WodScoreFields,
): { ok: true; score: WodScoreInput } | { ok: false; message: string } {
	const result = validateWodScore(type, buildWodScore(type, fields));
	return result.ok
		? { ok: true, score: result.value }
		: { ok: false, message: issueMessage(type, result.errors[0]) };
}
