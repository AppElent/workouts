import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FEATURES } from "@foundry/core/features";
import { afterEach, describe, expect, it } from "vitest";
import { checkFeatureManifest, listRouteFiles } from "./feature-manifest-check";

it("maps every route to a feature", () => {
	const routes = {
		web: listRouteFiles("src/routes", "web"),
		mobile: listRouteFiles("apps/mobile/app", "mobile"),
	};
	expect(checkFeatureManifest(FEATURES, routes)).toEqual([]);
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
		for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
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

	it("checks a mobile screen whose name starts with an underscore", () => {
		const root = tree(["_layout.tsx", "(app)/_layout.ios.tsx", "(app)/_foo.tsx", "(app)/_foo.native.tsx", "+not-found.tsx"]);
		expect(listRouteFiles(root, "mobile")).toEqual(["(app)/_foo"]);
	});

	it("accepts every route extension, folds native variants, and skips mobile .web files", () => {
		const root = tree(["a.ts", "b.tsx", "c.js", "d.jsx", "e.mjs", "f.css", "g.ios.tsx", "g.android.tsx", "g.tsx", "h.web.tsx"]);
		expect(listRouteFiles(root, "web")).toEqual(["a", "b", "c", "d", "g", "g.android", "g.ios", "h.web"]);
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
		expect(checkFeatureManifest([feature], { ...routes, mobile: [...routes.mobile, "(app)/_foo"] })).toEqual([
			'mobile route "(app)/_foo" belongs to no feature; add it to features.ts',
		]);
	});

	it("fails on a stale pattern", () => {
		const stale = { ...feature, routes: { ...feature.routes, web: ["privacy", "terms"] } };
		expect(checkFeatureManifest([stale], routes)).toEqual(['privacy: web pattern "terms" matches no route']);
	});

	it("fails on a status that contradicts the platforms", () => {
		const webOnly = { ...feature, platforms: ["web"], routes: { web: ["privacy"] } } as const;
		expect(checkFeatureManifest([webOnly], { ...routes, mobile: [] })).toEqual([
			'privacy: status "parity" needs both platforms',
		]);
		const exclusive = { ...feature, status: "exclusive", reason: "web only" } as const;
		expect(checkFeatureManifest([exclusive], routes)).toContain(
			'privacy: on both platforms, so status must be "parity"',
		);
	});
});
