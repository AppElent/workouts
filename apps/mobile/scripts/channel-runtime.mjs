// Which platforms can take an OTA update on a channel right now: those where
// an earlier update or a finished EAS build already runs this checkout's
// runtime fingerprint. Used by the mobile-update workflows.
//
//   node scripts/channel-runtime.mjs <preview|production> [--platform <p>]
//     [--force] [--summary <file>] [--output <file>]
//
// Writes `platforms=<space-separated>` and `due=<space-separated>` to
// --output (GITHUB_OUTPUT) and a Markdown line per platform to --summary.
// Needs EXPO_TOKEN.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { matchPlatforms } from "../../../scripts/lib/ota-gates.mjs";
import { appRoot, fingerprint, PLATFORMS } from "./fingerprint.mjs";

const args = process.argv.slice(2);
const channel = args[0];
if (!["preview", "production"].includes(channel)) {
	console.error("Usage: channel-runtime.mjs <preview|production> [--force] [--summary <file>] [--output <file>]");
	process.exit(1);
}
const option = (name) => {
	const index = args.indexOf(name);
	return index === -1 ? undefined : args[index + 1];
};
const force = args.includes("--force");
const env = { ...process.env, APP_VARIANT: channel };

/**
 * Parsed JSON from an `eas` command; exits on failure, since a gate must not
 * guess. `missing` is returned instead when stderr matches `missingPattern`.
 */
function eas(easArgs, missing, missingPattern) {
	const result = spawnSync("pnpm", ["exec", "eas", ...easArgs, "--json", "--non-interactive"], {
		cwd: appRoot,
		env,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (result.status !== 0 && missingPattern?.test(`${result.stdout}${result.stderr}`)) {
		return missing;
	}
	if (result.status !== 0) {
		console.error(`eas ${easArgs.join(" ")} failed:\n${result.stderr}`);
		process.exit(result.status || 1);
	}
	return JSON.parse(result.stdout);
}

const only = option("--platform");
if (only && !PLATFORMS.includes(only)) {
	console.error(`Unknown platform "${only}"`);
	process.exit(1);
}
// Android is paused until the repository variable ANDROID_ENABLED is `true`;
// the workflows pass it in (developer-home standards/releases.md, "Android pause").
const active = PLATFORMS.filter((p) => p !== "android" || process.env.ANDROID_ENABLED === "true");
const results = active.filter((p) => !only || p === only).map((platform) => {
	const runtime = fingerprint(channel, platform).hash;
	const updates = (
		// The branch only exists after the channel's first update: none yet.
		eas(
			["update:list", "--branch", channel, "--runtime-version", runtime, "--limit", "50"],
			{ currentPage: [] },
			/Could not find branch/i,
		).currentPage ?? []
	).filter((group) => String(group.platforms).includes(platform)).length;
	const builds = eas([
		"build:list",
		"--platform",
		platform,
		"--channel",
		channel,
		"--runtime-version",
		runtime,
		"--status",
		"finished",
		"--limit",
		"1",
	]).length;
	return { platform, runtime, updates, builds };
});

const { publish, due } = matchPlatforms(results, force);
const lines = results.map(({ platform, runtime }) =>
	publish.includes(platform)
		? `- ${platform} \`${runtime.slice(0, 12)}\`: publishing to \`${channel}\``
		: `- ${platform} \`${runtime.slice(0, 12)}\`: **native change, ${channel === "production" ? "store build due" : "rebuild `preview-internal`"}** (nothing on \`${channel}\` has this fingerprint)`,
);
console.log(lines.join("\n"));
const summary = option("--summary");
if (summary) appendFileSync(summary, `${lines.join("\n")}\n`);
const output = option("--output");
if (output) appendFileSync(output, `platforms=${publish.join(" ")}\ndue=${due.join(" ")}\n`);
