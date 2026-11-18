/**
 * The app half of hosted-workout join links must match the site half: the
 * production and preview iOS builds claim `foundry.appelent.nl/join/*`, and
 * the site's `apple-app-site-association` names exactly those builds. A
 * mismatch fails silently on a phone (the link keeps opening the browser), so
 * it fails here. The header check lives in `scripts/app-links.test.ts`.
 *
 * Android claims nothing yet (APP-261): an intent filter without a verified
 * `assetlinks.json` would show a chooser or keep opening the browser.
 */
import fs from "node:fs";
import path from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";
import appConfig, { APPLE_TEAM_ID } from "../../../../app.config";
import appJson from "../../../../app.json";
import { JOIN_LINK_HOST } from "./join-link";

const VARIANTS = ["production", "preview", "development"] as const;
const WELL_KNOWN = path.join(__dirname, "../../../../../../public/.well-known");

function configFor(variant: (typeof VARIANTS)[number]): ExpoConfig {
	const previous = process.env.APP_VARIANT;
	process.env.APP_VARIANT = variant;
	try {
		return appConfig({
			config: appJson.expo as Partial<ExpoConfig>,
		} as ConfigContext);
	} finally {
		if (previous === undefined) delete process.env.APP_VARIANT;
		else process.env.APP_VARIANT = previous;
	}
}

const claiming = VARIANTS.map(configFor).filter(
	(config) => config.ios?.associatedDomains !== undefined,
);
const bundleIds = claiming.map((config) => config.ios?.bundleIdentifier);
const readJson = (file: string) =>
	JSON.parse(fs.readFileSync(path.join(WELL_KNOWN, file), "utf8"));

it("claims join links in production and preview, never development", () => {
	expect(bundleIds).toEqual([
		"com.appelent.foundry",
		"com.appelent.foundry.preview",
	]);
	const development = configFor("development");
	expect(development.ios?.associatedDomains).toBeUndefined();
});

it.each(claiming.map((config) => [config.ios?.bundleIdentifier, config]))(
	"%s claims https://foundry.appelent.nl/join/ on iOS",
	(_id, config) => {
		expect(config.ios?.appleTeamId).toBe(APPLE_TEAM_ID);
		expect(config.ios?.associatedDomains).toEqual([
			`applinks:${JOIN_LINK_HOST}`,
		]);
	},
);

// Android link claims and `assetlinks.json` ship together (APP-261), so
// neither can land without the other.
it("claims no Android links while the site has no assetlinks.json", () => {
	expect(fs.existsSync(path.join(WELL_KNOWN, "assetlinks.json"))).toBe(false);
	const filters = VARIANTS.map((variant) => [
		variant,
		configFor(variant).android?.intentFilters,
	]);
	expect(filters).toEqual(VARIANTS.map((variant) => [variant, undefined]));
});

it("names exactly the claiming builds in apple-app-site-association", () => {
	const aasa = readJson("apple-app-site-association");
	expect(aasa.applinks.details).toEqual([
		{
			appIDs: bundleIds.map((id) => `${APPLE_TEAM_ID}.${id}`),
			components: [expect.objectContaining({ "/": "/join/*" })],
		},
	]);
});
