/**
 * The app half of hosted-workout join links must match the site half: the
 * production and preview builds claim `foundry.appelent.nl/join/*`, and the
 * site's `.well-known` files name exactly those builds. A mismatch fails
 * silently on a phone (the link keeps opening the browser), so it fails here.
 * The fingerprint and header checks live in `scripts/app-links.test.ts`.
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
	expect(development.android?.intentFilters).toBeUndefined();
});

it.each(claiming.map((config) => [config.ios?.bundleIdentifier, config]))(
	"%s claims https://foundry.appelent.nl/join/ on iOS and Android",
	(_id, config) => {
		expect(config.ios?.appleTeamId).toBe(APPLE_TEAM_ID);
		expect(config.ios?.associatedDomains).toEqual([
			`applinks:${JOIN_LINK_HOST}`,
		]);
		expect(config.android?.package).toBe(config.ios?.bundleIdentifier);
		expect(config.android?.intentFilters).toEqual([
			{
				action: "VIEW",
				autoVerify: true,
				data: [{ scheme: "https", host: JOIN_LINK_HOST, pathPrefix: "/join/" }],
				category: ["BROWSABLE", "DEFAULT"],
			},
		]);
	},
);

it("names exactly the claiming builds in apple-app-site-association", () => {
	const aasa = readJson("apple-app-site-association");
	expect(aasa.applinks.details).toEqual([
		{
			appIDs: bundleIds.map((id) => `${APPLE_TEAM_ID}.${id}`),
			components: [expect.objectContaining({ "/": "/join/*" })],
		},
	]);
});

it("names exactly the claiming builds in assetlinks.json", () => {
	const links: { relation: string[]; target: { package_name: string } }[] =
		readJson("assetlinks.json");
	expect(links.map((link) => link.target.package_name)).toEqual(
		claiming.map((config) => config.android?.package),
	);
	for (const link of links) {
		expect(link.relation).toEqual([
			"delegate_permission/common.handle_all_urls",
		]);
	}
});
