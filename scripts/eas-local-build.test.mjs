import { readFileSync } from "node:fs";
import * as loaded from "../env.manifest.ts";
import {
	easCommands,
	easProfiles,
	manifestEnvironment,
	secretEasPlacements,
	secretEnv,
	usesProductionConvex,
} from "./eas-local-build.mjs";
import { resolveEnvironmentManifest } from "./lib/env/index.mjs";

const manifest = resolveEnvironmentManifest(loaded);
const easJson = JSON.parse(
	readFileSync(new URL("../apps/mobile/eas.json", import.meta.url), "utf8"),
);
const profiles = easProfiles(easJson);

describe("local EAS builds", () => {
	it("builds every eas.json profile from a manifest environment", () => {
		expect(Object.keys(profiles)).toEqual(Object.keys(easJson.build));
		for (const { easEnvironment } of Object.values(profiles))
			expect(manifestEnvironment(manifest, easEnvironment)).toBeDefined();
	});

	it("checks production Convex for every profile that ships to testers or the store", () => {
		const guarded = Object.entries(profiles)
			.filter(([, { easEnvironment }]) => usesProductionConvex(easEnvironment))
			.map(([name]) => name);
		expect(guarded).toEqual(["preview", "preview-internal", "production"]);
	});

	it("resolves extends and submit profiles", () => {
		const json = {
			build: {
				base: { environment: "development", ios: { image: "latest" } },
				simulator: { extends: "base", ios: { simulator: true } },
				store: { environment: "production" },
			},
			submit: { store: {} },
		};
		expect(easProfiles(json)).toEqual({
			base: { easEnvironment: "development", simulator: false, submit: false },
			simulator: {
				easEnvironment: "development",
				simulator: true,
				submit: false,
			},
			store: { easEnvironment: "production", simulator: false, submit: true },
		});
	});

	it("reads secrets for the installed preview app from staging", () => {
		expect(manifestEnvironment(manifest, "preview")).toBe("staging");
	});

	it("injects only secret values routed to EAS", () => {
		const placements = Object.values(profiles).flatMap(({ easEnvironment }) =>
			secretEasPlacements(
				manifest,
				manifestEnvironment(manifest, easEnvironment),
			),
		);
		expect(placements.length).toBeGreaterThan(0);
		for (const placement of placements) {
			expect(placement.entry.secret).toBe(true);
			expect(placement.destination.kind).toBe("eas");
		}
	});

	it("maps source keys to build variable names and reports gaps", () => {
		const placements = [
			{ name: "TOKEN", entry: { key: "token", infisicalKey: "token-key" } },
			{
				name: "OPTIONAL",
				entry: { key: "optional", infisicalKey: "optional-key", optional: true },
			},
		];
		expect(secretEnv(placements, { "token-key": "value" })).toEqual({
			env: { TOKEN: "value" },
			missing: [{ key: "optional", optional: true }],
		});
	});

	it("submits store builds and never a simulator build", () => {
		expect(easCommands("preview", { submit: true })).toEqual([
			["exec", "eas", "build", "--platform", "ios", "--profile", "preview", "--local", "--output", "dist/preview.ipa"],
			["exec", "eas", "submit", "--platform", "ios", "--profile", "preview", "--path", "dist/preview.ipa"],
		]);
		expect(easCommands("preview")).toHaveLength(1);
		expect(
			easCommands("development-simulator", { simulator: true, submit: true }),
		).toEqual([
			["exec", "eas", "build", "--platform", "ios", "--profile", "development-simulator", "--local", "--output", "dist/development-simulator.tar.gz"],
		]);
	});
});
