#!/usr/bin/env node
// Runs an iOS EAS build on this Mac (`eas build --local`), which does not use
// the EAS cloud build allowance. EAS still serves credentials and non-secret
// variables, but not "Secret" ones, so this reads the manifest's secret EAS
// placements from Infisical and passes them to the build process in memory.
import { spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	EnvironmentSourceError,
	loadEnvironmentManifest,
	loadInfisicalSource,
	runProcess,
} from "./lib/env/index.mjs";

/**
 * Build profiles from eas.json, with `extends` resolved. A profile submits when
 * eas.json has a submit profile of the same name.
 */
export function easProfiles(easJson) {
	const build = easJson.build ?? {};
	const resolve = (name) => {
		const { extends: parent, ...own } = build[name];
		if (!parent) return own;
		const base = resolve(parent);
		return { ...base, ...own, ios: { ...base.ios, ...own.ios } };
	};
	return Object.fromEntries(
		Object.keys(build).map((name) => {
			const profile = resolve(name);
			return [
				name,
				{
					easEnvironment: profile.environment,
					simulator: Boolean(profile.ios?.simulator),
					submit: Object.hasOwn(easJson.submit ?? {}, name),
				},
			];
		}),
	);
}

/** The first manifest environment whose app build lands in this EAS environment. */
export function manifestEnvironment(manifest, easEnvironment) {
	return manifest.ENVIRONMENTS.find((environment) =>
		manifest
			.placementsFor(environment)
			.some(
				(placement) =>
					placement.consumer === "expo-build" &&
					placement.destination.kind === "eas" &&
					placement.destination.environment === easEnvironment,
			),
	);
}

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

export function easCommands(profile, { simulator = false, submit = false } = {}) {
	// Simulator builds produce a tarred .app, which cannot be submitted.
	const artifact = `dist/${profile}.${simulator ? "tar.gz" : "ipa"}`;
	const commands = [
		["exec", "eas", "build", "--platform", "ios", "--profile", profile, "--local", "--output", artifact],
	];
	if (submit && !simulator) {
		commands.push(["exec", "eas", "submit", "--platform", "ios", "--profile", profile, "--path", artifact]);
	}
	return commands;
}

function fail(message) {
	console.error(message);
	return 1;
}

export async function main(args = process.argv.slice(2)) {
	const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
	const manifest = await loadEnvironmentManifest(root);
	const mobile = join(root, manifest.ENV_CONFIG.mobile.path);
	const profiles = easProfiles(JSON.parse(await readFile(join(mobile, "eas.json"), "utf8")));

	const index = args.indexOf("--profile");
	const profile = index === -1 ? undefined : args[index + 1];
	if (!profile || !Object.hasOwn(profiles, profile)) {
		return fail(`Pass --profile ${Object.keys(profiles).join("|")}.`);
	}
	if (process.platform !== "darwin") return fail("Local iOS builds need macOS with Xcode.");
	if (spawnSync("fastlane", ["--version"], { stdio: "ignore" }).status !== 0) {
		return fail("Local iOS builds need fastlane: brew install fastlane");
	}

	const { easEnvironment, simulator } = profiles[profile];
	const environment = manifestEnvironment(manifest, easEnvironment);
	if (!environment) return fail(`No manifest environment builds the app for EAS ${easEnvironment}.`);
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

	// EXPO_NO_DOTENV keeps local .env.local values out of the release config.
	const childEnv = { ...process.env, ...env, EXPO_NO_DOTENV: "1" };
	const submit = profiles[profile].submit && !args.includes("--no-submit");
	for (const command of easCommands(profile, { simulator, submit })) {
		const result = spawnSync("pnpm", command, { cwd: mobile, env: childEnv, stdio: "inherit" });
		if (result.status !== 0) return result.status ?? 1;
	}
	return 0;
}

if (process.argv[1] && (await realpath(resolve(process.argv[1]))) === fileURLToPath(import.meta.url)) {
	process.exitCode = await main();
}
