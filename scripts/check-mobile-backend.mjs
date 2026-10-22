#!/usr/bin/env node
/**
 * Confirms the running Metro bundle talks to the Convex deployment the env
 * files name. Metro can keep serving an old inlined `EXPO_PUBLIC_CONVEX_URL`
 * after the env changes, so `.env.local` alone does not prove where writes go.
 *
 * Bundles also inline test credentials. Output is limited to Convex origins
 * and their sources; never print bundle text from here.
 *
 * Usage: node scripts/check-mobile-backend.mjs [--port 8090]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnvText } from "./lib/env/files.mjs";

/** `"EXPO_PUBLIC_CONVEX_URL": "<url>"` or `…: { enumerable: true, value: "<url>" }`. */
const INLINED_URL =
	/"EXPO_PUBLIC_CONVEX_URL":\s*(?:\{[^}]*?value:\s*)?"(https?:\/\/[^"\s]+)"/g;

function origin(url) {
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

/** Origins the bundle inlines for `EXPO_PUBLIC_CONVEX_URL`, and nothing else. */
export function bundleConvexOrigins(bundle) {
	const found = [...bundle.matchAll(INLINED_URL)].map((match) =>
		origin(match[1]),
	);
	return [...new Set(found.filter(Boolean))].sort();
}

/**
 * `expected` maps a source label to its configured Convex URL (missing ones are
 * skipped). Every configured origin, and the bundle, must name one deployment.
 */
export function compareBackends({ expected, bundle }) {
	const configured = Object.entries(expected)
		.filter(([, url]) => url)
		.map(([source, url]) => ({ source, origin: origin(url) }));
	const inlined = bundleConvexOrigins(bundle);
	const problems = [];
	for (const { source, origin: value } of configured)
		if (!value) problems.push(`${source} is not a valid URL`);
	const target = configured.find(({ origin: value }) => value)?.origin;
	if (!target) problems.push("no Convex URL configured");
	for (const { source, origin: value } of configured)
		if (value && target && value !== target)
			problems.push(`${source} names ${value}, expected ${target}`);
	if (inlined.length === 0)
		problems.push("bundle does not inline EXPO_PUBLIC_CONVEX_URL");
	for (const value of inlined)
		if (target && value !== target)
			problems.push(`bundle uses ${value}, expected ${target}`);
	return { ok: problems.length === 0, target, bundle: inlined, problems };
}

async function readEnvFile(file) {
	try {
		return parseEnvText(await readFile(file, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return {};
		throw error;
	}
}

async function fetchBundle(port) {
	const url = `http://127.0.0.1:${port}/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&lazy=false&minify=false`;
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Metro returned ${response.status}`);
	return response.text();
}

async function main(argv) {
	const index = argv.indexOf("--port");
	const port = index === -1 ? "8090" : argv[index + 1];
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
	const mobileEnv = await readEnvFile(
		path.join(root, "apps/mobile/.env.local"),
	);
	const webEnv = await readEnvFile(path.join(root, ".env.local"));
	let bundle;
	try {
		bundle = await fetchBundle(port);
	} catch (error) {
		console.error(`No bundle from Metro on :${port} (${error.message}).`);
		return 2;
	}
	const result = compareBackends({
		expected: {
			"apps/mobile/.env.local EXPO_PUBLIC_CONVEX_URL":
				mobileEnv.EXPO_PUBLIC_CONVEX_URL,
			".env.local VITE_CONVEX_URL": webEnv.VITE_CONVEX_URL,
		},
		bundle,
	});
	console.log(`configured: ${result.target ?? "none"}`);
	console.log(`bundle:     ${result.bundle.join(", ") || "none"}`);
	for (const problem of result.problems) console.error(`MISMATCH: ${problem}`);
	if (!result.ok)
		console.error(
			"Restart Metro with a clean cache: driver.sh down, then driver.sh up --clear.",
		);
	return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
	process.exitCode = await main(process.argv.slice(2));
