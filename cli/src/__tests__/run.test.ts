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
});
