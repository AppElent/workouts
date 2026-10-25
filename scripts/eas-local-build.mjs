#!/usr/bin/env node
// Runs an iOS EAS build on this Mac (`eas build --local`), which does not use
// the EAS cloud build allowance. EAS still serves credentials and non-secret
// variables, but not "Secret" ones, so this reads the manifest's secret EAS
// placements from Infisical and passes them to the build process in memory.
import { spawnSync } from "node:child_process";
import { realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	EnvironmentSourceError,
	loadEnvironmentManifest,
	loadInfisicalSource,
	runProcess,
} from "./lib/env/index.mjs";

/** EAS build profile → manifest environment, and whether it goes to TestFlight. */
export const PROFILES = {
	development: { environment: "local", submit: false },
	preview: { environment: "preview", submit: true },
	"preview-internal": { environment: "preview", submit: false },
	production: { environment: "production", submit: true },
};

/** Secret values the manifest routes to EAS; a local build cannot fetch them. */
export function secretEasPlacements(manifest, environment) {
	return manifest
		.placementsFor(environment)
		.filter((placement) => placement.entry.secret && placement.destination.kind === "eas");
}

/** Maps source values onto build variable names without logging them. */
export function secretEnv(placements, sourceValues) {
	const env = {};
	const missing = [];
	for (const placement of placements) {
		const value = sourceValues[placement.entry.infisicalKey];
		if (value) env[placement.name] = value;
		else missing.push({ key: placement.entry.key, optional: Boolean(placement.entry.optional) });
	}
	return { env, missing };
}

export function easCommands(profile, { submit = PROFILES[profile].submit } = {}) {
	const artifact = `dist/${profile}.ipa`;
	const commands = [
		["exec", "eas", "build", "--platform", "ios", "--profile", profile, "--local", "--output", artifact],
	];
	if (submit) {
		commands.push(["exec", "eas", "submit", "--platform", "ios", "--profile", profile, "--path", artifact]);
	}
	return commands;
}

function fail(message) {
	console.error(message);
	return 1;
}

export async function main(args = process.argv.slice(2)) {
	const index = args.indexOf("--profile");
	const profile = index === -1 ? undefined : args[index + 1];
	if (!profile || !Object.hasOwn(PROFILES, profile)) {
		return fail(`Pass --profile ${Object.keys(PROFILES).join("|")}.`);
	}
	if (process.platform !== "darwin") return fail("Local iOS builds need macOS with Xcode.");
	if (spawnSync("fastlane", ["--version"], { stdio: "ignore" }).status !== 0) {
		return fail("Local iOS builds need fastlane: brew install fastlane");
	}

	const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
	const manifest = await loadEnvironmentManifest(root);
	const { environment } = PROFILES[profile];
	const placements = secretEasPlacements(manifest, environment);

	let values = {};
	if (placements.length > 0) {
		try {
			({ values } = await loadInfisicalSource({ root, manifest, environment, runProcess }));
		} catch (error) {
			if (!(error instanceof EnvironmentSourceError)) throw error;
			return fail(`${error.message}. Run \`infisical login\` and retry.`);
		}
	}
	const { env, missing } = secretEnv(placements, values);
	for (const item of missing) {
		if (!item.optional) return fail(`${item.key} is missing from Infisical (${environment}).`);
		console.warn(`${item.key} is missing from Infisical (${environment}); building without it.`);
	}

	const mobile = join(root, manifest.ENV_CONFIG.mobile.path);
	// EXPO_NO_DOTENV keeps local .env.local values out of the release config.
	const childEnv = { ...process.env, ...env, EXPO_NO_DOTENV: "1" };
	const submit = PROFILES[profile].submit && !args.includes("--no-submit");
	for (const command of easCommands(profile, { submit })) {
		const result = spawnSync("pnpm", command, { cwd: mobile, env: childEnv, stdio: "inherit" });
		if (result.status !== 0) return result.status ?? 1;
	}
	return 0;
}

if (process.argv[1] && (await realpath(resolve(process.argv[1]))) === fileURLToPath(import.meta.url)) {
	process.exitCode = await main();
}
