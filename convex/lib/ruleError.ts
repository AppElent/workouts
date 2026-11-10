import { isRuleError } from "@foundry/core";
import { ConvexError } from "convex/values";

/**
 * Runs a core rule and rethrows its `RuleError` as `ConvexError({ code,
 * field })`, which reaches the client verbatim for it to localize.
 */
export function withRuleErrors<T>(compute: () => T): T {
	try {
		return compute();
	} catch (error) {
		if (isRuleError(error))
			throw new ConvexError({ code: error.code, field: error.field });
		throw error;
	}
}
