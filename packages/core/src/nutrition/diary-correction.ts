import { RuleError } from "../rules";
import {
	checkNutrientValue,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	scaleNutrient,
} from "./nutrients";
import type {
	DiaryNutrientCorrection,
	NutritionDiarySnapshot,
} from "./snapshot";

type DiaryCorrectionField =
	| "baseUnit"
	| "basisAmount"
	| "nutrients"
	| NutrientKey;
type DiaryCorrectionCode =
	| "unitMismatch"
	| "notPositive"
	| "required"
	| "invalid"
	| "negative";

/**
 * The entry's nutrients with the correction applied at the entry's amount.
 * Throws `RuleError<DiaryCorrectionField, DiaryCorrectionCode>`.
 */
export function correctDiaryNutrients(
	entry: Pick<
		NutritionDiarySnapshot,
		"amount" | "baseUnit" | "nutrients" | "correctedNutrients"
	>,
	correction: DiaryNutrientCorrection,
): {
	nutrients: Record<NutrientKey, NutrientValue>;
	correctedNutrients: NutrientKey[];
} {
	if (entry.baseUnit !== correction.baseUnit)
		throw new RuleError<DiaryCorrectionField, DiaryCorrectionCode>(
			"baseUnit",
			"unitMismatch",
		);
	if (!Number.isFinite(correction.basisAmount) || correction.basisAmount <= 0)
		throw new RuleError<DiaryCorrectionField, DiaryCorrectionCode>(
			"basisAmount",
			"notPositive",
		);
	const keys = Object.keys(correction.nutrients);
	if (!keys.length || keys.some((key) => !NUTRIENT_KEYS.some((n) => n === key)))
		throw new RuleError<DiaryCorrectionField, DiaryCorrectionCode>(
			"nutrients",
			"required",
		);
	const nutrients = { ...entry.nutrients };
	const corrected = new Set(entry.correctedNutrients ?? []);
	for (const key of NUTRIENT_KEYS) {
		const value = correction.nutrients[key];
		if (!value) continue;
		const checked = checkNutrientValue(value);
		if (!checked.ok)
			throw new RuleError<DiaryCorrectionField, DiaryCorrectionCode>(
				key,
				checked.code,
			);
		nutrients[key] = scaleNutrient(
			checked.value,
			entry.amount / correction.basisAmount,
		);
		corrected.add(key);
	}
	return { nutrients, correctedNutrients: [...corrected] };
}
