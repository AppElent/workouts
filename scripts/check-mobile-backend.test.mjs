import { describe, expect, it } from "vitest";
import {
	bundleConvexOrigins,
	compareBackends,
} from "./check-mobile-backend.mjs";

const dev = "https://colorless-sturgeon-704.eu-west-1.convex.cloud";
const live = "https://fine-akita-444.eu-west-1.convex.cloud";

function bundle(url, extra = "") {
	return [
		"__d(function (global, _$$_REQUIRE) {",
		`  module.exports = { "EXPO_PUBLIC_CONVEX_URL": "${url}", "EXPO_PUBLIC_TEST_USER_PASSWORD": "hunter2-secret" };`,
		`  Object.defineProperties(env, { "EXPO_PUBLIC_CONVEX_URL": { enumerable: true, value: "${url}" } });`,
		"  // e.g. https://happy-otter-123.convex.cloud",
		extra,
		"});",
	].join("\n");
}

describe("bundleConvexOrigins", () => {
	it("reads only the inlined EXPO_PUBLIC_CONVEX_URL", () => {
		expect(bundleConvexOrigins(bundle(`${dev}/`))).toEqual([dev]);
	});

	it("never returns other inlined values", () => {
		const text = JSON.stringify(bundleConvexOrigins(bundle(dev)));
		expect(text).not.toContain("hunter2-secret");
		expect(text).not.toContain("happy-otter");
	});
});

describe("compareBackends", () => {
	it("passes when env files and bundle agree", () => {
		expect(
			compareBackends({
				expected: { mobile: dev, web: dev },
				bundle: bundle(dev),
			}),
		).toMatchObject({ ok: true, target: dev, problems: [] });
	});

	it("fails when Metro serves a stale deployment", () => {
		const result = compareBackends({
			expected: { mobile: dev },
			bundle: bundle(live),
		});
		expect(result.ok).toBe(false);
		expect(result.problems).toEqual([`bundle uses ${live}, expected ${dev}`]);
	});

	it("fails when the web and mobile env files disagree", () => {
		const result = compareBackends({
			expected: { mobile: dev, web: live },
			bundle: bundle(dev),
		});
		expect(result.problems).toEqual([`web names ${live}, expected ${dev}`]);
	});

	it("skips missing sources and fails without an inlined URL", () => {
		const result = compareBackends({
			expected: { mobile: dev, web: undefined },
			bundle: "no env here",
		});
		expect(result.problems).toEqual([
			"bundle does not inline EXPO_PUBLIC_CONVEX_URL",
		]);
	});

	it("keeps credentials out of every reported field", () => {
		const result = compareBackends({
			expected: { mobile: dev },
			bundle: bundle(live),
		});
		expect(JSON.stringify(result)).not.toContain("hunter2-secret");
	});
});
