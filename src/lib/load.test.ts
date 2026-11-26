import type { Doc } from "@convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { longestHold, overviewHint } from "./load";

const empty = { signedIn: true, hasSets: false, hasOneRepMax: false };

describe("overviewHint", () => {
	it("asks a signed-in hold for a hold, not a 1RM", () => {
		expect(overviewHint(true, empty)).toBe(
			"No holds yet. Log a hold to see your best time.",
		);
	});

	it("hides the hold hint once the hold has sets", () => {
		expect(overviewHint(true, { ...empty, hasSets: true })).toBeNull();
	});

	it("keeps the 1RM hint for rep exercises with no 1RM", () => {
		expect(overviewHint(false, empty)).toBe(
			"No data yet. Log sets for this exercise to see your 1RM.",
		);
	});

	it("hides the 1RM hint once a rep exercise has a 1RM", () => {
		expect(
			overviewHint(false, {
				...empty,
				hasOneRepMax: true,
			}),
		).toBeNull();
	});

	it("does not mention 1RM in a signed-out hold prompt", () => {
		const hint = overviewHint(true, {
			...empty,
			signedIn: false,
		});
		expect(hint).toBe("Sign in to track your best time for this exercise.");
		expect(hint).not.toMatch(/1RM/);
	});

	it("keeps the 1RM prompt for signed-out rep exercises", () => {
		expect(
			overviewHint(false, {
				...empty,
				signedIn: false,
			}),
		).toBe("Sign in to track your 1RM for this exercise.");
	});
});

describe("longestHold", () => {
	const hold = (
		reps: number,
		weight: number,
		extra: Partial<Pick<Doc<"sets">, "setType" | "performanceVerified">> = {},
	): Pick<
		Doc<"sets">,
		"reps" | "weight" | "unit" | "setType" | "performanceVerified"
	> => ({
		reps,
		weight,
		unit: "kg",
		setType: "working",
		performanceVerified: true,
		...extra,
	});

	it("picks the longest time, then the most added load", () => {
		const best = hold(45, 10);
		expect(longestHold([hold(30, 20), best, hold(45, 5)])).toBe(best);
	});

	it("skips warm-ups and unconfirmed sets", () => {
		expect(
			longestHold([
				hold(90, 0, { setType: "warmup" }),
				hold(80, 0, { performanceVerified: undefined }),
			]),
		).toBeNull();
	});
});
