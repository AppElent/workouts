import { describe, expect, it } from "vitest";
import { parseArgs } from "../args";
import { CliError, formatError } from "../errors";
import { formatJson, formatTable } from "../output";

describe("parseArgs", () => {
	it("separates positional values, boolean flags, and string flags", () => {
		expect(
			parseArgs([
				"set",
				"add",
				"--workout",
				"abc",
				"--json",
				"--unit=kg",
			]),
		).toEqual({
			positionals: ["set", "add"],
			flags: { workout: "abc", json: true, unit: "kg" },
		});
	});
});

describe("output helpers", () => {
	it("formats tables without losing IDs", () => {
		expect(
			formatTable(
				[
					{ id: "ex_1", name: "Back Squat" },
					{ id: "ex_2", name: "Bench Press" },
				],
				["id", "name"],
			),
		).toContain("ex_1");
	});

	it("formats JSON with a trailing newline", () => {
		expect(formatJson({ ok: true })).toBe('{\n\t"ok": true\n}\n');
	});
});

describe("formatError", () => {
	it("turns known CLI errors into concise messages", () => {
		expect(formatError(new CliError("MissingAuth"))).toBe(
			"Not signed in. Run `workouts auth login`.",
		);
	});

	it("strips common Convex wrappers", () => {
		expect(formatError(new Error("[CONVEX M(sets:add)] Unauthenticated"))).toBe(
			"Unauthenticated",
		);
	});
});
