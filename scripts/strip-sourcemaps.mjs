import { readdir, rm } from "node:fs/promises";
import path from "node:path";

// Vite's build has already uploaded the maps to Sentry when it is configured.
// Never serve public source maps, even from a build that skipped the upload.
async function removeSourceMaps(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filename = path.join(directory, entry.name);
		if (entry.isDirectory()) await removeSourceMaps(filename);
		else if (entry.name.endsWith(".map")) await rm(filename);
	}
}

await removeSourceMaps("dist/client");
