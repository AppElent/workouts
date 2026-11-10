import {
	isRuleError,
	NUTRITION_AI_ERROR_CODES,
	type RuleResult,
	ruleValue,
} from "@foundry/core";
import { ConvexError } from "convex/values";

/**
 * Codes a user-facing failure carries in `ConvexError({ code, field? })`.
 * Core rule failures reach the client the same way with the rule's own code
 * (`tooSmall`, `notStep`, `required`, …) and the field it concerns.
 */
export const APP_ERROR_CODES = [
	"unauthenticated",
	"notFound",
	"readOnly",
	"inUse",
	"duplicate",
	"invalid",
	"required",
	"notPositive",
	"tooLong",
	"tooLarge",
	"accountChanged",
	"operationConflict",
	"partialCombo",
	"recordConflict",
	"recordDeleted",
	"activeSessionExists",
	"sessionEnded",
	"emptySession",
	"unfinishedTargets",
	"hostedNotDraft",
	"hostedNotOpen",
	"hostedClosed",
	"templateEmpty",
	"levelsIncomplete",
	"activeActivity",
	"hostedWorkout",
	"unavailable",
	"failed",
	"limit",
	"empty",
] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

// Nutrition AI clients read their codes from core; each must be an app code.
NUTRITION_AI_ERROR_CODES satisfies readonly AppErrorCode[];

export function appError(code: AppErrorCode, field?: string) {
	return new ConvexError(field === undefined ? { code } : { code, field });
}

/** The value of a passing rule result; a failing one throws its first issue. */
export function checked<T>(result: RuleResult<T>): T {
	return withRuleErrors(() => ruleValue(result));
}

/** Runs a core function that throws `RuleError` and rethrows it coded. */
export function withRuleErrors<T>(compute: () => T): T {
	try {
		return compute();
	} catch (error) {
		if (isRuleError(error))
			throw new ConvexError({ code: error.code, field: error.field });
		throw error;
	}
}
