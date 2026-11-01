// Prints one JSON snapshot for the operations dashboard: Convex usage counts
// and outdated npm dependencies across the workspace.
// Usage: pnpm monitor:snapshot [--prod | --deployment <name>] [--out <file>]
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const option = (name) => {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
};
const deploymentArgs = args.includes("--prod")
	? ["--prod"]
	: option("--deployment")
		? ["--deployment", option("--deployment")]
		: [];

/** pnpm exits non-zero when it finds outdated packages; its stdout is still the report. */
function run(command, commandArgs) {
	try {
		return execFileSync(command, commandArgs, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			maxBuffer: 16 * 1024 * 1024,
		});
	} catch (error) {
		if (error.stdout?.trim()) return error.stdout;
		throw new Error(error.stderr?.trim() || error.message);
	}
}

function convexUsage() {
	try {
		const output = run("pnpm", [
			"exec",
			"convex",
			"run",
			"monitoring:usageSnapshot",
			"{}",
			...deploymentArgs,
		]);
		return {
			deployment: args.includes("--prod")
				? "production"
				: option("--deployment") || "dev",
			...JSON.parse(output),
		};
	} catch (error) {
		console.error(`Convex usage skipped: ${error.message}`);
		return null;
	}
}

function outdatedPackages() {
	const report = JSON.parse(
		run("pnpm", ["outdated", "--recursive", "--format", "json"]) || "{}",
	);
	return Object.entries(report)
		.map(([name, info]) => ({
			name,
			current: info.current,
			wanted: info.wanted,
			latest: info.latest,
			deprecated: Boolean(info.isDeprecated),
			dependencyType: info.dependencyType,
			workspaces: (info.dependentPackages || []).map((pkg) => pkg.name),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

const snapshot = {
	generatedAt: new Date().toISOString(),
	convex: convexUsage(),
	npm: { packages: outdatedPackages() },
};
const json = `${JSON.stringify(snapshot, null, 2)}\n`;
const out = option("--out");
if (out) {
	writeFileSync(out, json);
	console.error(`Wrote ${out}`);
} else {
	process.stdout.write(json);
}
