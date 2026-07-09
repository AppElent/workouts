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

describe("runCli", () => {
	it("prints top-level help", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["--help"], runtime);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
		expect(stdout.join("\n")).toContain("workouts exercise list");
	});

	it("prints top-level help for short help flag", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["-h"], runtime);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
		expect(stdout.join("\n")).toContain("workouts exercise list");
	});

	it("prints top-level help for empty argv", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli([], runtime);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
	});

	it("prints top-level help for inline boolean flags", async () => {
		const { runtime, stdout } = createRuntime();
		const result = await runCli(["--help=true"], runtime);
		expect(result.exitCode).toBe(0);
		expect(stdout.join("\n")).toContain("workouts auth login");
	});

	it("returns an error for invalid boolean flag values", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(["--json=0"], runtime);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Invalid value for --json: 0");
	});

	it("keeps leading boolean flags from swallowing command tokens", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(["--json", "exercise", "list"], runtime);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Unknown command: exercise list");
	});

	it("returns an error for unknown commands", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(["bogus"], runtime);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Unknown command: bogus");
	});

	it("includes flag-only invocations in the error message", async () => {
		const { runtime, stderr } = createRuntime();
		const result = await runCli(["--json"], runtime);
		expect(result.exitCode).toBe(1);
		expect(stderr.join("\n")).toContain("Unknown command: --json");
	});
});
