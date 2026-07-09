import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { platform } from "node:process";

import { CliError } from "./errors";

export type ConfigRuntime = {
	env: Record<string, string | undefined>;
};

export type Credential = {
	token: string;
	expiresAt?: number;
};

export type CliConfig = {
	apiUrl: string;
	convexUrl?: string;
	credential?: Credential;
};

const DEFAULT_API_URL = "http://localhost:3000";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCredential(value: unknown): Credential | undefined {
	if (!isRecord(value) || typeof value.token !== "string" || value.token.length === 0) {
		return undefined;
	}

	const credential: Credential = { token: value.token };
	if (typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)) {
		credential.expiresAt = value.expiresAt;
	}

	return credential;
}

function normalizeConfig(value: unknown): CliConfig {
	if (!isRecord(value)) {
		return { apiUrl: DEFAULT_API_URL };
	}

	const apiUrl =
		typeof value.apiUrl === "string" && value.apiUrl.length > 0
			? value.apiUrl
			: DEFAULT_API_URL;
	const convexUrl =
		typeof value.convexUrl === "string" && value.convexUrl.length > 0
			? value.convexUrl
			: undefined;
	const credential = normalizeCredential(value.credential);

	if (credential === undefined) {
		return { apiUrl, convexUrl };
	}

	return { apiUrl, convexUrl, credential };
}

export function configDir(runtime: ConfigRuntime): string {
	if (runtime.env.WORKOUTS_CONFIG_DIR) return runtime.env.WORKOUTS_CONFIG_DIR;
	if (platform === "win32") {
		return join(runtime.env.APPDATA ?? homedir(), "workouts");
	}
	return join(runtime.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "workouts");
}

export function configPath(runtime: ConfigRuntime): string {
	return join(configDir(runtime), "config.json");
}

export async function loadConfig(runtime: ConfigRuntime): Promise<CliConfig> {
	const path = configPath(runtime);

	try {
		const text = await readFile(path, "utf8");
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new CliError("Usage", `Invalid config file at ${path}: ${message}`);
		}

		return normalizeConfig(parsed);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { apiUrl: DEFAULT_API_URL };
		}
		throw error;
	}
}

export async function saveConfig(
	config: CliConfig,
	runtime: ConfigRuntime,
): Promise<void> {
	await mkdir(configDir(runtime), { recursive: true });
	await writeFile(
		configPath(runtime),
		`${JSON.stringify(config, null, "\t")}\n`,
	);
}

export async function clearCredential(runtime: ConfigRuntime): Promise<void> {
	const config = await loadConfig(runtime);
	const { credential: _credential, ...rest } = config;
	await saveConfig(rest, runtime);
}

