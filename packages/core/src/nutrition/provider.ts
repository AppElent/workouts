import { ABSENT, type NutrientValue, nutrientValue, TRACE } from "./nutrients";

/**
 * Normalise a remote provider's free-text nutrient field to a plain
 * non-negative number in its stated unit, or `undefined` if it cannot be
 * read. Ported from gather's `parseNutritionValue`
 * (`convex/lib/nutrition.ts`, spec #68 D24) — real-world provider text looks
 * like "250 kcal", "12,5 g" (Dutch decimal comma), "1,200 kcal" (US thousands
 * comma), "1046 kJ", or "740 mg". Unparseable input never throws.
 */
export function parseProviderNumber(raw: unknown): number | undefined {
	if (typeof raw === "number") {
		return Number.isFinite(raw) && raw >= 0 ? raw : undefined;
	}
	if (typeof raw !== "string") return undefined;
	if (/-\s*\d/.test(raw)) return undefined;
	const match = /(\d+(?:[.,]\d+)?)/.exec(raw);
	if (!match) return undefined;
	// Comma before exactly three digits reads as a thousands separator
	// ("1,200 kcal" → 1200); otherwise it's a decimal comma ("12,5" → 12.5).
	const numText = /^\d+,\d{3}$/.test(match[1])
		? match[1].replace(",", "")
		: match[1].replace(",", ".");
	const value = Number(numText);
	if (!Number.isFinite(value) || value < 0) return undefined;
	if (/mg/i.test(raw) || /milligram/i.test(raw)) {
		return Math.round((value / 1000) * 100) / 100;
	}
	if (/kj/i.test(raw)) return Math.round((value / 4.184) * 10) / 10;
	return value;
}

/**
 * The literal words a provider uses for "present but unmeasurable" instead of
 * a number. Only an explicit word counts — a provider that omits a field
 * entirely is `absent`, not `trace` (spec #68 D8: the two are never the same
 * failure mode).
 */
const TRACE_WORDS = /^\s*(trace|traces|sporen)\s*$/i;

/**
 * Turn one provider nutrient field into a `NutrientValue`, preserving the
 * value/trace/absent distinction (D8) instead of collapsing a missing or
 * unmeasurable reading into zero.
 */
export function parseProviderNutrient(raw: unknown): NutrientValue {
	if (raw === undefined || raw === null || raw === "") return ABSENT;
	if (typeof raw === "string" && TRACE_WORDS.test(raw)) return TRACE;
	const amount = parseProviderNumber(raw);
	return amount === undefined ? ABSENT : nutrientValue(amount);
}
