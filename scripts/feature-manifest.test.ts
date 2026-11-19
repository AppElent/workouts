import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURES } from "@foundry/core/features";
import { afterEach, describe, expect, it } from "vitest";
import {
	checkFeatureManifest,
	findBroadPatterns,
	listRouteFiles,
} from "./feature-manifest-check";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

it("maps every route to a feature", () => {
	const routes = {
		web: listRouteFiles(path.join(repo, "src/routes"), "web"),
		mobile: listRouteFiles(path.join(repo, "apps/mobile/app"), "mobile"),
	};
	expect(checkFeatureManifest(FEATURES, routes)).toEqual([]);
	for (const warning of findBroadPatterns(FEATURES)) console.warn(warning);
});

describe("listRouteFiles", () => {
	const roots: string[] = [];
	const tree = (files: readonly string[]) => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "routes-"));
		roots.push(root);
		for (const file of files) {
			fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
			fs.writeFileSync(path.join(root, file), "");
		}
		return root;
	};
	afterEach(() => {
		for (const root of roots.splice(0))
			fs.rmSync(root, { recursive: true, force: true });
	});

	it("skips web pathless layouts but keeps the screens under them", () => {
		const root = tree([
			"__root.tsx",
			"_app.tsx",
			"_app/_authed.tsx",
			"_app/_authed/route.tsx",
			"_app._authed.tsx",
			"_app._authed.unlisted.tsx",
			"_app/_authed/dashboard/index.tsx",
			"_app/_authed/log.tsx",
			"_app/_authed/log.lazy.tsx",
			"_app/_x/route.lazy.tsx",
			"_app/__root.tsx",
			"[.]well-known/$.ts",
			"-components/button.tsx",
			"routeTree.gen.ts",
			"types.d.ts",
			"unlisted.test.tsx",
			"__tests__/unlisted.tsx",
		]);
		expect(listRouteFiles(root, "web")).toEqual([
			"[.]well-known/$",
			"__tests__/unlisted",
			"_app._authed.unlisted",
			"_app/__root",
			"_app/_authed/dashboard/index",
			"_app/_authed/log",
			"routeTree.gen",
			"types.d",
			"unlisted.test",
		]);
	});

	it("checks a mobile screen whose name starts with an underscore, and +not-found", () => {
		const root = tree([
			"_layout.tsx",
			"(app)/_layout.ios.tsx",
			"(app)/_foo.tsx",
			"(app)/_foo.native.tsx",
			"+not-found.tsx",
		]);
		expect(listRouteFiles(root, "mobile")).toEqual([
			"(app)/_foo",
			"+not-found",
		]);
	});

	it("skips files the routers do not load as screens", () => {
		const web = tree([
			".hidden.tsx",
			".config/x.tsx",
			"log.tsx",
			"log.component.tsx",
			"log.loader.ts",
			"wods/route.tsx",
			"wods/lazy.tsx",
		]);
		expect(listRouteFiles(web, "web")).toEqual(["log", "wods/route"]);
		const mobile = tree([
			"_sitemap.tsx",
			"+middleware.ts",
			"(app)/user+api.ts",
			"+html.tsx",
			"+native-intent.tsx",
			"(app)/home.tsx",
		]);
		expect(listRouteFiles(mobile, "mobile")).toEqual(["(app)/home"]);
	});

	it("follows symlinked folders once", () => {
		const outside = tree(["secret.tsx"]);
		const root = tree(["home.tsx"]);
		fs.symlinkSync(outside, path.join(root, "linked"), "dir");
		fs.symlinkSync(root, path.join(root, "loop"), "dir");
		expect(listRouteFiles(root, "mobile")).toEqual(["home", "linked/secret"]);
	});

	it("does not depend on the current directory", () => {
		const cwd = process.cwd();
		try {
			process.chdir(os.tmpdir());
			expect(
				listRouteFiles(path.join(repo, "apps/mobile/app"), "mobile").length,
			).toBeGreaterThan(0);
		} finally {
			process.chdir(cwd);
		}
	});

	it("accepts every route extension, folds native variants, and skips mobile .web files", () => {
		const root = tree([
			"a.ts",
			"b.tsx",
			"c.js",
			"d.jsx",
			"e.mjs",
			"f.css",
			"g.ios.tsx",
			"g.android.tsx",
			"g.tsx",
			"h.web.tsx",
		]);
		expect(listRouteFiles(root, "web")).toEqual([
			"a",
			"b",
			"c",
			"d",
			"g",
			"g.android",
			"g.ios",
			"h.web",
		]);
		expect(listRouteFiles(root, "mobile")).toEqual(["a", "b", "c", "d", "g"]);
	});
});

describe("checkFeatureManifest", () => {
	const feature = {
		id: "privacy",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["privacy"], mobile: ["(app)/privacy"] },
	} as const;
	const routes = { web: ["privacy"], mobile: ["(app)/privacy"] };

	it("passes a consistent manifest", () => {
		expect(checkFeatureManifest([feature], routes)).toEqual([]);
	});

	it("fails on an unlisted route", () => {
		expect(
			checkFeatureManifest([feature], {
				...routes,
				mobile: [...routes.mobile, "(app)/_foo"],
			}),
		).toEqual([
			'mobile route "(app)/_foo" belongs to no feature; add it to features.ts',
		]);
	});

	it("fails on a stale pattern", () => {
		const stale = {
			...feature,
			routes: { ...feature.routes, web: ["privacy", "terms"] },
		};
		expect(checkFeatureManifest([stale], routes)).toEqual([
			'privacy: web pattern "terms" matches no route',
		]);
	});

	it("fails on a status that contradicts the platforms", () => {
		const webOnly = {
			...feature,
			platforms: ["web"],
			routes: { web: ["privacy"] },
		} as const;
		expect(checkFeatureManifest([webOnly], { ...routes, mobile: [] })).toEqual([
			'privacy: status "parity" needs both platforms',
		]);
		const exclusive = {
			...feature,
			status: "exclusive",
			reason: "web only",
		} as const;
		expect(checkFeatureManifest([exclusive], routes)).toContain(
			'privacy: on both platforms, so status must be "parity"',
		);
	});

	it("fails on a route owned by two features", () => {
		const other = {
			...feature,
			id: "terms",
			routes: { web: ["priv*"] },
		} as const;
		expect(checkFeatureManifest([feature, other], routes)).toContain(
			'web route "privacy" belongs to 2 features (privacy, terms); keep it in one',
		);
	});

	it("allows pending-port on no platform and narrows it with targetPlatforms", () => {
		const nowhere = {
			...feature,
			status: "pending-port",
			platforms: [],
			reason: "later",
			routes: {},
		} as const;
		expect(checkFeatureManifest([nowhere], { web: [], mobile: [] })).toEqual(
			[],
		);
		const phoneOnly = {
			...nowhere,
			targetPlatforms: ["mobile"],
			reason: "reduced web floor, docs/adr/0001.md",
		} as const;
		expect(checkFeatureManifest([phoneOnly], { web: [], mobile: [] })).toEqual(
			[],
		);
		expect(
			checkFeatureManifest([{ ...phoneOnly, reason: "no ADR" }], {
				web: [],
				mobile: [],
			}),
		).toEqual([
			"privacy: a floor feature cannot target one platform without linking the parity ADR in its reason",
		]);
		const done = {
			...phoneOnly,
			platforms: ["mobile"],
			routes: { mobile: ["(app)/privacy"] },
		} as const;
		expect(
			checkFeatureManifest([done], { web: [], mobile: ["(app)/privacy"] }),
		).toEqual([
			'privacy: already on every target platform, so status cannot be "pending-port"',
		]);
		expect(
			checkFeatureManifest([{ ...feature, targetPlatforms: ["web"] }], routes),
		).toContain(
			'privacy: targetPlatforms applies only to status "pending-port"',
		);
		expect(
			checkFeatureManifest(
				[{ ...feature, status: "exclusive", platforms: [], reason: "x" }],
				{ web: [], mobile: [] },
			),
		).toContain("privacy: lists no platform");
	});
});

describe("findBroadPatterns", () => {
	it("warns on ** and partial-segment wildcards, not on a whole-segment *", () => {
		const feature = {
			id: "nutrition",
			kind: "product",
			status: "parity",
			platforms: ["web", "mobile"],
			routes: {
				web: ["food/*"],
				mobile: ["(auth)/**", "(app)/nutrition-*", "(app)/food/*"],
			},
		} as const;
		expect(findBroadPatterns([feature])).toEqual([
			'nutrition: mobile pattern "(auth)/**" is broad; a new screen it matches joins this feature without a prompt',
			'nutrition: mobile pattern "(app)/nutrition-*" is broad; a new screen it matches joins this feature without a prompt',
		]);
	});
});
