import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { getConvexErrorMessage } from "./convexError";

describe("getConvexErrorMessage", () => {
	it("returns a ConvexError string payload verbatim", () => {
		expect(
			getConvexErrorMessage(
				new ConvexError("This workout has closed."),
				"fallback",
			),
		).toBe("This workout has closed.");
	});

	it("reads a message field from a ConvexError object payload", () => {
		expect(
			getConvexErrorMessage(new ConvexError({ message: "Nope." }), "fallback"),
		).toBe("Nope.");
	});

	it("strips the raw Convex server-error wrapper from a plain Error", () => {
		const raw = new Error(
			"[CONVEX M(hostedWorkoutSubmissions:submitGuest)] [Request ID: abc] Server Error Uncaught Error: This hosted workout is closed. at handler (../convex/hostedWorkoutSubmissions.ts:243:52) Called by client",
		);
		expect(getConvexErrorMessage(raw, "fallback")).toBe(
			"This hosted workout is closed.",
		);
	});

	it("falls back when the error is not recognisable", () => {
		expect(getConvexErrorMessage("weird", "fallback")).toBe("fallback");
		expect(getConvexErrorMessage(new Error("no marker here"), "fallback")).toBe(
			"fallback",
		);
	});
});
