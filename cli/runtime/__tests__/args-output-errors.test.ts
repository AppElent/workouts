import { describe, expect, it } from "vitest";
import { getStringFlag, hasFlag, parseArgs } from "../args";
import { CliError, formatError } from "../errors";
import { formatJson, formatTable } from "../output";

describe("parseArgs", () => {
	it("separates positional values, boolean flags, and string flags", () => {
		expect(
			parseArgs(["set", "add", "--workout", "abc", "--json", "--unit=kg"]),
		).toEqual({
			positionals: ["set", "add"],
			flags: { workout: "abc", json: true, unit: "kg" },
		});
	});

	it("parses the short help flag without broadening other single-dash tokens", () => {
		expect(parseArgs(["-h"])).toEqual({
			positionals: [],
			flags: { h: true },
		});
		expect(parseArgs(["-1"])).toEqual({
			positionals: ["-1"],
			flags: {},
		});
	});

	it("keeps boolean long flags from swallowing command tokens", () => {
		expect(parseArgs(["--json", "exercise", "list"])).toEqual({
			positionals: ["exercise", "list"],
			flags: { json: true },
		});
	});

	it("accepts inline and separated boolean values for known boolean flags", () => {
		expect(parseArgs(["--json=true", "--help=false"])).toEqual({
			positionals: [],
			flags: { json: true, help: false },
		});
		expect(parseArgs(["--json", "true", "--help", "false"])).toEqual({
			positionals: [],
			flags: { json: true, help: false },
		});
	});

	it("rejects invalid inline values for known boolean flags", () => {
		expect(() => parseArgs(["--json=0"])).toThrow(
			"Invalid value for --json: 0",
		);
	});
});

describe("flag helpers", () => {
	it("reads string and boolean flags", () => {
		const parsed = parseArgs(["--workout", "abc", "--json"]);
		expect(getStringFlag(parsed.flags, "workout")).toBe("abc");
		expect(getStringFlag(parsed.flags, "missing")).toBeUndefined();
		expect(hasFlag(parsed.flags, "json")).toBe(true);
		expect(hasFlag(parsed.flags, "missing")).toBe(false);
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
		expect(formatError(new CliError("MissingAuth"), "workouts")).toBe(
			"Not signed in. Run `workouts auth login`.",
		);
	});

	it("strips common Convex wrappers", () => {
		expect(
			formatError(
				new Error("[CONVEX M(sets:add)] Unauthenticated"),
				"workouts",
			),
		).toBe("Unauthenticated");
	});
});
