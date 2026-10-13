import { describe, expect, it } from "vitest";
import { runCli } from "../run";

function createRuntime() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	return {
		stdout,
		stderr,
		runtime: {
			writeOut: (value: string) => stdout.push(value),
			writeErr: (value: string) => stderr.push(value),
			env: {},
		},
	};
}

const options = { appName: "workouts" };

describe("runCli", () => {
	it("prints top-level help", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["--help"], runtime, options);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
		expect(stdout.join("\n")).toContain("workouts config get");
	});

	it("prints top-level help for short help flag", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["-h"], runtime, options);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
	});

	it("prints top-level help for empty argv", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli([], runtime, options);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
	});

	it("prints top-level help for inline boolean flags", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["--help=true"], runtime, options);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
	});

	it("appends registered command usage lines to help", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["--help"], runtime, {
			appName: "workouts",
			commands: [
				{
					name: "exercise",
					usage: ["workouts exercise list"],
					handle: async () => 0,
				},
			],
		});
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts exercise list");
	});

	it("dispatches registered app-specific commands", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["exercise", "list"], runtime, {
			appName: "workouts",
			commands: [
				{
					name: "exercise",
					usage: ["workouts exercise list"],
					handle: async (_positionals, _flags, rt) => {
						rt.writeOut("no exercises\n");
						return 0;
					},
				},
			],
		});
		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("no exercises");
	});

	it("returns an error for invalid boolean flag values", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(["--json=0"], runtime, options);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Invalid value for --json: 0");
	});

	it("keeps leading boolean flags from swallowing command tokens", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(
			["--json", "exercise", "list"],
			runtime,
			options,
		);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Unknown command: exercise list");
	});

	it("returns an error for unknown commands", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(["bogus"], runtime, options);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Unknown command: bogus");
	});

	it("includes flag-only invocations in the error message", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(["--json"], runtime, options);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Unknown command: --json");
	});
});
