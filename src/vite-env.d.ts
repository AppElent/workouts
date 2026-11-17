/// <reference types="vite/client" />

/** Build-time values; env.manifest.ts says which environments receive each. */
interface ImportMetaEnv {
	readonly VITE_CONVEX_URL?: string;
	readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
	readonly VITE_SENTRY_DSN?: string;
	/** `foundry@<version>+<short sha>`, or SENTRY_RELEASE; set by vite.config.ts. */
	readonly VITE_SENTRY_RELEASE: string;
	/** `expo.version` from apps/mobile/app.json; set by vite.config.ts. */
	readonly VITE_APP_VERSION: string;
	/** Full git commit of the build; set by vite.config.ts. */
	readonly VITE_APP_COMMIT: string;
	/** ISO time the bundle was built; set by vite.config.ts. */
	readonly VITE_BUILT_AT: string;
	/** Set by vite.config.ts from the Wrangler environment being built. */
	readonly VITE_SENTRY_ENVIRONMENT: string;
	/** Test-login credentials; present only on development-instance builds. */
	readonly VITE_TEST_USER_EMAIL?: string;
	readonly VITE_TEST_USER_PASSWORD?: string;
}
