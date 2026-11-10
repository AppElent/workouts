import { describe, expect, it } from "vitest";
import {
	isRuleError,
	RuleError,
	ruleIssues,
	ruleResult,
	ruleValue,
} from "./rules";

describe("rule results", () => {
	it("passes only when no issue was added, and keeps every issue", () => {
		const issues = ruleIssues<"a" | "b", "required">();
		expect(issues.result(1)).toEqual({ ok: true, value: 1 });
		issues.add("a", "required");
		issues.add("b", "required");
		expect(issues.count).toBe(2);
		expect(issues.result(1)).toEqual({
			ok: false,
			errors: [
				{ field: "a", code: "required" },
				{ field: "b", code: "required" },
			],
		});
	});

	it("turns a thrown RuleError into a result and back", () => {
		const failing = ruleResult(() => {
			throw new RuleError("quantity", "notPositive");
		});
		expect(failing).toEqual({
			ok: false,
			errors: [{ field: "quantity", code: "notPositive" }],
		});
		let thrown: unknown;
		try {
			ruleValue(failing);
		} catch (error) {
			thrown = error;
		}
		expect(isRuleError(thrown)).toBe(true);
		expect(thrown).toMatchObject({
			field: "quantity",
			code: "notPositive",
			message: "notPositive",
		});
		expect(ruleValue(ruleResult(() => 3))).toBe(3);
	});

	it("does not swallow an error that is not a broken rule", () => {
		expect(() =>
			ruleResult(() => {
				throw new TypeError("bug");
			}),
		).toThrow(TypeError);
	});
});
