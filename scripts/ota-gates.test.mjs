import { describe, expect, it } from "vitest";
import { matchPlatforms, soakedCommit } from "./lib/ota-gates.mjs";

const now = new Date("2026-11-17T06:00:00Z");
const update = (createdAt, gitCommitHash, extra = {}) => ({
	createdAt,
	gitCommitHash,
	platform: "ios",
	isRollBackToEmbedded: false,
	...extra,
});

describe("soakedCommit", () => {
	it("picks the newest update at least 24 hours old", () => {
		const updates = [
			update("2026-11-17T05:00:00Z", "fresh"),
			update("2026-11-16T05:59:00Z", "soaked"),
			update("2026-11-15T05:00:00Z", "older"),
		];
		expect(soakedCommit(updates, now, 24, "ios")).toEqual({
			commit: "soaked",
			createdAt: "2026-11-16T05:59:00Z",
		});
	});

	it("does not depend on input order", () => {
		const updates = [
			update("2026-11-15T05:00:00Z", "older"),
			update("2026-11-16T05:00:00Z", "soaked"),
		];
		expect(soakedCommit(updates, now, 24, "ios")?.commit).toBe("soaked");
	});

	it("returns null when nothing has soaked", () => {
		expect(
			soakedCommit([update("2026-11-16T07:00:00Z", "fresh")], now, 24, "ios"),
		).toBeNull();
		expect(soakedCommit([], now, 24, "ios")).toBeNull();
	});

	it("skips roll-backs and updates without a commit", () => {
		const updates = [
			update("2026-11-16T04:00:00Z", "rollback", {
				isRollBackToEmbedded: true,
			}),
			update("2026-11-16T03:00:00Z", null),
			update("2026-11-16T02:00:00Z", "real"),
		];
		expect(soakedCommit(updates, now, 24, "ios")?.commit).toBe("real");
	});
});

it("only counts the asked platform's updates", () => {
	const updates = [
		update("2026-11-15T05:00:00Z", "ios-only"),
		update("2026-11-16T05:00:00Z", "android-soaked", { platform: "android" }),
	];
	expect(soakedCommit(updates, now, 24, "android")?.commit).toBe(
		"android-soaked",
	);
	expect(soakedCommit(updates, now, 24, "ios")?.commit).toBe("ios-only");
	expect(soakedCommit(updates.slice(0, 1), now, 24, "android")).toBeNull();
});

describe("matchPlatforms", () => {
	it("publishes where an update or a build has the runtime", () => {
		expect(
			matchPlatforms([
				{ platform: "ios", updates: 0, builds: 1 },
				{ platform: "android", updates: 2, builds: 0 },
			]),
		).toEqual({ publish: ["ios", "android"], due: [] });
	});

	it("reports a build due where nothing has the runtime", () => {
		expect(
			matchPlatforms([
				{ platform: "ios", updates: 0, builds: 0 },
				{ platform: "android", updates: 1, builds: 0 },
			]),
		).toEqual({ publish: ["android"], due: ["ios"] });
	});

	it("publishes everything when forced", () => {
		expect(
			matchPlatforms([{ platform: "ios", updates: 0, builds: 0 }], true),
		).toEqual({
			publish: ["ios"],
			due: [],
		});
	});
});
