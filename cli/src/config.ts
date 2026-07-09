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
		const parsed = JSON.parse(text) as Partial<CliConfig>;
		return {
			apiUrl: parsed.apiUrl ?? DEFAULT_API_URL,
			convexUrl: parsed.convexUrl,
			credential: parsed.credential,
		};
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
