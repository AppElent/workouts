import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	scaleNutrient,
} from "./nutrients";
import type { NutritionDiarySnapshot } from "./operations";

/** Values use an explicit amount basis; retries and concurrent quantity edits never drift. */
export type DiaryNutrientCorrection = {
	readonly baseUnit: NutritionDiarySnapshot["baseUnit"];
	readonly basisAmount: number;
	readonly nutrients: Readonly<Partial<Record<NutrientKey, NutrientValue>>>;
};

export function correctDiaryNutrients(
	entry: Pick<
		NutritionDiarySnapshot,
		"amount" | "baseUnit" | "nutrients" | "correctedNutrients"
	>,
	correction: DiaryNutrientCorrection,
) {
	if (entry.baseUnit !== correction.baseUnit)
		throw new Error("Nutrition correction units do not match.");
	if (!Number.isFinite(correction.basisAmount) || correction.basisAmount <= 0)
		throw new Error("Correction amount must be positive.");
	const keys = Object.keys(correction.nutrients);
	if (!keys.length || keys.some((key) => !NUTRIENT_KEYS.some((n) => n === key)))
		throw new Error("Choose a nutrient to correct.");
	const nutrients = { ...entry.nutrients };
	const corrected = new Set(entry.correctedNutrients ?? []);
	for (const key of NUTRIENT_KEYS) {
		const value = correction.nutrients[key];
		if (!value) continue;
		if (
			value.kind === "value" &&
			(!Number.isFinite(value.amount) || value.amount < 0)
		)
			throw new Error("Nutrient amount must be finite and nonnegative.");
		if (!["value", "trace", "absent"].includes(value.kind))
			throw new Error("Invalid nutrient state.");
		nutrients[key] = scaleNutrient(
			value,
			entry.amount / correction.basisAmount,
		);
		corrected.add(key);
	}
	return { nutrients, correctedNutrients: [...corrected] };
}
