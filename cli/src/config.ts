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

export type PublicConfig = {
	apiUrl: string;
	convexUrl?: string;
};

const DEFAULT_API_URL = "http://localhost:3000";
const INVALID_CONFIG_MESSAGE =
	"Invalid config file. Run `workouts config set api-url <value>` to rewrite it.";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function normalizeConfig(raw: unknown): CliConfig {
	if (!isRecord(raw)) {
		return { apiUrl: DEFAULT_API_URL };
	}

	const config: CliConfig = {
		apiUrl: isString(raw.apiUrl) ? raw.apiUrl : DEFAULT_API_URL,
	};

	if (isString(raw.convexUrl)) {
		config.convexUrl = raw.convexUrl;
	}

	if (isRecord(raw.credential) && isString(raw.credential.token)) {
		const credential: Credential = { token: raw.credential.token };
		if (typeof raw.credential.expiresAt === "number" && Number.isFinite(raw.credential.expiresAt)) {
			credential.expiresAt = raw.credential.expiresAt;
		}
		config.credential = credential;
	}

	return config;
}

export function toPublicConfig(config: CliConfig): PublicConfig {
	return {
		apiUrl: config.apiUrl,
		...(config.convexUrl !== undefined ? { convexUrl: config.convexUrl } : {}),
	};
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
		let parsed: unknown;
		try {
			parsed = JSON.parse(text) as unknown;
		} catch {
			throw new CliError("Usage", INVALID_CONFIG_MESSAGE);
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
