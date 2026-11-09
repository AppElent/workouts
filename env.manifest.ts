// Foundry environment manifest. Values live in Infisical, never here. Routing is
// the shared model in docs/standards/environments.md: entries say which consumer
// reads a value in which environment; the engine picks the destination.
// Optional typing: import type { EnvironmentEntry } from "./scripts/lib/env/types.ts";

export const ENV_CONFIG = {
	appName: "Foundry",
	source: { paths: ["/", "/foundry"] },
	convex: {
		project: "eric-jansen:workout-tracker",
		deployments: {
			dev: "colorless-sturgeon-704",
			production: "fine-akita-444",
		},
	},
	worker: { name: "foundry" },
	mobile: { path: "apps/mobile" },
	github: { repository: "AppElent/workouts" },
};

export const ENVIRONMENTS = ["local", "dev", "preview", "production"] as const;

const ALL = ["local", "dev", "preview", "production"];
const DEV_ONLY = ["local", "dev"];

export const ENTRIES = [
	{
		key: "sentryDsn",
		infisicalKey: "sentry-dsn",
		description:
			"Public Sentry DSN for client errors, performance, replay, and feedback",
		optional: true,
		secret: false,
		lands: {
			"vite-build": { name: "VITE_SENTRY_DSN", environments: ALL },
			"expo-build": { name: "EXPO_PUBLIC_SENTRY_DSN", environments: ALL },
			"expo-local": { name: "EXPO_PUBLIC_SENTRY_DSN", environments: ["local"] },
		},
	},
	{
		key: "sentryAuthToken",
		infisicalKey: "sentry-auth-token",
		description: "Build-only Sentry token for source-map and debug-symbol uploads",
		optional: true,
		secret: true,
		lands: {
			"local-tooling": { name: "SENTRY_AUTH_TOKEN", environments: ["local"] },
			workflow: {
				name: "SENTRY_AUTH_TOKEN",
				environments: ["preview", "production"],
			},
			"eas-tooling": { name: "SENTRY_AUTH_TOKEN", environments: ALL },
		},
	},
	{
		key: "clerkPublishableKey",
		infisicalKey: "clerk-publishable-key",
		description: "pk_test_ in dev, pk_live_ in staging and prod",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CLERK_PUBLISHABLE_KEY",
				environments: ["local", "dev", "production"],
			},
			"expo-build": {
				name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
				environments: ALL,
			},
			"expo-local": {
				name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
				environments: ["local"],
			},
		},
	},
	{
		key: "clerkJwtIssuerDomain",
		infisicalKey: "clerk-jwt-issuer-domain",
		description: "Issuer Convex trusts",
		secret: false,
		lands: {
			"convex-functions": {
				name: "CLERK_JWT_ISSUER_DOMAIN",
				environments: ["local", "dev", "production"],
			},
		},
	},
	{
		key: "prClerkPublishableKey",
		infisicalKey: "pr-clerk-publishable-key",
		description:
			"Reference to the dev pk_test_ key: web PR previews are short-lived",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CLERK_PUBLISHABLE_KEY",
				environments: ["preview"],
			},
		},
	},
	{
		key: "prClerkJwtIssuerDomain",
		infisicalKey: "pr-clerk-jwt-issuer-domain",
		description: "Reference to the dev issuer the per-PR backend trusts",
		secret: false,
		lands: {
			"convex-functions": {
				name: "CLERK_JWT_ISSUER_DOMAIN",
				environments: ["preview"],
			},
		},
	},
	{
		key: "anthropicApiKey",
		infisicalKey: "anthropic-api-key",
		description: "Anthropic API key for nutrition AI help (Convex actions only)",
		secret: true,
		lands: {
			"convex-functions": { name: "ANTHROPIC_API_KEY", environments: ALL },
		},
	},
	{
		key: "appleTeamId",
		infisicalKey: "apple-team-id",
		description: "Apple Developer team ID; signs the Sign in with Apple client secret",
		secret: true,
		lands: {
			"convex-functions": { name: "APPLE_TEAM_ID", environments: ALL },
		},
	},
	{
		key: "appleSignInKeyId",
		infisicalKey: "apple-sso-key-id",
		description: "Key ID of the Sign in with Apple private key",
		secret: true,
		lands: {
			"convex-functions": { name: "APPLE_SIGN_IN_KEY_ID", environments: ALL },
		},
	},
	{
		key: "appleSignInPrivateKey",
		infisicalKey: "apple-sso-key-value",
		description:
			"Sign in with Apple .p8 private key; Convex revokes Apple grants on account deletion",
		secret: true,
		lands: {
			"convex-functions": {
				name: "APPLE_SIGN_IN_PRIVATE_KEY",
				environments: ALL,
			},
		},
	},
	{
		key: "convexUrl",
		infisicalKey: "convex-url",
		description: "Convex client URL",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CONVEX_URL",
				environments: ALL,
				suppliedIn: { preview: "convex deploy" },
			},
			"expo-build": { name: "EXPO_PUBLIC_CONVEX_URL", environments: ALL },
			"expo-local": { name: "EXPO_PUBLIC_CONVEX_URL", environments: ["local"] },
		},
	},
	{
		key: "convexDeployment",
		infisicalKey: "convex-deployment",
		description: "Deployment the local Convex CLI selects: the shared dev one",
		secret: false,
		lands: {
			"local-tooling": { name: "CONVEX_DEPLOYMENT", environments: ["local"] },
		},
	},
	{
		key: "convexDeployKey",
		infisicalKey: "convex-deploy-key",
		description: "Deploy key: preview kind in staging, production kind in prod",
		secret: true,
		lands: {
			workflow: { name: "CONVEX_DEPLOY_KEY", environments: ["preview"] },
		},
	},
	{
		key: "testUserEmail",
		infisicalKey: "test-user-email",
		description: "+clerk_test address on the development instance",
		optional: true,
		secret: false,
		lands: {
			"vite-build": { name: "VITE_TEST_USER_EMAIL", environments: DEV_ONLY },
			"expo-build": {
				name: "EXPO_PUBLIC_TEST_USER_EMAIL",
				environments: DEV_ONLY,
			},
			"expo-local": {
				name: "EXPO_PUBLIC_TEST_USER_EMAIL",
				environments: ["local"],
			},
		},
	},
	{
		key: "testUserPassword",
		infisicalKey: "test-user-password",
		description: "Password of the development-instance test user",
		optional: true,
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_TEST_USER_PASSWORD",
				environments: DEV_ONLY,
			},
			"expo-build": {
				name: "EXPO_PUBLIC_TEST_USER_PASSWORD",
				environments: DEV_ONLY,
			},
			"expo-local": {
				name: "EXPO_PUBLIC_TEST_USER_PASSWORD",
				environments: ["local"],
			},
		},
	},
	{
		key: "cloudflareApiToken",
		infisicalKey: "cloudflare-account-token",
		description: "Worker deploy token for PR previews",
		secret: true,
		lands: {
			workflow: { name: "CLOUDFLARE_API_TOKEN", environments: ["preview"] },
		},
	},
	{
		key: "cloudflareAccountId",
		infisicalKey: "cloudflare-account-id",
		description: "Cloudflare account for Worker deploys",
		secret: false,
		lands: {
			workflow: { name: "CLOUDFLARE_ACCOUNT_ID", environments: ["preview"] },
		},
	},
	{
		key: "expoToken",
		infisicalKey: "expo-token",
		description: "Expo access token for CI `eas build --local` runs",
		secret: true,
		lands: {
			workflow: { name: "EXPO_TOKEN", environments: ["preview"] },
		},
	},
];
