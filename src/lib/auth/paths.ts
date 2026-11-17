import type { FileRouteTypes } from "#/routeTree.gen";

export const AUTH_PATHS = {
	signIn: "/sign-in",
	signUp: "/sign-up",
	forgotPassword: "/forgot-password",
	ssoCallback: "/sso-callback",
	afterAuth: "/dashboard",
	account: "/account",
} as const satisfies Record<string, FileRouteTypes["to"]>;

/**
 * A same-site path to return to after signing in or up, from the `redirect`
 * search param. Anything else is dropped so the param cannot send people
 * off-site: another origin, `//host`, and any backslash or control character
 * (URL parsing strips tabs and newlines, so `/\t/host` would become `//host`).
 */
export function safeRedirect(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point.
	return /^\/(?!\/)[^\\\u0000-\u001f\u007f]*$/.test(value) ? value : undefined;
}

/** `path`, carrying the return path along when there is one. */
export function withRedirect(path: string, redirect: string | undefined) {
	return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
