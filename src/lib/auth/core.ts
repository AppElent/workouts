// DOM-free, framework-free logic shared across platforms (web + mobile).
// No React, no browser globals (window/document), no styling deps
// (lucide-react/tailwind-merge/clsx). See AppElent/workouts#48.

import { isTestLoginAvailable } from "@foundry/core";

export interface TestLoginEnv {
	VITE_CLERK_PUBLISHABLE_KEY?: string;
	VITE_TEST_USER_EMAIL?: string;
	VITE_TEST_USER_PASSWORD?: string;
}

/** Maps the web app's `VITE_*` variables onto the shared gate. */
export function shouldShowTestLogin(env: TestLoginEnv): boolean {
	return isTestLoginAvailable({
		publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
		email: env.VITE_TEST_USER_EMAIL,
		password: env.VITE_TEST_USER_PASSWORD,
	});
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
