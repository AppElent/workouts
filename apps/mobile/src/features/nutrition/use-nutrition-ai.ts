import { fmt, NUTRITION_AI_LIMITS, parseConvexError } from "@foundry/core";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/api";
import { useOnline } from "../../convex/online";
import {
	PREFERENCE_KEYS,
	readLocal,
	writeLocal,
} from "../../local-store/local-store";

/** Why an AI call did not produce a result, as the screens explain it. */
export type NutritionAiFailure =
	| "offline"
	| "limit"
	| "unavailable"
	| "tooLarge"
	| "timeout"
	| "failed";

/** An answer later than this is treated as failed; the input stays. */
export const AI_TIMEOUT_MS = 30_000;
/** A web lookup searches several pages first. */
export const AI_WEB_TIMEOUT_MS = 75_000;

const TIMED_OUT = "nutrition-ai-timeout";

export function withAiTimeout<T>(call: Promise<T>, ms = AI_TIMEOUT_MS) {
	let timer: ReturnType<typeof setTimeout>;
	return Promise.race([
		call,
		new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error(TIMED_OUT)), ms);
		}),
	]).finally(() => clearTimeout(timer));
}

export function nutritionAiFailure(
	error: unknown,
): Exclude<NutritionAiFailure, "offline"> {
	if (error instanceof Error && error.message === TIMED_OUT) return "timeout";
	const { code } = parseConvexError(error);
	return code === "limit" || code === "unavailable" || code === "tooLarge"
		? code
		: "failed";
}

/** The daily-quota notice, naming the server's quota. */
export function aiLimitTitle(template: string): string {
	return fmt(template, { count: NUTRITION_AI_LIMITS.dailyAnalyses });
}

/** Coded refusals (quota, too large, signed out) fail the same way again. */
export function worthRetrying(error: unknown): boolean {
	return parseConvexError(error).code === undefined;
}

/**
 * The three AI actions plus what every caller needs around them: one-time
 * consent kept on this phone, and whether the backend is reachable at all.
 */
export function useNutritionAi() {
	const describe = useAction(api.nutritionAi.describe);
	const choose = useAction(api.nutritionAi.choose);
	const readLabel = useAction(api.nutritionAi.readLabel);
	const online = useOnline();
	const [consented, setConsented] = useState(
		() => readLocal(PREFERENCE_KEYS.nutritionAiConsent) === "granted",
	);
	return {
		describe,
		choose,
		readLabel,
		online: online,
		consented,
		grantConsent: () => {
			writeLocal(PREFERENCE_KEYS.nutritionAiConsent, "granted");
			setConsented(true);
		},
	};
}
