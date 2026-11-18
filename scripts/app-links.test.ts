// The site half of hosted-workout join links (APP-36): the files iOS and
// Android fetch from https://foundry.appelent.nl/.well-known/ to let the app
// open /join/* links. That they name the builds the app config claims is
// checked in apps/mobile/src/features/training/hosted/join-link-config.test.ts.
import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(file, "utf8");

describe("assetlinks.json", () => {
	const links = JSON.parse(read("public/.well-known/assetlinks.json"));

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
