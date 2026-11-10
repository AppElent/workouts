import { describe, expect, it } from "vitest";
import { parseConvexError } from "./convex-error";

/** The shape `convex/values` gives a ConvexError, without importing Convex. */
function convexError(data: unknown) {
	return Object.assign(new Error("ConvexError"), { name: "ConvexError", data });
}

describe("parseConvexError", () => {
	it("reads a string payload as both code and message", () => {
		expect(parseConvexError(convexError("limit"))).toEqual({
			code: "limit",
			message: "limit",
		});
	});

	it("reads code and message from an object payload", () => {
		expect(
			parseConvexError(convexError({ code: "tooLarge", message: "Too big." })),
		).toEqual({ code: "tooLarge", message: "Too big." });
		expect(parseConvexError(convexError({ code: "limit" }))).toEqual({
			code: "limit",
			message: "",
		});
		expect(parseConvexError(convexError({ message: "Nope." }))).toEqual({
			message: "Nope.",
		});
	});

	it("strips the development server-error wrapper from a plain error", () => {
		const raw = new Error(
			"[CONVEX M(workoutSessions:start)] [Request ID: abc] Server Error\nUncaught Error: A session is already active.\n    at handler (../convex/workoutSessions.ts:1:2)",
		);
		expect(parseConvexError(raw)).toEqual({
			message: "A session is already active.",
		});
	});

	it("shows nothing for a redacted production error or a non-error", () => {
		expect(
			parseConvexError(new Error("[Request ID: abc] Server Error")),
		).toEqual({ message: "" });
		expect(parseConvexError("weird")).toEqual({ message: "" });
		expect(parseConvexError(undefined)).toEqual({ message: "" });
	});

	it("keeps the first line of any other error", () => {
		expect(parseConvexError(new Error("Offline\nstack"))).toEqual({
			message: "Offline",
		});
	});
});
