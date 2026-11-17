/**
 * What `/version` reports (developer-home standards/releases.md): the app
 * version, the commit, the environment, and when the deployed bundle was built.
 */
export interface VersionInfo {
	version: string;
	commit: string;
	environment: string;
	release: string;
	builtAt: string;
}

export function versionInfo(): VersionInfo {
	return {
		version: import.meta.env.VITE_APP_VERSION,
		commit: import.meta.env.VITE_APP_COMMIT,
		environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
		release: import.meta.env.VITE_SENTRY_RELEASE,
		builtAt: import.meta.env.VITE_BUILT_AT,
	};
}

/** The `/version` response: never cached, so a deploy shows up at once. */
export function versionResponse(info: VersionInfo = versionInfo()): Response {
	return Response.json(info, {
		headers: {
			"cache-control": "no-store",
			"access-control-allow-origin": "*",
		},
	});
}
