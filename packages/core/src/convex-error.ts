/**
 * Codes a user-facing server failure carries in `ConvexError({ code, field? })`.
 * Core rule failures reach the client the same way with the rule's own code
 * (`tooSmall`, `notStep`, `required`, …) and the field it concerns.
 */
const APP_ERROR_CODES = [
	"unauthenticated",
	"notFound",
	"readOnly",
	"duplicate",
	"invalid",
	"required",
	"notPositive",
	"tooLong",
	"tooLarge",
	"accountChanged",
	"operationConflict",
	"partialCombo",
	"recordDeleted",
	"activeSessionExists",
	"sessionEnded",
	"emptySession",
	"unfinishedTargets",
	"hostedNotDraft",
	"hostedNotOpen",
	"hostedClosed",
	"templateEmpty",
	"levelsIncomplete",
	"activeActivity",
	"hostedWorkout",
	"unavailable",
	"failed",
	"limit",
	"empty",
] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export function isAppErrorCode(value: unknown): value is AppErrorCode {
	return APP_ERROR_CODES.some((code) => code === value);
}

/**
 * A client's words for the codes that tell a user what happened. Generic codes
 * (`notFound`, `invalid`, `failed`, rule codes) are left out so the caller's
 * own message, which knows what was being attempted, is shown instead.
 */
export type AppErrorMessages = Partial<Record<AppErrorCode, string>>;

type ParsedConvexError = {
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

/**
 * What to tell the user about a failed Convex call: the client's message for
 * the error's code, else the server's own text, else `fallback`.
 */
export function convexErrorMessage(
	error: unknown,
	messages: AppErrorMessages,
	fallback: string,
): string {
	const { code, message } = parseConvexError(error);
	return (isAppErrorCode(code) && messages[code]) || message || fallback;
}
