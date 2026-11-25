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

const SOCIAL_SIGN_IN_PROVIDERS = ["apple", "google", "microsoft"] as const;
export type SocialSignInProvider = (typeof SOCIAL_SIGN_IN_PROVIDERS)[number];

/**
 * The social providers a Clerk instance can serve. Google only has OAuth
 * credentials on the development instance (`pk_test_`); add it for
 * production once that instance has its own Google client.
 */
export function socialSignInProviders(
	publishableKey: string | undefined,
): readonly SocialSignInProvider[] {
	return publishableKey?.startsWith("pk_test_")
		? SOCIAL_SIGN_IN_PROVIDERS
		: SOCIAL_SIGN_IN_PROVIDERS.filter((provider) => provider !== "google");
}

/** Message keys for Clerk errors; each client translates them. */
const CLERK_ERROR_MESSAGE_KEYS = [
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
	"codeAttemptsExceeded",
	"tooManyRequests",
	"network",
	"appleSignInIncomplete",
] as const;
export type ClerkErrorMessageKey = (typeof CLERK_ERROR_MESSAGE_KEYS)[number];

/** Clerk's stable error codes, mapped to the key a client translates. */
const CLERK_ERROR_CODE_MAP: Readonly<
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
	form_password_not_strong_enough: "passwordDoesNotMeetRequirements",
	form_password_no_uppercase: "passwordDoesNotMeetRequirements",
	form_password_no_lowercase: "passwordDoesNotMeetRequirements",
	form_password_no_number: "passwordDoesNotMeetRequirements",
	form_password_no_special_char: "passwordDoesNotMeetRequirements",
	form_conditional_param_missing: "required",
	form_code_incorrect: "codeIncorrect",
	// Too many wrong codes: this code is spent, a new one works (APP-507).
	verification_failed: "codeAttemptsExceeded",
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
	if (Array.isArray(error.errors)) {
		for (const nested of error.errors) {
			const code = findCode(nested, seen, depth + 1);
			if (code) return code;
		}
	}
	return typeof error.code === "string" && error.code ? error.code : null;
}

/**
 * The first machine-stable code in a Clerk error. A nested `errors[]` code
 * wins over the error's own: `ClerkAPIResponseError` carries the generic
 * `api_response_error` and keeps the specific code in `errors[]`.
 */
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

/**
 * The Sign in with Apple Services ID of every Appelent web app. Clerk's web
 * Apple sign-in and Apple JS both use it, so a web authorization code is
 * issued to it.
 */
export const APPLE_WEB_SERVICES_ID = "nl.appelent.web";

/**
 * The web Account page URLs registered as Return URLs on the Services ID.
 * Apple JS shows its popup only for a registered URL, so web Apple revocation
 * on account deletion runs only from these. Add one only after it is listed in
 * Apple Developer (social-sign-in runbook, "Enabling web revocation").
 */
export const APPLE_WEB_RETURN_URLS: readonly string[] = [
	"https://foundry.appelent.nl/account",
];

/** The registered Apple JS return URL for a web origin, if it has one. */
export function appleWebReturnUrl(
	origin: string,
	registered: readonly string[] = APPLE_WEB_RETURN_URLS,
): string | null {
	const url = `${origin}/account`;
	return registered.includes(url) ? url : null;
}
