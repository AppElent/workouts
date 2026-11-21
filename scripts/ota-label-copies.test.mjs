import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// standards/releases.md: the OTA label format is copied unchanged, never
// reimplemented. The app (Metro and Jest cannot load an `.mjs`) and the publish
// script each hold a copy; they must not drift apart.
it("keeps the app's and the publish script's OTA label copies identical", () => {
	const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
	expect(read("../apps/mobile/src/observability/ota-label.js")).toBe(
		read("../apps/mobile/scripts/ota-label.mjs"),
	);
});
