import type { FileRouteTypes } from "#/routeTree.gen";

export const AUTH_PATHS = {
	signIn: "/sign-in",
	signUp: "/sign-up",
	forgotPassword: "/forgot-password",
	ssoCallback: "/sso-callback",
	afterAuth: "/dashboard",
	account: "/account",
} as const satisfies Record<string, FileRouteTypes["to"]>;
