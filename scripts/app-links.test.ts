// The site half of hosted-workout join links (APP-36): the files iOS and
// Android fetch from https://foundry.appelent.nl/.well-known/ to let the app
// open /join/* links. Each must match the app config (team ID, bundle IDs,
// package names) or the OS silently keeps opening the browser.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(file, "utf8");
const TEAM_ID = /const APPLE_TEAM_ID = "([A-Z0-9]{10})"/.exec(
	read("apps/mobile/app.config.ts"),
)?.[1];
const APP_IDS = ["com.appelent.foundry", "com.appelent.foundry.preview"];

describe("apple-app-site-association", () => {
	const aasa = JSON.parse(read("public/.well-known/apple-app-site-association"));

	it("claims /join/* for the production and preview apps under the config's team", () => {
		expect(TEAM_ID).toBeDefined();
		expect(aasa.applinks.details).toEqual([
			{
				appIDs: APP_IDS.map((id) => `${TEAM_ID}.${id}`),
				components: [expect.objectContaining({ "/": "/join/*" })],
			},
		]);
	});
});

describe("assetlinks.json", () => {
	const links = JSON.parse(read("public/.well-known/assetlinks.json"));

	it("lists the production and preview packages", () => {
		expect(links.map((link: { target: { package_name: string } }) => link.target.package_name)).toEqual(
			APP_IDS,
		);
	});

	// Fails while assetlinks.json holds a placeholder, so it cannot ship one:
	// Android would fail verification and keep opening the browser.
	it("has a real SHA-256 signing fingerprint for every package", () => {
		for (const link of links) {
			expect(link.relation).toEqual(["delegate_permission/common.handle_all_urls"]);
			expect(link.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
			for (const fingerprint of link.target.sha256_cert_fingerprints) {
				expect(fingerprint, link.target.package_name).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
			}
		}
	});
});

it("serves both files as application/json", () => {
	const headers = read("public/_headers");
	for (const file of ["apple-app-site-association", "assetlinks.json"]) {
		expect(headers).toMatch(
			new RegExp(`^/\\.well-known/${file.replace(".", "\\.")}\\n\\s+Content-Type: application/json$`, "m"),
		);
	}
});
