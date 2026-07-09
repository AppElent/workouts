import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { platform } from "node:process";

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

function parseConfigFile(text: string): CliConfig {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("Invalid config file: expected valid JSON.");
	}

	if (!isRecord(parsed)) {
		throw new Error("Invalid config file: expected a JSON object.");
	}

	const apiUrl = parsed.apiUrl;
	if (typeof apiUrl !== "string" || apiUrl.length === 0) {
		throw new Error("Invalid config file: apiUrl must be a non-empty string.");
	}

	const config: CliConfig = { apiUrl };

	if (parsed.convexUrl !== undefined) {
		if (typeof parsed.convexUrl !== "string") {
			throw new Error("Invalid config file: convexUrl must be a string.");
		}
		config.convexUrl = parsed.convexUrl;
	}

	if (parsed.credential !== undefined) {
		if (!isRecord(parsed.credential) || typeof parsed.credential.token !== "string") {
			throw new Error("Invalid config file: credential is malformed.");
		}
		if (
			parsed.credential.expiresAt !== undefined &&
			typeof parsed.credential.expiresAt !== "number"
		) {
			throw new Error("Invalid config file: credential expiresAt must be a number.");
		}
		config.credential = {
			token: parsed.credential.token,
			expiresAt: parsed.credential.expiresAt as number | undefined,
		};
	}

	return config;
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
	try {
		const text = await readFile(configPath(runtime), "utf8");
		return parseConfigFile(text);
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
