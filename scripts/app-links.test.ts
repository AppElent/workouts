// The site half of hosted-workout join links (APP-36): the file iOS fetches
// from https://foundry.appelent.nl/.well-known/ to let the app open /join/*
// links. That it names the builds the app config claims is checked in
// apps/mobile/src/features/training/hosted/join-link-config.test.ts.
import fs from "node:fs";
import { expect, it } from "vitest";

it("serves apple-app-site-association as application/json", () => {
	expect(fs.readFileSync("public/_headers", "utf8")).toMatch(
		/^\/\.well-known\/apple-app-site-association\n\s+Content-Type: application\/json$/m,
	);
});
