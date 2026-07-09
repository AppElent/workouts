import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { decodeJwtExpiry, requireCredential } from "../auth";
import { loadConfig, saveConfig } from "../config";
import { runCli } from "../run";

let tempDir: string | undefined;

async function createConfigDir() {
	tempDir = await mkdtemp(join(tmpdir(), "workouts-cli-auth-"));
	return tempDir;
}

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

function createConfigRuntime(configDir: string) {
	return {
		writeOut: () => {},
		writeErr: () => {},
		env: { WORKOUTS_CONFIG_DIR: configDir },
	};
}

function unsignedJwt(exp: number) {
	const body = Buffer.from(JSON.stringify({ exp }), "utf8").toString("base64url");
	return `header.${body}.signature`;
}

afterEach(async () => {
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

describe("auth helpers", () => {
	it("decodes JWT expiry", () => {
		expect(decodeJwtExpiry(unsignedJwt(123))).toBe(123000);
	});

	it("returns undefined for malformed JWTs", () => {
		expect(decodeJwtExpiry("not-a-jwt")).toBeUndefined();
		expect(decodeJwtExpiry("header.not-json.signature")).toBeUndefined();
	});

	it("requires a stored credential", async () => {
		const configDir = await createConfigDir();
		const runtime = createConfigRuntime(configDir);
		await saveConfig(
			{
				apiUrl: "http://localhost:3000",
				credential: { token: "abc" },
			},
			runtime,
		);

		await expect(requireCredential(runtime)).resolves.toBe("abc");
	});

	it("rejects missing credentials", async () => {
		const configDir = await createConfigDir();
		const runtime = createConfigRuntime(configDir);
		await expect(requireCredential(runtime)).rejects.toThrow("MissingAuth");
	});

	it("rejects expired credentials", async () => {
		const configDir = await createConfigDir();
		const runtime = createConfigRuntime(configDir);
		await saveConfig(
			{
				apiUrl: "http://localhost:3000",
				credential: { token: "abc", expiresAt: Date.now() - 1 },
			},
			runtime,
		);

		await expect(requireCredential(runtime)).rejects.toThrow("ExpiredAuth");
	});
});

describe("auth command", () => {
	it("stores token login", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
		const { runtime, stdout } = createRuntime(configDir);

		const result = await runCli(["auth", "login", "--token", token], runtime);

		expect(result.exitCode).toBe(0);
		await expect(loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } })).resolves.toMatchObject({
			credential: { token, expiresAt: expect.any(Number) },
		});
		expect(stdout.join("")).toContain("Signed in with token.");
	});

	it("reports missing auth status", async () => {
		const configDir = await createConfigDir();
		const { runtime, stdout } = createRuntime(configDir);

		const result = await runCli(["auth", "status"], runtime);

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Not signed in.");
	});

	it("reports signed-in auth status in json", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
		const { runtime, stdout } = createRuntime(configDir);

		await runCli(["auth", "login", "--token", token], runtime);
		stdout.length = 0;

		const result = await runCli(["auth", "status", "--json"], runtime);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(stdout.join("")).signedIn).toBe(true);
		expect(JSON.parse(stdout.join("")).expiresAt).toEqual(expect.any(Number));
	});

	it("reports expired auth status", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) - 3600);
		const { runtime, stdout } = createRuntime(configDir);

		await runCli(["auth", "login", "--token", token], runtime);
		stdout.length = 0;

		const result = await runCli(["auth", "status"], runtime);

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Expired auth.");
	});

	it("logs out by clearing the credential", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
		const { runtime, stdout } = createRuntime(configDir);

		await runCli(["auth", "login", "--token", token], runtime);
		stdout.length = 0;

		const result = await runCli(["auth", "logout"], runtime);

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Signed out of the CLI.");
		await expect(loadConfig({ env: { WORKOUTS_CONFIG_DIR: configDir } })).resolves.toEqual({
			apiUrl: "http://localhost:3000",
		});
	});

	it("keeps the browser login fallback stubbed", async () => {
		const configDir = await createConfigDir();
		const { runtime, stderr } = createRuntime(configDir);

		const result = await runCli(["auth", "login"], runtime);

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain(
			"Browser login is not available yet. Use `workouts auth login --token <token>`.",
		);
	});
});
