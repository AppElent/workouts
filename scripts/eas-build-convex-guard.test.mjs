import { readFileSync } from "node:fs";
import { main, needsDriftCheck, outcome } from "./eas-build-convex-guard.mjs";

const easJson = JSON.parse(
	readFileSync(new URL("../apps/mobile/eas.json", import.meta.url), "utf8"),
);

describe("CI EAS build Convex guard", () => {
	it("checks every eas.json profile that talks to production Convex", () => {
		const checked = Object.keys(easJson.build).filter((profile) =>
			needsDriftCheck(easJson, profile),
		);
		expect(checked).toEqual(["preview", "preview-internal", "production"]);
	});

	it("follows extends to the profile's EAS environment", () => {
		const json = {
			build: {
				dev: { environment: "development" },
				devSim: { extends: "dev", ios: { simulator: true } },
				release: { environment: "preview" },
				releaseInternal: { extends: "release", distribution: "internal" },
			},
		};
		expect(needsDriftCheck(json, "devSim")).toBe(false);
		expect(needsDriftCheck(json, "releaseInternal")).toBe(true);
	});

	it("rejects a profile eas.json lacks", () => {
		expect(() => needsDriftCheck(easJson, "nightly")).toThrow(
			/Unknown EAS profile "nightly"/,
		);
		expect(main(["--profile", "nightly"])).toBe(2);
		expect(main([])).toBe(2);
	});

	it("skips development builds before any git or GitHub call", () => {
		expect(main(["--profile", "development"])).toBe(0);
		expect(main(["--profile", "development-simulator"])).toBe(0);
	});

	it("passes when production is in step", () => {
		const result = outcome({
			profile: "preview-internal",
			status: "ok",
			message: "in step",
		});
		expect(result.code).toBe(0);
		expect(result.annotation).toBeUndefined();
		expect(result.summary).toContain("in step");
	});

	it("fails on drift with an error annotation and summary line", () => {
		const result = outcome({
			profile: "preview-internal",
			status: "drift",
			message: "- abc12345 feat(convex): new query",
		});
		expect(result.code).toBe(1);
		expect(result.annotation).toMatch(/^::error::Production Convex lacks/);
		expect(result.annotation).toContain("allow_convex_drift");
		expect(result.annotation).not.toContain("\n");
		expect(result.summary).toContain("❌");
		expect(result.summary).toContain("abc12345");
	});

	it("fails when it could not tell", () => {
		const result = outcome({
			profile: "preview-internal",
			status: "unknown",
			message: "gh api failed",
		});
		expect(result.code).toBe(2);
		expect(result.annotation).toMatch(/^::error::Could not tell/);
		expect(result.summary).toContain("gh api failed");
	});

	it("warns and passes with the override", () => {
		for (const status of ["drift", "unknown"]) {
			const result = outcome({
				profile: "preview-internal",
				status,
				message: "details",
				allowDrift: true,
			});
			expect(result.code).toBe(0);
			expect(result.annotation).toMatch(/^::warning::/);
			expect(result.summary).toContain("`allow_convex_drift` is set");
		}
	});
});
