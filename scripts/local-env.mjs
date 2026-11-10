// Reads what `pnpm env:apply local` (and workspace prepare) wrote into this
// checkout's env files, using the manifest's routing for file paths and names.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvironmentManifest, parseEnvText } from "./lib/env/index.mjs";

async function readEnvFile(file) {
	try {
		return parseEnvText(await readFile(file, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return {};
		throw error;
	}
}

/**
 * Every local env-file landing of one manifest entry, in manifest order:
 * `{ path, name, value }`, where `value` is undefined when the file or line is
 * missing.
 */
export async function localLandings(root, key) {
	const manifest = await loadEnvironmentManifest(root);
	const files = new Map();
	const landings = [];
	for (const placement of manifest.placementsFor("local")) {
		if (placement.entry.key !== key || placement.destination.kind !== "file")
			continue;
		const { path } = placement.destination;
		if (!files.has(path)) files.set(path, await readEnvFile(join(root, path)));
		landings.push({
			path,
			name: placement.name,
			value: files.get(path)[placement.name] || undefined,
		});
	}
	return landings;
}
