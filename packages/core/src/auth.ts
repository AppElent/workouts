/**
 * The dev test-login shortcut exists only on a Clerk *test* instance with
 * both test-user credentials configured, so it can never reach production
 * (`pk_live_` and no credentials in the bundle).
 */
export function isTestLoginAvailable(env: {
	readonly publishableKey: string | undefined;
	readonly email: string | undefined;
	readonly password: string | undefined;
}): boolean {
	return (
		!!env.publishableKey?.startsWith("pk_test_") &&
		!!env.email &&
		!!env.password
	);
}

/** Message keys for Clerk errors; each client translates them. */
export const CLERK_ERROR_MESSAGE_KEYS = [
	"generic",
	"identifierNotFound",
	"passwordIncorrect",
	"identifierExists",
	"emailInvalid",
	"required",
	"passwordTooShort",
	"passwordPwned",
	"passwordDoesNotMeetRequirements",
	"codeIncorrect",
	"codeExpired",
	"tooManyRequests",
	"network",
	"appleSignInIncomplete",
] as const;
export type ClerkErrorMessageKey = (typeof CLERK_ERROR_MESSAGE_KEYS)[number];

/** Clerk's stable error codes, mapped to the key a client translates. */
export const CLERK_ERROR_CODE_MAP: Readonly<
	Record<string, Exclude<ClerkErrorMessageKey, "generic">>
> = {
	form_identifier_not_found: "identifierNotFound",
	form_password_incorrect: "passwordIncorrect",
	form_identifier_exists: "identifierExists",
	form_param_format_invalid: "emailInvalid",
	form_param_nil: "required",
	form_param_missing: "required",
	form_password_length_too_short: "passwordTooShort",
	form_password_pwned: "passwordPwned",
	form_password_validation_failed: "passwordDoesNotMeetRequirements",
	form_code_incorrect: "codeIncorrect",
	verification_failed: "codeIncorrect",
	verification_expired: "codeExpired",
	too_many_requests: "tooManyRequests",
	rate_limit_exceeded: "tooManyRequests",
	network_error: "network",
	// Native Apple sheet: no Apple Account on the device, or its prompt closed.
	ERR_REQUEST_UNKNOWN: "appleSignInIncomplete",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function findCode(
	error: unknown,
	seen: Set<object>,
	depth: number,
): string | null {
	if (!isRecord(error) || depth > 8 || seen.has(error)) return null;
	seen.add(error);
	if (typeof error.code === "string") return error.code;
	if (Array.isArray(error.errors)) {
		for (const nested of error.errors) {
			const code = findCode(nested, seen, depth + 1);
			if (code) return code;
		}
	}
	return null;
}

/** The first machine-stable code in a Clerk error, including nested `errors[]`. */
export function clerkErrorCode(error: unknown): string | null {
	return findCode(error, new Set(), 0);
}

/** The message key for a Clerk error; `"generic"` for an unmapped code. */
export function clerkErrorMessageKey(error: unknown): ClerkErrorMessageKey {
	const code = clerkErrorCode(error);
	return code && Object.hasOwn(CLERK_ERROR_CODE_MAP, code)
		? CLERK_ERROR_CODE_MAP[code]
		: "generic";
}
