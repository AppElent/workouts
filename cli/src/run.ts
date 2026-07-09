import { parseArgs, ArgsError } from "./args";
import { handleConfigCommand } from "./commands/config";
import { CliError, formatError } from "./errors";

export type CliRuntime = {
	writeOut: (value: string) => void;
	writeErr: (value: string) => void;
	env: Record<string, string | undefined>;
};

export type CliResult = {
	exitCode: number;
};

export const HELP = `workouts

Usage:
  workouts auth login
  workouts auth status
  workouts auth logout
  workouts config get
  workouts config set api-url <value>
  workouts config set convex-url <value>
  workouts exercise list
  workouts workout list
  workouts set list --workout <id>
  workouts routine list
  workouts wod list

Options:
  --json      Print machine-readable JSON
  --help      Show help
`;

export async function runCli(
	args: string[],
	runtime: CliRuntime,
): Promise<CliResult> {
	try {
		const parsed = parseArgs(args);
		if (
			args.length === 0 ||
			parsed.flags.help === true ||
			parsed.flags.h === true
		) {
			runtime.writeOut(HELP);
			return { exitCode: 0 };
		}

		if (parsed.positionals[0] === "config") {
			const exitCode = await handleConfigCommand(
				parsed.positionals,
				parsed.flags,
				runtime,
			);
			return { exitCode };
		}

		const commandText =
			parsed.positionals.length > 0 ? parsed.positionals.join(" ") : args.join(" ");
		throw new CliError("Usage", `Unknown command: ${commandText}`);
	} catch (error) {
		if (error instanceof ArgsError) {
			error = new CliError("Usage", error.message);
		}
		runtime.writeErr(formatError(error));
		return { exitCode: 1 };
	}
}
