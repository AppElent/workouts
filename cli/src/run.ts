import { parseArgs } from "./args";
import { formatError } from "./errors";

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

		runtime.writeErr(`Unknown command: ${parsed.positionals.join(" ")}`);
		return { exitCode: 1 };
	} catch (error) {
		runtime.writeErr(formatError(error));
		return { exitCode: 1 };
	}
}
