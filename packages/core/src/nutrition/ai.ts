/**
 * The contract between the nutrition assistant's Convex actions and the
 * clients that call them.
 */
export const NUTRITION_AI_LIMITS = {
	maxItems: 20,
	maxText: 2000,
	/** Follow-up turns sent with one request; older turns are dropped. */
	maxFollowUps: 10,
	/** Characters in one follow-up. */
	maxFollowUpText: 500,
	/** Characters of the previous result a refinement sends back. */
	maxPreviousText: 16_000,
	/** Library candidates offered for one item when choosing. */
	maxCandidates: 15,
	/** Base64 of a ~2 MB image; the phone resizes to ~1600 px before sending. */
	maxImageBase64: 2_800_000,
} as const;

/** The `ConvexError` data the nutrition assistant's actions throw. */
export const NUTRITION_AI_ERROR_CODES = [
	"unauthenticated",
	"unavailable",
	"failed",
	"tooLarge",
	"limit",
	"empty",
] as const;
export type NutritionAiErrorCode = (typeof NUTRITION_AI_ERROR_CODES)[number];

export function isNutritionAiErrorCode(
	value: unknown,
): value is NutritionAiErrorCode {
	return NUTRITION_AI_ERROR_CODES.some((code) => code === value);
}

export const COOKED_STARCHES = ["oats", "rice", "pasta", "other"] as const;
export type CookedStarch = (typeof COOKED_STARCHES)[number];

/**
 * Plausibility bounds for a starch weighed cooked or dry. The cooked figures
 * are also written into the server's model prompt
 * (convex/lib/nutritionAi.ts), so change both together.
 */
export const NUTRITION_AI_PLAUSIBILITY = {
	maxCookedKcalPer100g: 250,
	minDryKcalPer100g: 200,
	cookedKcalPer100g: { oats: 70, rice: 130, pasta: 150, other: 120 },
} as const satisfies {
	maxCookedKcalPer100g: number;
	minDryKcalPer100g: number;
	cookedKcalPer100g: Record<CookedStarch, number>;
};
