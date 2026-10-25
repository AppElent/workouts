import * as manifest from "../env.manifest.ts";
import { easCommands, PROFILES, secretEasPlacements, secretEnv } from "./eas-local-build.mjs";

describe("local EAS builds", () => {
	it("injects only secret values routed to EAS", () => {
		for (const { environment } of Object.values(PROFILES)) {
			const placements = secretEasPlacements(manifest, environment);
			expect(placements.map((placement) => placement.name)).toEqual(["SENTRY_AUTH_TOKEN"]);
		}
	});

	it("maps source keys to build variable names and reports gaps", () => {
		const placements = secretEasPlacements(manifest, "preview");
		expect(secretEnv(placements, { "sentry-auth-token": "token" })).toEqual({
			env: { SENTRY_AUTH_TOKEN: "token" },
			missing: [],
		});
		expect(secretEnv(placements, {})).toEqual({
			env: {},
			missing: [{ key: "sentryAuthToken", optional: true }],
		});
	});

	it("submits store profiles and keeps internal ones local", () => {
		expect(easCommands("preview")).toEqual([
			["exec", "eas", "build", "--platform", "ios", "--profile", "preview", "--local", "--output", "dist/preview.ipa"],
			["exec", "eas", "submit", "--platform", "ios", "--profile", "preview", "--path", "dist/preview.ipa"],
		]);
		expect(easCommands("development")).toHaveLength(1);
		expect(easCommands("preview-internal")).toHaveLength(1);
		expect(easCommands("preview", { submit: false })).toHaveLength(1);
	});
});
