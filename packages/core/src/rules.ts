/**
 * How core reports a broken rule. Core never produces display text: Convex
 * turns a `code` into `ConvexError({ code })` and clients localize it.
 *
 * - `validate*` functions return a `RuleResult`.
 * - Functions that compute from input they expect to be valid (`normalize*`,
 *   rescaling, snapshots) throw a `RuleError` carrying the same `field`/`code`.
 *   `ruleValue` turns a result into that throw; `ruleResult` the other way.
 */
export type RuleIssue<
	Field extends string = string,
	Code extends string = string,
> = {
	readonly field: Field;
	readonly code: Code;
};

export type RuleResult<
	T,
	Field extends string = string,
	Code extends string = string,
> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly errors: readonly RuleIssue<Field, Code>[] };

export class RuleError<
	Field extends string = string,
	Code extends string = string,
> extends Error {
	readonly field: Field;
	readonly code: Code;
	constructor(field: Field, code: Code) {
		super(code);
		this.name = "RuleError";
		this.field = field;
		this.code = code;
	}
}

export function isRuleError(error: unknown): error is RuleError {
	return error instanceof RuleError;
}

export function ruleOk<T>(value: T): { readonly ok: true; readonly value: T } {
	return { ok: true, value };
}

export function ruleFail<Field extends string, Code extends string>(
	errors: readonly RuleIssue<Field, Code>[],
): { readonly ok: false; readonly errors: readonly RuleIssue<Field, Code>[] } {
	return { ok: false, errors };
}

/** The value of a passing result; throws the first issue of a failing one. */
export function ruleValue<T, Field extends string, Code extends string>(
	result: RuleResult<T, Field, Code>,
): T {
	if (result.ok) return result.value;
	const [first] = result.errors;
	throw new RuleError(first.field, first.code);
}

/** Runs a throwing computation and reports its `RuleError` as a result. */
export function ruleResult<
	T,
	Field extends string = string,
	Code extends string = string,
>(compute: () => T): RuleResult<T, Field, Code> {
	try {
		return ruleOk(compute());
	} catch (error) {
		if (error instanceof RuleError)
			return ruleFail([
				{ field: error.field as Field, code: error.code as Code },
			]);
		throw error;
	}
}

/** Collects issues; `result(value)` passes only when nothing was reported. */
export function ruleIssues<Field extends string, Code extends string>() {
	const list: RuleIssue<Field, Code>[] = [];
	return {
		add(field: Field, code: Code) {
			list.push({ field, code });
		},
		get count() {
			return list.length;
		},
		result<T>(value: T): RuleResult<T, Field, Code> {
			return list.length ? ruleFail(list) : ruleOk(value);
		},
	};
}
