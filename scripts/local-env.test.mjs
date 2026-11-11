import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localLandings } from "./local-env.mjs";

function checkout(files) {
	const root = mkdtempSync(join(tmpdir(), "local-env-"));
	copyFileSync(new URL("../env.manifest.ts", import.meta.url), join(root, "env.manifest.ts"));
	mkdirSync(join(root, "apps/mobile"), { recursive: true });
	for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
	return root;
}

describe("local env landings", () => {
	it("reads one entry from every local env file the manifest writes", async () => {
		const root = checkout({
			".env.local": "VITE_CONVEX_URL=https://web.convex.cloud\n",
			"apps/mobile/.env.local": "EXPO_PUBLIC_CONVEX_URL=https://app.convex.cloud\n",
		});
		expect(await localLandings(root, "convexUrl")).toEqual([
			{ path: ".env.local", name: "VITE_CONVEX_URL", value: "https://web.convex.cloud" },
			{
				path: "apps/mobile/.env.local",
				name: "EXPO_PUBLIC_CONVEX_URL",
				value: "https://app.convex.cloud",
			},
		]);
	});

	it("treats a missing file as unset", async () => {
		const landings = await localLandings(checkout({}), "convexUrl");
		expect(landings.map(({ value }) => value)).toEqual([undefined, undefined]);
	});

	it("reports an env file it cannot read", async () => {
		const root = checkout({});
		mkdirSync(join(root, ".env.local"));
		await expect(localLandings(root, "convexUrl")).rejects.toThrow(/EISDIR/);
	});
});
