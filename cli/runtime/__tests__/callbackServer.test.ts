import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../run";

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
	spawn: (...args: unknown[]) => spawnMock(...args),
}));

let tempDir: string | undefined;

afterEach(async () => {
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
	spawnMock.mockReset();
});

function createRuntime(configDir: string) {
	const stdout: string[] = [];
	const stderr: string[] = [];

	return {
		stdout,
		stderr,
		runtime: {
			writeOut: (value: string) => stdout.push(value),
			writeErr: (value: string) => stderr.push(value),
			env: { WORKOUTS_CONFIG_DIR: configDir },
		},
	};
}

describe("default browser launcher", () => {
	it("reports a login error instead of crashing when the launcher binary is missing", async () => {
		tempDir = await mkdtemp(join(tmpdir(), "workouts-cli-browser-"));
		const { runtime, stderr } = createRuntime(tempDir);

		spawnMock.mockImplementation(() => {
			const child = new EventEmitter() as EventEmitter & {
				unref: () => void;
			};
			child.unref = () => undefined;
			// spawn() reports a missing launcher binary asynchronously via an
			// "error" event, not by throwing — simulate xdg-open being absent
			// on a minimal Linux install.
			queueMicrotask(() => {
				child.emit(
					"error",
					Object.assign(new Error("spawn xdg-open ENOENT"), {
						code: "ENOENT",
					}),
				);
			});
			return child;
		});

		const result = await runCli(["auth", "login"], runtime, {
			appName: "workouts",
		});

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain("Could not open a browser");
		expect(spawnMock).toHaveBeenCalledTimes(1);
	});
});
