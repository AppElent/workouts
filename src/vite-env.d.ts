/// <reference types="vite/client" />

/** Build-time values; env.manifest.ts says which environments receive each. */
interface ImportMetaEnv {
	readonly VITE_CONVEX_URL?: string;
	readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
	readonly VITE_SENTRY_DSN?: string;
	/** Set by vite.config.ts from the git commit or SENTRY_RELEASE. */
	readonly VITE_SENTRY_RELEASE: string;
	/** Set by vite.config.ts from the Wrangler environment being built. */
	readonly VITE_SENTRY_ENVIRONMENT: string;
	/** Test-login credentials; present only on development-instance builds. */
	readonly VITE_TEST_USER_EMAIL?: string;
	readonly VITE_TEST_USER_PASSWORD?: string;
}
