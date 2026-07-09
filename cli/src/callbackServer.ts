import { CliError } from "./errors";
import type { CliRuntime } from "./run";

export async function startBrowserLogin(
	_runtime: CliRuntime,
): Promise<void> {
	throw new CliError(
		"Unsupported",
		"Browser login is not available yet. Use `workouts auth login --token <token>`.",
	);
}
