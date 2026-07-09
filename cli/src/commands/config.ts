import { CliError } from "../errors";
import { formatDetail, formatJson } from "../output";
import { loadConfig, saveConfig, toPublicConfig } from "../config";
import type { CliRuntime } from "../run";

export async function handleConfigCommand(
	positionals: string[],
	flags: Record<string, string | boolean>,
	runtime: CliRuntime,
): Promise<number> {
	const subcommand = positionals[1];
	if (subcommand === "get") {
		const config = await loadConfig(runtime);
		const publicConfig = toPublicConfig(config);
		runtime.writeOut(
			flags.json === true ? formatJson(publicConfig) : formatDetail(publicConfig),
		);
		return 0;
	}

	if (subcommand === "set") {
		if (positionals.length !== 4) {
			throw new CliError("Usage", "Usage: workouts config set <key> <value>");
		}

		const key = positionals[2];
		const value = positionals[3];
		const config = await loadConfig(runtime);
		if (key === "api-url") {
			await saveConfig({ ...config, apiUrl: value }, runtime);
		} else if (key === "convex-url") {
			await saveConfig({ ...config, convexUrl: value }, runtime);
		} else {
			throw new CliError("Usage", `Unknown config key: ${key}`);
		}

		runtime.writeOut(`Saved ${key}.\n`);
		return 0;
	}

	throw new CliError("Usage", "Usage: workouts config get|set");
}
