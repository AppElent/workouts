import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { clearCredential, loadConfig, saveConfig } from "../config";
import { runCli } from "../run";

let tempDir: string | undefined;

async function createTempConfigDir() {
	tempDir = await mkdtemp(join(tmpdir(), "workouts-cli-"));
	return tempDir;
}

async function writeRawConfig(configDir: string, value: string) {
	await mkdir(configDir, { recursive: true });
	await writeFile(join(configDir, "config.json"), value);
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
			loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } }),
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
			{ env: { WORKOUTS_CONFIG_DIR: configDir } },
		);

		await expect(
			loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } }),
		).resolves.toEqual({
			apiUrl: "http://localhost:3000",
			convexUrl: "https://example.convex.cloud",
			credential: { token: "abc", expiresAt: 123 },
		});
	});

	it("normalizes malformed config fields", async () => {
		const configDir = await createTempConfigDir();
		await writeRawConfig(
			configDir,
			JSON.stringify({
				apiUrl: 123,
				convexUrl: false,
				credential: { token: 456, expiresAt: "oops" },
			}),
		);

		await expect(
			loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } }),
		).resolves.toEqual({
			apiUrl: "http://localhost:3000",
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
			{ env: { WORKOUTS_CONFIG_DIR: configDir } },
		);

		await clearCredential({ env: { WORKOUTS_CONFIG_DIR: configDir } });

		await expect(
			loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } }),
		).resolves.toEqual({
			apiUrl: "http://localhost:3000",
			convexUrl: "https://example.convex.cloud",
		});
	});
});

describe("config command", () => {
	it("prints only public config data as json", async () => {
		const configDir = await createTempConfigDir();
		await saveConfig(
			{
				apiUrl: "http://localhost:3000",
				convexUrl: "https://example.convex.cloud",
				credential: { token: "abc", expiresAt: 123 },
			},
			{ env: { WORKOUTS_CONFIG_DIR: configDir } },
		);

		const stdout: string[] = [];
		const result = await runCli(["config", "get", "--json"], {
			writeOut: (value) => stdout.push(value),
			writeErr: () => undefined,
			env: { WORKOUTS_CONFIG_DIR: configDir },
		});

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(stdout.join(""))).toEqual({
			apiUrl: "http://localhost:3000",
			convexUrl: "https://example.convex.cloud",
		});
		expect(stdout.join(" ")).not.toContain("credential");
	});

	it("rejects extra positional args for config set", async () => {
		const configDir = await createTempConfigDir();
		const stderr: string[] = [];
		const result = await runCli(
			["config", "set", "api-url", "https://api.example.test", "extra"],
			{
				writeOut: () => undefined,
				writeErr: (value) => stderr.push(value),
				env: { WORKOUTS_CONFIG_DIR: configDir },
			},
		);

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain(
			"Usage: workouts config set <key> <value>",
		);
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
		);

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Saved api-url.");
		await expect(
			loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } }),
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
		);

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Saved convex-url.");
		await expect(
			loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } }),
		).resolves.toMatchObject({
			convexUrl: "https://convex.example.test",
		});
	});
});
