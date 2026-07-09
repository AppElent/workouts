export type CliErrorCode =
	| "MissingAuth"
	| "ExpiredAuth"
	| "AmbiguousLookup"
	| "NotFound"
	| "Unsupported"
	| "Usage";

export class CliError extends Error {
	constructor(
		readonly code: CliErrorCode,
		message?: string,
		readonly details?: unknown,
	) {
		super(message ?? code);
		this.name = "CliError";
	}
}

export function formatError(error: unknown): string {
	if (error instanceof CliError) {
		switch (error.code) {
			case "MissingAuth":
				return "Not signed in. Run `workouts auth login`.";
			case "ExpiredAuth":
				return "CLI session expired. Run `workouts auth login` again.";
			case "AmbiguousLookup":
			case "NotFound":
			case "Unsupported":
			case "Usage":
				return error.message;
		}
	}

	const message = error instanceof Error ? error.message : String(error);
	return message
		.replace(/^\[CONVEX [^\]]+\]\s*/u, "")
		.replace(/^Uncaught Error:\s*/u, "")
		.trim();
}
