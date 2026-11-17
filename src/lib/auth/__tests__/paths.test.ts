import { describe, expect, it } from "vitest";
import { safeRedirect, withRedirect } from "../paths";

describe("safeRedirect", () => {
	it("keeps same-site paths", () => {
		expect(safeRedirect("/join/abc")).toBe("/join/abc");
		expect(safeRedirect("/")).toBe("/");
	});

	it("drops anything that could leave the site", () => {
		for (const value of [
			"https://evil.example",
			"//evil.example",
			"/\\evil.example",
			"/\t/evil.example",
			"/\n/evil.example",
			"/join/\\evil",
			"join/abc",
			"",
			undefined,
			42,
		])
			expect(safeRedirect(value)).toBeUndefined();
	});
});

describe("withRedirect", () => {
	it("carries the return path as an encoded search param", () => {
		expect(withRedirect("/sign-up", "/join/a b")).toBe(
			"/sign-up?redirect=%2Fjoin%2Fa%20b",
		);
		expect(withRedirect("/sign-up", undefined)).toBe("/sign-up");
	});
});
