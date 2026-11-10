import {
	type AppErrorCode,
	isRuleError,
	type RuleResult,
	ruleValue,
} from "@foundry/core";
import { ConvexError } from "convex/values";

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
