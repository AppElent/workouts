import { describe, expect, it } from "vitest";
import { isRuleError, ruleIssues, ruleValue } from "./rules";

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

	it("throws the first issue of a failing result", () => {
		const issues = ruleIssues<"quantity", "notPositive">();
		issues.add("quantity", "notPositive");
		let thrown: unknown;
		try {
			ruleValue(issues.result(1));
		} catch (error) {
			thrown = error;
		}
		expect(isRuleError(thrown)).toBe(true);
		expect(thrown).toMatchObject({
			field: "quantity",
			code: "notPositive",
			message: "notPositive",
		});
		expect(ruleValue(ruleIssues().result(3))).toBe(3);
	});
});
