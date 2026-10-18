import { useAction, useConvexConnectionState } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { api } from "../../convex/api";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../../prefs/local-preference";

/** Why an AI call did not produce a result, as the screens explain it. */
export type NutritionAiFailure =
	| "offline"
	| "limit"
	| "unavailable"
	| "tooLarge"
	| "failed";

export function nutritionAiFailure(error: unknown): NutritionAiFailure {
	const code = error instanceof ConvexError ? error.data : null;
	return code === "limit" || code === "unavailable" || code === "tooLarge"
		? code
		: "failed";
}

/**
 * The three AI actions plus what every caller needs around them: one-time
 * consent kept on this phone, and whether the backend is reachable at all.
 */
export function useNutritionAi() {
	const describe = useAction(api.nutritionAi.describe);
	const choose = useAction(api.nutritionAi.choose);
	const readLabel = useAction(api.nutritionAi.readLabel);
	const { isWebSocketConnected } = useConvexConnectionState();
	const [consented, setConsented] = useState(
		() => readPreference(PREFERENCE_KEYS.nutritionAiConsent) === "granted",
	);
	return {
		describe,
		choose,
		readLabel,
		online: isWebSocketConnected,
		consented,
		grantConsent: () => {
			writePreference(PREFERENCE_KEYS.nutritionAiConsent, "granted");
			setConsented(true);
		},
	};
}
