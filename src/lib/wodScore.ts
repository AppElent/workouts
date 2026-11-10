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

function issueMessage(
	type: WodType,
	{ field, code }: RuleIssue<WodScoreField, WodScoreCode>,
): string {
	if (code !== "required") return `${FIELD_LABELS[field]} is out of range.`;
	if (type === "forTime" && field === "reps")
		return "Reps are required for capped scores.";
	if (type === "amrap") return "Rounds or reps are required for this WOD.";
	if (type === "emom")
		return "Completed reps or rounds are required for this WOD.";
	return `${FIELD_LABELS[field]} is required for this WOD.`;
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
