import { type RuleResult, ruleIssues } from "../rules";

/**
 * The nutrient vocabulary for the Nutrition module.
 *
 * These keys are the single spelling used by `@foundry/core`, Convex, the
 * device SQLite schema and the message trees (spec #68, D7). British `fibre`
 * is deliberate; so is `carbs` over `carbohydrates`.
 */

/** The eight nutrients a person can see, total and set a goal for. */
export const NUTRIENT_KEYS = [
	"energy",
	"protein",
	"carbs",
	"fat",
	"saturatedFat",
	"fibre",
	"sugars",
	"salt",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/**
 * Sodium rides along on shipped foods so the salt figure stays traceable to
 * the number NEVO actually published. It is not one of the eight and is not
 * targetable — nothing should offer a sodium goal.
 */
export const SHIPPED_NUTRIENT_KEYS = [...NUTRIENT_KEYS, "sodium"] as const;

export type ShippedNutrientKey = (typeof SHIPPED_NUTRIENT_KEYS)[number];

type NutrientUnit = "kcal" | "g" | "mg";

export const NUTRIENT_UNITS: Readonly<
	Record<ShippedNutrientKey, NutrientUnit>
> = Object.freeze({
	energy: "kcal",
	protein: "g",
	carbs: "g",
	fat: "g",
	saturatedFat: "g",
	fibre: "g",
	sugars: "g",
	salt: "g",
	sodium: "mg",
});

/**
 * A nutrient figure, or the reason there isn't one (spec #68, D8).
 *
 * - `value` — a real figure, stored unrounded per 100 base units.
 * - `trace` — the source says "present in trace amounts". Contributes numeric
 *   zero to a total while marking that total as qualified.
 * - `absent` — the source has no figure. Never render this as 0.
 *
 * The three states stay distinct all the way from generation through
 * aggregation to the screen; collapsing trace or absent into 0 is the failure
 * mode the spec names in six user stories.
 */
export type NutrientValue =
	| { readonly kind: "value"; readonly amount: number }
	| { readonly kind: "trace" }
	| { readonly kind: "absent" };

/** Shared singletons — a food with an absent nutrient allocates nothing extra. */
export const ABSENT: NutrientValue = Object.freeze({ kind: "absent" as const });
export const TRACE: NutrientValue = Object.freeze({ kind: "trace" as const });

export function nutrientValue(amount: number): NutrientValue {
	return Object.freeze({ kind: "value" as const, amount });
}

export function isValue(
	value: NutrientValue,
): value is { kind: "value"; amount: number } {
	return value.kind === "value";
}

/**
 * The number a `value` carries, or 0 for trace. Absent has no number at all and
 * returns `undefined` so callers cannot accidentally read it as zero.
 */
export function numericAmount(value: NutrientValue): number | undefined {
	if (value.kind === "value") return value.amount;
	if (value.kind === "trace") return 0;
	return undefined;
}

/**
 * Decimal places for presentation only. Storage stays unrounded: rounding at
 * generation would compound across a day's worth of entries.
 */
export const NUTRIENT_DISPLAY_DECIMALS: Readonly<
	Record<ShippedNutrientKey, number>
> = Object.freeze({
	energy: 0,
	protein: 1,
	carbs: 1,
	fat: 1,
	saturatedFat: 1,
	fibre: 1,
	sugars: 1,
	// Salt figures are small (a slice of bread is ~0.4 g) and one decimal hides
	// the difference between foods, so salt gets two.
	salt: 2,
	sodium: 0,
});

/** Round a stored amount for display. Returns a number, not a string. */
export function roundForDisplay(
	key: ShippedNutrientKey,
	amount: number,
): number {
	const factor = 10 ** NUTRIENT_DISPLAY_DECIMALS[key];
	return Math.round(amount * factor) / factor;
}

/**
 * Scale a stored nutrient reading by a positive ratio.
 *
 * `trace` and `absent` are invariant under scaling: the source never gave a
 * number for either, so no ratio can produce one. Only `value` carries an
 * amount to rescale. This is what lets a diary entry's quantity change without
 * ever consulting the food it came from (spec #68, ticket #73) — the snapshot
 * scales itself.
 */
export function scaleNutrient(
	value: NutrientValue,
	factor: number,
): NutrientValue {
	if (value.kind !== "value") return value;
	return nutrientValue(value.amount * factor);
}

/** `scaleNutrient` across a full set of nutrient readings, keyed any way. */
export function rescaleNutrients<K extends string>(
	nutrients: Readonly<Record<K, NutrientValue>>,
	factor: number,
): Record<K, NutrientValue> {
	const scaled = {} as Record<K, NutrientValue>;
	for (const key of Object.keys(nutrients) as K[]) {
		scaled[key] = scaleNutrient(nutrients[key], factor);
	}
	return scaled;
}

/** Kilojoules in one kilocalorie (thermochemical calorie). */
export const KJ_PER_KCAL = 4.184;

/** Kilocalories from kilojoules, to a tenth: the precision energy is stored at. */
export function kcalFromKilojoules(kilojoules: number): number {
	return Math.round((kilojoules / KJ_PER_KCAL) * 10) / 10;
}

type NutrientValueCode = "invalid" | "negative";

/** One stored nutrient reading, or why it is not one. */
export function checkNutrientValue(
	value: unknown,
): { ok: true; value: NutrientValue } | { ok: false; code: NutrientValueCode } {
	if (!value || typeof value !== "object" || !("kind" in value))
		return { ok: false, code: "invalid" };
	if (value.kind === "absent") return { ok: true, value: ABSENT };
	if (value.kind === "trace") return { ok: true, value: TRACE };
	if (value.kind !== "value" || !("amount" in value))
		return { ok: false, code: "invalid" };
	const { amount } = value;
	if (typeof amount !== "number" || !Number.isFinite(amount))
		return { ok: false, code: "invalid" };
	if (amount < 0) return { ok: false, code: "negative" };
	return { ok: true, value: { kind: "value", amount } };
}

/**
 * All eight nutrients as stored readings: every key present, each a value
 * (finite, not negative), trace or absent.
 */
export function validateNutrientValues(
	nutrients: unknown,
): RuleResult<
	Record<NutrientKey, NutrientValue>,
	NutrientKey,
	NutrientValueCode
> {
	const issues = ruleIssues<NutrientKey, NutrientValueCode>();
	const values = {} as Record<NutrientKey, NutrientValue>;
	const source =
		nutrients && typeof nutrients === "object"
			? (nutrients as Record<string, unknown>)
			: {};
	for (const key of NUTRIENT_KEYS) {
		const checked = checkNutrientValue(source[key]);
		if (checked.ok) values[key] = checked.value;
		else issues.add(key, checked.code);
	}
	return issues.result(values);
}
