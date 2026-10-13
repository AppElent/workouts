// DOM-free, framework-free logic shared across platforms (web + mobile).
// No React, no browser globals (window/document), no styling deps
// (lucide-react/tailwind-merge/clsx). See AppElent/workouts#48.

export interface TestLoginEnv {
	VITE_CLERK_PUBLISHABLE_KEY?: string;
	VITE_TEST_USER_EMAIL?: string;
	VITE_TEST_USER_PASSWORD?: string;
}

/**
 * Show the dev test-login button only on a Clerk *test* instance with the
 * test-user credentials provided via env. Both conditions must hold, so the
 * button can never appear in production (pk_live_ + no creds in the bundle).
 *
 * This is bundler-agnostic by construction: it takes a plain env object
 * rather than reading `import.meta.env`/`process.env` itself, so any caller
 * can supply it regardless of bundler — Vite (`VITE_*`) on web, Expo
 * (`EXPO_PUBLIC_*`) on mobile, etc. The field names are kept as `VITE_*` to
 * stay byte-compatible with the existing `@appelent/auth` `.` export (which
 * already shipped this shape); a caller on another bundler maps its own
 * vars onto these same keys, e.g.:
 *
 *   shouldShowTestLogin({
 *     VITE_CLERK_PUBLISHABLE_KEY: env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
 *     VITE_TEST_USER_EMAIL: env.EXPO_PUBLIC_TEST_USER_EMAIL,
 *     VITE_TEST_USER_PASSWORD: env.EXPO_PUBLIC_TEST_USER_PASSWORD,
 *   })
 */
export function shouldShowTestLogin(env: TestLoginEnv): boolean {
	const onTestInstance =
		!!env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_");
	const hasCreds = !!env.VITE_TEST_USER_EMAIL && !!env.VITE_TEST_USER_PASSWORD;
	return onTestInstance && hasCreds;
}

interface ClerkLikeError {
	errors?: { longMessage?: string; message?: string }[];
}

/** Extract a readable message from a thrown Clerk error (or any error). */
export function clerkErrorMessage(
	err: unknown,
	fallback = "Something went wrong.",
): string {
	const e = err as ClerkLikeError;
	const first = e?.errors?.[0];
	return first?.longMessage ?? first?.message ?? fallback;
}

/**
 * Alias for `clerkErrorMessage` — same implementation, exported under the
 * "pickError" name used when this subpath was scoped (AppElent/workouts#48).
 * `clerkErrorMessage` remains the primary name (it's what the `.` export and
 * the web components already use); `pickError` is provided for new
 * consumers (e.g. mobile) that prefer it.
 */
export const pickError = clerkErrorMessage;
