/**
 * What the build's environment says about auth: the Clerk key, the dev-login
 * gate, and which social providers that Clerk instance can serve.
 *
 * **Static dot access is load-bearing.** Metro inlines `EXPO_PUBLIC_*` by
 * textually substituting `process.env.EXPO_PUBLIC_NAME` at build time. It is
 * not an object at runtime: `process.env[name]`, destructuring, or a helper
 * that takes the name as an argument all yield `undefined` in a release
 * build while appearing to work in dev. Every read below is spelled out in
 * full for that reason and must stay that way.
 *
 * **The dev-login gate is the key's prefix, not `__DEV__`.** A release build
 * pointed at the test instance (e.g. a PR preview) should offer the
 * shortcut; a dev build someone has pointed at production must not. The
 * web app's dev test-login button uses the same `isTestLoginAvailable` rule,
 * and on both the credentials are inlined into the client bundle either way — so
 * the account they name must never be one that exists on the live instance.
 */
import { isTestLoginAvailable, socialSignInProviders } from "@foundry/core";

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const TEST_USER_EMAIL = process.env.EXPO_PUBLIC_TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.EXPO_PUBLIC_TEST_USER_PASSWORD;

if (!PUBLISHABLE_KEY) {
	throw new Error(
		"EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add it to apps/mobile/.env.local (see .env.example).",
	);
}

export const publishableKey: string = PUBLISHABLE_KEY;

/** The credentials for the one-tap shortcut, or `null` when it must not exist. */
export const devLogin: { email: string; password: string } | null =
	isTestLoginAvailable({
		publishableKey: PUBLISHABLE_KEY,
		email: TEST_USER_EMAIL,
		password: TEST_USER_PASSWORD,
	}) &&
	TEST_USER_EMAIL &&
	TEST_USER_PASSWORD
		? { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }
		: null;

export const socialProviders = socialSignInProviders(PUBLISHABLE_KEY);
