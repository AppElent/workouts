import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearCredential, configPath, loadConfig, saveConfig } from "../config";
import { runCli } from "../run";

let tempDir: string | undefined;

async function createTempConfigDir() {
	tempDir = await mkdtemp(join(tmpdir(), "workouts-cli-"));
	return tempDir;
}

afterEach(async () => {
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

describe("config store", () => {
	it("loads the default api url when the config file is missing", async () => {
		const configDir = await createTempConfigDir();
		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toEqual({ apiUrl: "http://localhost:3000" });
	});

	it("saves and loads config under WORKOUTS_CONFIG_DIR", async () => {
		const configDir = await createTempConfigDir();
		await saveConfig(
			{
				apiUrl: "http://localhost:3000",
				convexUrl: "https://example.convex.cloud",
				credential: { token: "abc", expiresAt: 123 },
			},
			{ appName: "workouts", env: { WORKOUTS_CONFIG_DIR: configDir } },
		);

		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toEqual({
			apiUrl: "http://localhost:3000",
			convexUrl: "https://example.convex.cloud",
			credential: { token: "abc", expiresAt: 123 },
		});
	});

	it("clears only the credential field", async () => {
		const configDir = await createTempConfigDir();
		await saveConfig(
			{
				apiUrl: "http://localhost:3000",
				convexUrl: "https://example.convex.cloud",
				credential: { token: "abc", expiresAt: 123 },
			},
			{ appName: "workouts", env: { WORKOUTS_CONFIG_DIR: configDir } },
		);

		await clearCredential({
			appName: "workouts",
			env: { WORKOUTS_CONFIG_DIR: configDir },
		});

		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toEqual({
			apiUrl: "http://localhost:3000",
			convexUrl: "https://example.convex.cloud",
		});
	});

	it("rejects malformed config files", async () => {
		const configDir = await createTempConfigDir();
		await writeFile(
			configPath({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
			"{ not json",
		);

		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).rejects.toThrow(/Invalid config file/i);
	});

	it("rejects whitespace-only values in stored config", async () => {
		const configDir = await createTempConfigDir();
		await writeFile(
			configPath({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
			JSON.stringify({ apiUrl: "   " }),
		);

		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).rejects.toThrow(/apiUrl must be a non-empty string/i);
	});

	it("rejects padded api urls in stored config", async () => {
		const configDir = await createTempConfigDir();
		await writeFile(
			configPath({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
			JSON.stringify({ apiUrl: " http://localhost:3000 " }),
		);

		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).rejects.toThrow(/apiUrl must be a non-empty string/i);
	});

	it("rejects empty convex urls in stored config", async () => {
		const configDir = await createTempConfigDir();
		await writeFile(
			configPath({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
			JSON.stringify({ apiUrl: "http://localhost:3000", convexUrl: "" }),
		);

		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).rejects.toThrow(/convexUrl must be a non-empty string/i);
	});

	it("rejects padded credential tokens in stored config", async () => {
		const configDir = await createTempConfigDir();
		await writeFile(
			configPath({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
			JSON.stringify({
				apiUrl: "http://localhost:3000",
				credential: { token: " secret-token ", expiresAt: 123 },
			}),
		);

		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).rejects.toThrow(/credential must include a token string/i);
	});
});

describe("config command", () => {
	it("prints config as json without the credential", async () => {
		const configDir = await createTempConfigDir();
		await saveConfig(
			{
				apiUrl: "http://localhost:3000",
				convexUrl: "https://example.convex.cloud",
				credential: { token: "abc", expiresAt: 123 },
			},
			{ appName: "workouts", env: { WORKOUTS_CONFIG_DIR: configDir } },
		);

		const stdout: string[] = [];
		const result = await runCli(
			["config", "get", "--json"],
			{
				writeOut: (value) => stdout.push(value),
				writeErr: () => undefined,
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
			{ appName: "workouts" },
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(stdout.join(""))).toEqual({
			apiUrl: "http://localhost:3000",
			convexUrl: "https://example.convex.cloud",
		});
		expect(stdout.join("")).not.toContain("credential");
	});

	it("reports malformed config files through runCli", async () => {
		const configDir = await createTempConfigDir();
		await writeFile(
			configPath({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
			JSON.stringify({ apiUrl: 123 }),
		);

		const stderr: string[] = [];
		const result = await runCli(
			["config", "get"],
			{
				writeOut: () => undefined,
				writeErr: (value) => stderr.push(value),
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
			{ appName: "workouts" },
		);

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain("Invalid config file");
	});

	it("sets the api url", async () => {
		const configDir = await createTempConfigDir();
		const stdout: string[] = [];
		const result = await runCli(
			["config", "set", "api-url", "https://api.example.test"],
			{
				writeOut: (value) => stdout.push(value),
				writeErr: () => undefined,
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
			{ appName: "workouts" },
		);

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Saved api-url.");
		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toMatchObject({
			apiUrl: "https://api.example.test",
		});
	});

	it("sets the convex url", async () => {
		const configDir = await createTempConfigDir();
		const stdout: string[] = [];
		const result = await runCli(
			["config", "set", "convex-url", "https://convex.example.test"],
			{
				writeOut: (value) => stdout.push(value),
				writeErr: () => undefined,
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
			{ appName: "workouts" },
		);

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Saved convex-url.");
		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toMatchObject({
			convexUrl: "https://convex.example.test",
		});
	});

	it("rejects whitespace-padded values", async () => {
		const configDir = await createTempConfigDir();
		const stderr: string[] = [];
		const result = await runCli(
			["config", "set", "api-url", " https://api.example.test "],
			{
				writeOut: () => undefined,
				writeErr: (value) => stderr.push(value),
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
			{ appName: "workouts" },
		);

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain(
			"Usage: workouts config set <key> <value>",
		);
	});

	it("rejects empty config values", async () => {
		const configDir = await createTempConfigDir();
		const stderr: string[] = [];
		const result = await runCli(
			["config", "set", "api-url", ""],
			{
				writeOut: () => undefined,
				writeErr: (value) => stderr.push(value),
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
			{ appName: "workouts" },
		);

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain(
			"Usage: workouts config set <key> <value>",
		);
	});

	it("rejects extra args for config set", async () => {
		const configDir = await createTempConfigDir();
		const stdout: string[] = [];
		const stderr: string[] = [];
		const result = await runCli(
			["config", "set", "api-url", "https://api.example.test", "extra"],
			{
				writeOut: (value) => stdout.push(value),
				writeErr: (value) => stderr.push(value),
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
			{ appName: "workouts" },
		);

		expect(result.exitCode).toBe(1);
		expect(stdout).toHaveLength(0);
		expect(stderr.join("")).toContain(
			"Usage: workouts config set <key> <value>",
		);
	});
});
