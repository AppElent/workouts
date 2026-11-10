export type ParsedConvexError = {
	/** The `ConvexError` code, when the server sent one. */
	readonly code?: string;
	/** The human part of the error, or `""` when there is none to show. */
	readonly message: string;
};

const UNCAUGHT =
	/Uncaught (?:Convex)?Error:\s*(.+?)(?:\s+at\s|\s+Called by client|$)/s;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * What a failed Convex call says. A `ConvexError`'s `data` is delivered
 * verbatim even in production: a string is both its code and its message, an
 * object may carry `code` and `message`. A plain server error arrives wrapped as
 * `[CONVEX M(fn)] [Request ID: …] Server Error Uncaught Error: <msg> at …`
 * (and only in development; production redacts it), so the wrapper is
 * stripped. Detected structurally so core never imports `convex`.
 */
export function parseConvexError(error: unknown): ParsedConvexError {
	if (isRecord(error) && "data" in error && error.name === "ConvexError") {
		const { data } = error;
		if (typeof data === "string") {
			const code = data.trim();
			return code ? { code, message: code } : { message: "" };
		}
		if (isRecord(data)) {
			const code = typeof data.code === "string" ? data.code : undefined;
			const message =
				typeof data.message === "string" ? data.message.trim() : "";
			return code ? { code, message } : { message };
		}
		return { message: "" };
	}
	if (!(error instanceof Error)) return { message: "" };
	const uncaught = UNCAUGHT.exec(error.message)?.[1]?.trim();
	if (uncaught) return { message: uncaught };
	const [firstLine = ""] = error.message.split("\n");
	return {
		message: firstLine
			.replace(/^(?:\[[^\]]*\]\s*)+/, "")
			.replace(/^Server Error\s*/, "")
			.trim(),
	};
}
