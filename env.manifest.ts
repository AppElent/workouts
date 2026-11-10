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
			// The staging web's own prod-type deployment (reference `staging`).
			staging: "fearless-mouse-671",
			production: "fine-akita-444",
		},
	},
	worker: { name: "foundry" },
	mobile: { path: "apps/mobile" },
	github: { repository: "AppElent/workouts" },
};

// "staging" is both the staging web (foundry-staging on foundry-stg.appelent.nl,
// deployed on every merge to main) and the installed preview app (EAS preview).
// Both read Infisical prod. The staging web has its own Convex deployment
// (ENV_CONFIG.convex.deployments.staging); the preview app stays on production.
export const ENVIRONMENTS = [
	"local",
	"dev",
	"preview",
	"staging",
	"production",
] as const;

const WEB = ["local", "dev", "preview", "staging", "production"];
// Deployed by .github/workflows/deploy.yml, which reads the GitHub Environment.
const DEPLOYED_WEB = ["staging", "production"];
const APP = ["local", "dev", "staging", "production"];
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
			"vite-build": { name: "VITE_SENTRY_DSN", environments: WEB },
			"expo-build": { name: "EXPO_PUBLIC_SENTRY_DSN", environments: APP },
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
				environments: ["preview", ...DEPLOYED_WEB],
			},
			"eas-tooling": { name: "SENTRY_AUTH_TOKEN", environments: APP },
		},
	},
	{
		key: "clerkPublishableKey",
		infisicalKey: "clerk-publishable-key",
		description: "pk_test_ in Infisical dev and staging, pk_live_ in prod",
		secret: false,
		lands: {
			"vite-build": {
				name: "VITE_CLERK_PUBLISHABLE_KEY",
				environments: WEB,
			},
			"expo-build": {
				name: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
				environments: APP,
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
				environments: WEB,
			},
		},
	},
	{
		key: "anthropicApiKey",
		infisicalKey: "anthropic-api-key",
		description: "Anthropic API key for nutrition AI help (Convex actions only)",
		secret: true,
		lands: {
			"convex-functions": { name: "ANTHROPIC_API_KEY", environments: WEB },
		},
	},
	{
		key: "appleTeamId",
		infisicalKey: "apple-team-id",
		description: "Apple Developer team ID; signs the Sign in with Apple client secret",
		secret: true,
		lands: {
			"convex-functions": { name: "APPLE_TEAM_ID", environments: WEB },
		},
	},
	{
		key: "appleSignInKeyId",
		infisicalKey: "apple-sso-key-id",
		description: "Key ID of the Sign in with Apple private key",
		secret: true,
		lands: {
			"convex-functions": { name: "APPLE_SIGN_IN_KEY_ID", environments: WEB },
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
				environments: WEB,
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
				environments: WEB,
				// deploy.yml and preview.yml bridge `convex deploy`'s URL into the build.
				suppliedIn: {
					preview: "convex deploy",
					staging: "convex deploy",
					production: "convex deploy",
				},
			},
			"expo-build": { name: "EXPO_PUBLIC_CONVEX_URL", environments: APP },
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
			// Production: deploy:production's explicit Convex target, ahead of any
			// CONVEX_DEPLOYMENT or worktree-scoped key in .env.local.
			workflow: {
				name: "CONVEX_DEPLOY_KEY",
				environments: ["preview", "production"],
			},
		},
	},
	{
		key: "convexStagingDeployKey",
		infisicalKey: "convex-staging-deploy-key",
		description:
			"prod: deploy key of the staging web's own Convex deployment (Infisical prod)",
		secret: true,
		lands: {
			workflow: { name: "CONVEX_DEPLOY_KEY", environments: ["staging"] },
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
		description: "Worker deploy token for PR previews and deploy.yml",
		secret: true,
		lands: {
			workflow: {
				name: "CLOUDFLARE_API_TOKEN",
				environments: ["preview", ...DEPLOYED_WEB],
			},
		},
	},
	{
		key: "cloudflareAccountId",
		infisicalKey: "cloudflare-account-id",
		description: "Cloudflare account for Worker deploys",
		secret: false,
		lands: {
			workflow: {
				name: "CLOUDFLARE_ACCOUNT_ID",
				environments: ["preview", ...DEPLOYED_WEB],
			},
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
