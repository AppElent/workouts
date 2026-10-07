import { generateSW } from "workbox-build";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

// Sentry uploads during Vite's build. Never deploy public source maps, even
// when an unconfigured local/CI build deliberately skips the upload.
async function removeSourceMaps(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filename = path.join(directory, entry.name);
		if (entry.isDirectory()) await removeSourceMaps(filename);
		else if (entry.name.endsWith(".map")) await rm(filename);
	}
}
await removeSourceMaps("dist/client");

const { count, size, warnings } = await generateSW({
	globDirectory: "dist/client",
	globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
	swDest: "dist/client/sw.js",
	navigateFallbackDenylist: [/^\/api\//, /^\/convex\//],
	skipWaiting: true,
	clientsClaim: true,
	sourcemap: false,
});

for (const warning of warnings) {
	console.warn(warning);
}
console.log(`generate-sw: precached ${count} files, ${(size / 1024).toFixed(1)} KB`);
