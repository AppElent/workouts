#!/usr/bin/env node
// Reports Convex changes that a ref has and production Convex lacks.
//
// Production deploys only from a manual Deploy run (deploy.yml), so a merged
// Convex change can sit undeployed while installed apps already call it. Each
// run records a GitHub deployment in the `production` Environment with the
// commit it shipped; this compares that commit with a ref and lists the
// commits in between that change what `convex deploy` pushes. It reads only
// deployment records, never production secrets.
//
// Usage: node scripts/convex-drift.mjs [--target <ref>] [--grace-hours <n>] [--deployed <sha>] [-- <command…>]
//   --target       ref that is about to ship, or that should be live (default origin/main)
//   --grace-hours  undeployed commits younger than this only warn (default 0)
//   --deployed     compare with this commit instead of the last production deployment
//   -- <command…>  run the command when production is in step (a release guard);
//                  a command with --upload-only ships no JavaScript and skips the check
// Exit codes: 0 in step (or within grace), 1 drift, 2 could not tell.
// Needs `gh` signed in, or GH_TOKEN in CI.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "AppElent/workouts";
const ENVIRONMENT = "production";

/**
 * What `convex deploy` bundles: the functions and the core package they
 * import, including its build config. Tests never reach the deployment.
 * Dependency bumps in the root lockfile are left out: they are frequent and
 * rarely change what the app can call.
 */
export const CONVEX_PATHS = [
	"convex/",
	"packages/core/",
	":(exclude,glob)**/*.test.ts",
	":(exclude,glob)**/*.test.mjs",
];

export class DriftError extends Error {}

// Pathspecs resolve against the working directory, and release scripts run
// from apps/mobile, so every git call runs at the repository root.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The newest deployment whose latest status is `success`. Deployments arrive
 * newest first; `statesFor(id)` returns that deployment's states, newest first.
 */
export function lastSuccessfulDeployment(deployments, statesFor) {
	for (const deployment of deployments) {
		if (statesFor(deployment.id)[0] === "success") return deployment;
	}
	return undefined;
}

/** Parses `git log --format=%H%x09%cI%x09%s` output. */
export function parseCommits(log) {
	return log
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [sha, committedAt, ...subject] = line.split("\t");
			return { sha, committedAt, subject: subject.join("\t") };
		});
}

/**
 * `drift` when any undeployed commit is older than the grace period, `pending`
 * when all are newer, `ok` when there are none.
 */
export function classify(commits, { now = new Date(), graceHours = 0 } = {}) {
	if (commits.length === 0) return "ok";
	const oldest = Math.min(...commits.map((commit) => Date.parse(commit.committedAt)));
	return now.getTime() - oldest >= graceHours * 3_600_000 ? "drift" : "pending";
}

export function report({ status, deployment, target, commits }) {
	const short = (sha) => sha.slice(0, 8);
	const deployed = `production Convex runs ${short(deployment.sha)} (deployed ${deployment.created_at})`;
	if (status === "ok") return `${deployed}; ${target} has no Convex changes it lacks.`;
	const lines = commits.map((commit) => `- ${short(commit.sha)} ${commit.subject}`);
	const deploy =
		target === "origin/main"
			? "Run Actions → Deploy → Run workflow on main"
			: "Merge any of these not yet on main, run Actions → Deploy → Run workflow on main";
	const next =
		status === "drift"
			? `${deploy}, then retry.`
			: "Still inside the grace period; deploy production before it ends.";
	return [
		`${deployed}; ${target} has ${commits.length} Convex commit(s) it lacks:`,
		...lines,
		next,
	].join("\n");
}

function run(command, args, cwd = ROOT) {
	const result = spawnSync(command, args, { cwd, encoding: "utf8" });
	if (result.error) throw new DriftError(`${command} failed: ${result.error.message}`);
	if (result.status !== 0) {
		throw new DriftError(`${command} ${args.join(" ")} failed: ${result.stderr.trim()}`);
	}
	return result.stdout;
}

function ghJson(path) {
	return JSON.parse(run("gh", ["api", path]));
}

function productionDeployment() {
	const deployments = ghJson(
		`repos/${REPOSITORY}/deployments?environment=${ENVIRONMENT}&per_page=30`,
	);
	const deployment = lastSuccessfulDeployment(deployments, (id) =>
		ghJson(`repos/${REPOSITORY}/deployments/${id}/statuses?per_page=10`).map(
			(status) => status.state,
		),
	);
	if (!deployment) {
		throw new DriftError(`No successful ${ENVIRONMENT} deployment among the last 30.`);
	}
	return deployment;
}

function hasCommit(sha, cwd) {
	return spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd }).status === 0;
}

/** Whether `paths` (pathspecs) have the same content at both revisions. */
function sameContent(a, b, paths, cwd) {
	const result = spawnSync("git", ["diff", "--quiet", a, b, "--", ...paths], { cwd });
	if (result.status > 1 || result.error) throw new DriftError(`git diff ${a} ${b} failed`);
	return result.status === 0;
}

/**
 * Whether every Convex file `sha` changes (against its first parent) already
 * has that content in the deployed revision. A release branch that merges an
 * already-deployed main brings in only deployed changes, so the merge is not
 * drift.
 */
function alreadyDeployed(sha, deployedSha, cwd) {
	const files = run("git", ["diff", "--name-only", `${sha}^1`, sha, "--", ...CONVEX_PATHS], cwd)
		.split("\n")
		.filter(Boolean);
	return files.length > 0 && sameContent(deployedSha, sha, files.map((file) => `:(literal)${file}`), cwd);
}

/** Undeployed Convex commits in `target`, with the deployment they are measured against. */
export function checkConvexDrift({ target = "origin/main", graceHours = 0, deployed, now, cwd = ROOT } = {}) {
	if (target.startsWith("origin/")) {
		run("git", ["fetch", "--quiet", "origin", target.slice("origin/".length)], cwd);
	}
	const deployment = deployed
		? { sha: run("git", ["rev-parse", deployed], cwd).trim(), created_at: "as given" }
		: productionDeployment();
	if (!hasCommit(deployment.sha, cwd)) run("git", ["fetch", "--quiet", "origin", deployment.sha], cwd);
	// Identical Convex files mean nothing is missing, whatever the history says.
	const listed = sameContent(deployment.sha, target, CONVEX_PATHS, cwd)
		? []
		: parseCommits(
				run(
					"git",
					[
						"log",
						// A merge counts once, at its merge time, so a branch's older
						// commits do not skip the grace period.
						"--first-parent",
						"--format=%H%x09%cI%x09%s",
						`${deployment.sha}..${target}`,
						"--",
						...CONVEX_PATHS,
					],
					cwd,
				),
			);
	const commits = listed.filter((commit) => !alreadyDeployed(commit.sha, deployment.sha, cwd));
	const status = classify(commits, { now, graceHours });
	return { status, deployment, target, commits, message: report({ status, deployment, target, commits }) };
}

/** A source-map retry (`--upload-only`) publishes no JavaScript, so it needs no check. */
export function needsCheck(command) {
	return !command.includes("--upload-only");
}

function option(args, name, fallback) {
	const index = args.indexOf(name);
	return index === -1 ? fallback : args[index + 1];
}

export function main(argv = process.argv.slice(2)) {
	const split = argv.indexOf("--");
	const args = split === -1 ? argv : argv.slice(0, split);
	const command = split === -1 ? [] : argv.slice(split + 1);
	if (command.length > 0 && !needsCheck(command)) return runCommand(command);
	const status = check(args);
	return status === 0 && command.length > 0 ? runCommand(command) : status;
}

function runCommand([command, ...args]) {
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.error) {
		console.error(`${command} failed: ${result.error.message}`);
		return 1;
	}
	return result.status ?? 1;
}

function check(args) {
	const target = option(args, "--target", "origin/main");
	const graceHours = Number(option(args, "--grace-hours", "0"));
	const deployed = option(args, "--deployed", undefined);
	if (!target || !Number.isFinite(graceHours) || graceHours < 0) {
		console.error("Usage: convex-drift.mjs [--target <ref>] [--grace-hours <n>] [--deployed <sha>] [-- <command…>]");
		return 2;
	}
	let result;
	try {
		result = checkConvexDrift({ target, graceHours, deployed });
	} catch (error) {
		if (!(error instanceof DriftError)) throw error;
		console.error(`Could not compare production Convex with ${target}: ${error.message}`);
		return 2;
	}
	const ci = Boolean(process.env.GITHUB_ACTIONS);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Production Convex\n\n${result.message}\n`);
	}
	if (result.status === "ok") {
		console.log(result.message);
		return 0;
	}
	const level = result.status === "drift" ? "error" : "warning";
	// Annotations take one line; the full list is in the log and the summary.
	if (ci) console.log(`::${level}::Production Convex lacks ${result.commits.length} Convex commit(s) from ${target}.`);
	(result.status === "drift" ? console.error : console.warn)(result.message);
	return result.status === "drift" ? 1 : 0;
}

if (process.argv[1] && (await realpath(resolve(process.argv[1]))) === fileURLToPath(import.meta.url)) {
	process.exitCode = main();
}
