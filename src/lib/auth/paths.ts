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
 * search param. Anything else (another origin, `//host`, `/\\host`) is
 * dropped so the param cannot send people off-site.
 */
export function safeRedirect(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	return /^\/(?![/\\])/.test(value) ? value : undefined;
}

/** `path`, carrying the return path along when there is one. */
export function withRedirect(path: string, redirect: string | undefined) {
	return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
