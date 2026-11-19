#!/usr/bin/env node
// The production Convex check for CI `eas build --local` runs
// (.github/workflows/eas-local-build.yml). A build whose profile talks to
// production Convex ships this checkout's JavaScript, so production must
// already run every Convex change it calls: the rule
// scripts/eas-local-build.mjs applies to local builds. Development builds use
// the dev deployment and skip the check, including its full-history fetch.
//
// Usage: node scripts/eas-build-convex-guard.mjs --profile <name> [--allow-convex-drift] [--deployed <sha>]
//   --allow-convex-drift  report drift as a warning and pass (an intentional build)
//   --deployed            compare with this commit instead of the last production deployment
// Exit codes: 0 no check needed, in step, or allowed; 1 drift; 2 could not tell.
// Needs GH_TOKEN with `deployments: read` (or `gh` signed in).
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkConvexDrift, DriftError } from "./convex-drift.mjs";
import { easProfiles, usesProductionConvex } from "./eas-local-build.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Repository-specific: where the app's eas.json lives. */
const EAS_JSON = "apps/mobile/eas.json";
const OVERRIDE = "allow_convex_drift";

/** Whether a build with this eas.json profile must pass the drift check. */
export function needsDriftCheck(easJson, profile) {
	const profiles = easProfiles(easJson);
	if (!Object.hasOwn(profiles, profile)) {
		throw new Error(
			`Unknown EAS profile "${profile}"; eas.json has ${Object.keys(profiles).join(", ")}.`,
		);
	}
	return usesProductionConvex(profiles[profile].easEnvironment);
}

/**
 * What the CI step reports for a drift result (`ok` or `drift`, or `unknown`
 * when the check could not run). `annotation` is a one-line workflow command;
 * `summary` goes to the step summary.
 */
export function outcome({ profile, status, message, allowDrift = false }) {
	const heading = `## Production Convex (\`${profile}\`)\n\n`;
	if (status === "ok") {
		return { code: 0, summary: `${heading}${message}\n` };
	}
	const problem =
		status === "drift"
			? "Production Convex lacks Convex changes this commit calls."
			: "Could not tell whether production Convex has this commit's Convex changes.";
	if (allowDrift) {
		const line = `${problem} Building \`${profile}\` anyway: \`${OVERRIDE}\` is set.`;
		return {
			code: 0,
			annotation: `::warning::${line}`,
			summary: `${heading}⚠️ ${line}\n\n${message}\n`,
		};
	}
	const fix =
		status === "drift"
			? `Deploy production first (Actions → Deploy → Run workflow on main), or rerun with \`${OVERRIDE}\` when the missing commits do not matter to the app.`
			: `Fix the error below and rerun; set \`${OVERRIDE}\` only when you know production is in step.`;
	const line = `${problem} The \`${profile}\` build stopped. ${fix}`;
	return {
		code: status === "drift" ? 1 : 2,
		annotation: `::error::${line}`,
		summary: `${heading}❌ ${line}\n\n${message}\n`,
	};
}

function option(args, name) {
	const index = args.indexOf(name);
	return index === -1 ? undefined : args[index + 1];
}

/** CI checkouts are shallow; the check walks history back to the deployed commit. */
function fetchFullHistory() {
	const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], {
		cwd: ROOT,
		encoding: "utf8",
	});
	if (shallow.stdout?.trim() !== "true") return;
	const result = spawnSync("git", ["fetch", "--quiet", "--unshallow"], {
		cwd: ROOT,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new DriftError(
			`git fetch --unshallow failed: ${result.stderr?.trim()}`,
		);
	}
}

/** Fetches the history the check walks, then compares HEAD with production. */
function checkHead(deployed) {
	fetchFullHistory();
	return checkConvexDrift({ target: "HEAD", deployed });
}

export function main(argv = process.argv.slice(2), check = checkHead) {
	const profile = option(argv, "--profile");
	if (!profile) {
		console.error(
			"Usage: eas-build-convex-guard.mjs --profile <name> [--allow-convex-drift] [--deployed <sha>]",
		);
		return 2;
	}
	let needed;
	try {
		needed = needsDriftCheck(
			JSON.parse(readFileSync(join(ROOT, EAS_JSON), "utf8")),
			profile,
		);
	} catch (error) {
		console.error(error.message);
		return 2;
	}
	if (!needed) {
		console.log(
			`The ${profile} profile uses the development Convex deployment; no drift check.`,
		);
		return 0;
	}

	let result;
	try {
		const drift = check(option(argv, "--deployed"));
		result = { status: drift.status, message: drift.message };
	} catch (error) {
		// Any failure (gh, git, a garbled API response) means "could not tell":
		// exit 2 with a summary, never an uncaught stack trace that reads as drift.
		result = { status: "unknown", message: error.message };
	}
	const { code, annotation, summary } = outcome({
		profile,
		...result,
		allowDrift: argv.includes("--allow-convex-drift"),
	});
	if (annotation && process.env.GITHUB_ACTIONS) console.log(annotation);
	(code === 0 ? console.log : console.error)(result.message);
	if (process.env.GITHUB_STEP_SUMMARY)
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
	return code;
}

if (
	process.argv[1] &&
	(await realpath(resolve(process.argv[1]))) === fileURLToPath(import.meta.url)
) {
	process.exitCode = main();
}
