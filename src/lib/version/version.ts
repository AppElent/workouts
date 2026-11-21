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
	/** The Convex deployment name, or null when the build has no Convex URL. */
	convex: string | null;
}

export function versionInfo(): VersionInfo {
	return {
		version: import.meta.env.VITE_APP_VERSION,
		commit: import.meta.env.VITE_APP_COMMIT,
		environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
		release: import.meta.env.VITE_SENTRY_RELEASE,
		builtAt: import.meta.env.VITE_BUILT_AT,
		convex: convexDeployment(import.meta.env.VITE_CONVEX_URL),
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

/** The Convex deployment the bundle calls, e.g. `limitless-bulldog-972`, from its client URL. */
export function convexDeployment(url: string | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.split(".")[0] || null;
	} catch {
		return null;
	}
}
