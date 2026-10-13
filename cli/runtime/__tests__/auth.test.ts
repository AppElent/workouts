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
		appName: "workouts",
		writeOut: () => {},
		writeErr: () => {},
		env: { WORKOUTS_CONFIG_DIR: configDir },
		defaultApiUrl: "http://localhost:3000",
	};
}

function unsignedJwt(exp: number) {
	const body = Buffer.from(JSON.stringify({ exp }), "utf8").toString(
		"base64url",
	);
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

		const result = await runCli(["auth", "login", "--token", token], runtime, {
			appName: "workouts",
		});

		expect(result.exitCode).toBe(0);
		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toMatchObject({
			credential: { token, expiresAt: expect.any(Number) },
		});
		expect(stdout.join("")).toContain("Signed in with token.");
	});

	it("reports missing auth status", async () => {
		const configDir = await createConfigDir();
		const { runtime, stdout } = createRuntime(configDir);

		const result = await runCli(["auth", "status"], runtime, {
			appName: "workouts",
		});

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Not signed in.");
	});

	it("reports signed-in auth status in json", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
		const { runtime, stdout } = createRuntime(configDir);

		await runCli(["auth", "login", "--token", token], runtime, {
			appName: "workouts",
		});
		stdout.length = 0;

		const result = await runCli(["auth", "status", "--json"], runtime, {
			appName: "workouts",
		});

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(stdout.join("")).signedIn).toBe(true);
		expect(JSON.parse(stdout.join("")).expiresAt).toEqual(expect.any(Number));
	});

	it("reports expired auth status", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) - 3600);
		const { runtime, stdout } = createRuntime(configDir);

		await runCli(["auth", "login", "--token", token], runtime, {
			appName: "workouts",
		});
		stdout.length = 0;

		const result = await runCli(["auth", "status"], runtime, {
			appName: "workouts",
		});

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Expired auth.");
	});

	it("logs out by clearing the credential", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
		const { runtime, stdout } = createRuntime(configDir);

		await runCli(["auth", "login", "--token", token], runtime, {
			appName: "workouts",
		});
		stdout.length = 0;

		const result = await runCli(["auth", "logout"], runtime, {
			appName: "workouts",
		});

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Signed out of the CLI.");
		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toEqual({
			apiUrl: "http://localhost:3000",
		});
	});

	it("stores a browser login token returned to the local callback", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
		const { runtime, stdout } = createRuntime(configDir);

		const result = await runCli(["auth", "login"], runtime, {
			appName: "workouts",
			auth: {
				loginPath: "/custom-cli-login",
				callbackPath: "/custom-cli-callback",
				openBrowser: async (loginUrl) => {
					const url = new URL(loginUrl);
					expect(url.origin).toBe("http://localhost:3000");
					expect(url.pathname).toBe("/custom-cli-login");

					const state = url.searchParams.get("state");
					const redirectUri = url.searchParams.get("redirect_uri");
					expect(state).toEqual(expect.any(String));
					expect(redirectUri).toEqual(expect.any(String));

					const callbackUrl = new URL(redirectUri ?? "");
					expect(callbackUrl.hostname).toBe("127.0.0.1");
					expect(callbackUrl.pathname).toBe("/custom-cli-callback");
					callbackUrl.searchParams.set("state", state ?? "");
					callbackUrl.searchParams.set("token", token);

					const response = await fetch(callbackUrl);
					expect(response.status).toBe(200);
				},
			},
		});

		expect(result.exitCode).toBe(0);
		expect(stdout.join("")).toContain("Signed in through browser.");
		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.toMatchObject({
			credential: { token, expiresAt: expect.any(Number) },
		});
	});

	it("rejects browser login callbacks with the wrong state", async () => {
		const configDir = await createConfigDir();
		const token = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
		const { runtime, stderr } = createRuntime(configDir);

		const result = await runCli(["auth", "login"], runtime, {
			appName: "workouts",
			auth: {
				openBrowser: async (loginUrl) => {
					const url = new URL(loginUrl);
					const callbackUrl = new URL(
						url.searchParams.get("redirect_uri") ?? "",
					);
					callbackUrl.searchParams.set("state", "not-the-state");
					callbackUrl.searchParams.set("token", token);

					const response = await fetch(callbackUrl);
					expect(response.status).toBe(400);
				},
			},
		});

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain("Browser login state did not match.");
		await expect(
			loadConfig({
				appName: "workouts",
				env: { WORKOUTS_CONFIG_DIR: configDir },
			}),
		).resolves.not.toHaveProperty("credential");
	});

	it("reports browser login backend errors", async () => {
		const configDir = await createConfigDir();
		const { runtime, stderr } = createRuntime(configDir);

		const result = await runCli(["auth", "login"], runtime, {
			appName: "workouts",
			auth: {
				openBrowser: async (loginUrl) => {
					const url = new URL(loginUrl);
					const callbackUrl = new URL(
						url.searchParams.get("redirect_uri") ?? "",
					);
					callbackUrl.searchParams.set(
						"state",
						url.searchParams.get("state") ?? "",
					);
					callbackUrl.searchParams.set("error", "access_denied");
					callbackUrl.searchParams.set("error_description", "Not allowed");

					const response = await fetch(callbackUrl);
					expect(response.status).toBe(400);
				},
			},
		});

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain("Browser login failed: Not allowed");
	});

	it("times out when browser login never returns a callback", async () => {
		const configDir = await createConfigDir();
		const { runtime, stderr } = createRuntime(configDir);

		const result = await runCli(["auth", "login"], runtime, {
			appName: "workouts",
			auth: {
				timeoutMs: 5,
				openBrowser: () => undefined,
			},
		});

		expect(result.exitCode).toBe(1);
		expect(stderr.join("")).toContain(
			"Timed out waiting for browser login callback.",
		);
	});
});
