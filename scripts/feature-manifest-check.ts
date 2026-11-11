// From the platform-parity standard (developer-tools), called by
// scripts/feature-manifest.test.ts. listRouteFiles lists route files under a
// route root for one platform, relative and without extension, skipping
// layouts and framework files. Web pathless layouts (`_app`) are
// skipped; a mobile `_foo` screen is not. checkFeatureManifest returns one
// message per problem: an unmapped route, a stale pattern, a status that
// contradicts the platforms, a missing reason, or an exclusive floor feature
// or share target.
// The per-platform route rules here are ahead of the standard; upstream them
// to developer-tools#63 rather than diverging further.
import fs from "node:fs";
import path from "node:path";

type Platform = "web" | "mobile";

interface ManifestFeature {
	readonly id: string;
	readonly kind: "floor" | "share-target" | "product";
	readonly status: "parity" | "exclusive" | "pending-port";
	readonly platforms: readonly Platform[];
	readonly reason?: string;
	readonly layout?: "responsive" | "large-screen";
	readonly layoutReason?: string;
	readonly routes: { readonly web?: readonly string[]; readonly mobile?: readonly string[] };
}

const PLATFORMS: readonly Platform[] = ["web", "mobile"];

/** Extensions both routers load as routes (TanStack Router and Expo Router). */
const ROUTE_EXTENSION = /\.(?:ts|tsx|js|jsx)$/;

/** A TanStack `foo.lazy.tsx` is the code-split half of the `foo` route. */
const WEB_LAZY_SUFFIX = /\.lazy$/;

/** Expo Router native variants (`index.ios.tsx`) are the same screen as their base file. */
const MOBILE_PLATFORM_SUFFIX = /\.(?:ios|android|native)$/;

/**
 * Files that are not a screen: the root route, files the router skips, and
 * Expo layout and framework files. Tests and `.d.ts` files are not in this
 * list: Expo loads them as routes and TanStack only warns, so one under a
 * route root fails the check. A mobile `.web` file is skipped because the app
 * ships only iOS and Android.
 */
const IGNORED: Readonly<Record<Platform, readonly RegExp[]>> = {
	web: [
		/(^|\/)-/, // TanStack Router ignores files and folders that start with "-"
		/^__root$/, // only the root-level `__root` is the root route
	],
	mobile: [/\.web$/, /(^|\/)_layout$/, /(^|\/)\+(html|not-found|native-intent)$/],
};

/**
 * A TanStack pathless layout adds no URL segment: its last token starts with
 * `_`, whether nested (`_app/_authed`), flat (`_app._authed`), or a directory
 * route (`_app/_authed/route`). `_app._authed.unlisted` is a screen.
 */
function isWebPathlessLayout(route: string): boolean {
	const tokens = route
		.replace(/\[[^\]]*\]/g, "x") // `[.]well-known` escapes a literal dot
		.split(/[/.]/);
	if (tokens.at(-1) === "route") tokens.pop();
	const last = tokens.at(-1) ?? "";
	return last !== "__root" && last.startsWith("_"); // a nested `__root` is a route
}

export function listRouteFiles(
	root: string,
	platform: Platform,
	ignore: readonly RegExp[] = IGNORED[platform],
): string[] {
	const out = new Set<string>();
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
				continue;
			}
			if (!ROUTE_EXTENSION.test(entry.name)) continue;
			let route = path.relative(root, full).split(path.sep).join("/").replace(ROUTE_EXTENSION, "");
			if (ignore.some((pattern) => pattern.test(route))) continue;
			route = route.replace(platform === "web" ? WEB_LAZY_SUFFIX : MOBILE_PLATFORM_SUFFIX, "");
			if (ignore.some((pattern) => pattern.test(route))) continue;
			if (platform === "web" && isWebPathlessLayout(route)) continue;
			out.add(route);
		}
	};
	walk(root);
	return [...out].sort();
}

/** `*` matches within one segment, `**` across segments; everything else is literal. */
export function routePattern(glob: string): RegExp {
	let source = "";
	for (let i = 0; i < glob.length; i++) {
		const char = glob[i];
		if (char === "*" && glob[i + 1] === "*") {
			const slash = glob[i + 2] === "/";
			source += slash ? "(?:.*/)?" : ".*";
			i += slash ? 2 : 1;
		} else if (char === "*") {
			source += "[^/]*";
		} else {
			source += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
		}
	}
	return new RegExp(`^${source}$`);
}

export function checkFeatureManifest(
	features: readonly ManifestFeature[],
	routes: Readonly<Record<Platform, readonly string[]>>,
): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();

	for (const feature of features) {
		const { id, kind, status, platforms } = feature;
		if (seen.has(id)) problems.push(`${id}: duplicate id`);
		seen.add(id);

		const both = PLATFORMS.every((platform) => platforms.includes(platform));
		if (platforms.length === 0) problems.push(`${id}: lists no platform`);
		if (status === "parity" && !both) problems.push(`${id}: status "parity" needs both platforms`);
		if (status !== "parity" && both) problems.push(`${id}: on both platforms, so status must be "parity"`);
		if (status !== "parity" && !feature.reason?.trim()) problems.push(`${id}: status "${status}" needs a reason`);
		if (status === "exclusive" && kind !== "product" && !feature.reason?.includes("adr/")) {
			problems.push(`${id}: a ${kind} feature cannot be exclusive without linking the parity ADR in its reason`);
		}
		if (feature.layout === "large-screen" && !feature.layoutReason?.trim()) {
			problems.push(`${id}: layout "large-screen" needs a layoutReason`);
		}
		if (feature.layout && !platforms.includes("web")) problems.push(`${id}: layout applies only to web features`);

		for (const platform of PLATFORMS) {
			const patterns = feature.routes[platform] ?? [];
			if (patterns.length > 0 && !platforms.includes(platform)) {
				problems.push(`${id}: has ${platform} routes but does not list ${platform}`);
			}
			for (const glob of patterns) {
				const regex = routePattern(glob);
				if (!routes[platform].some((route) => regex.test(route))) {
					problems.push(`${id}: ${platform} pattern "${glob}" matches no route`);
				}
			}
		}
	}

	for (const platform of PLATFORMS) {
		const patterns = features.flatMap((feature) => (feature.routes[platform] ?? []).map(routePattern));
		for (const route of routes[platform]) {
			if (!patterns.some((regex) => regex.test(route))) {
				problems.push(`${platform} route "${route}" belongs to no feature; add it to features.ts`);
			}
		}
	}

	return problems;
}
