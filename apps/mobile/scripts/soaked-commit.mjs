// The newest commit published to a channel at least <hours> ago, read from
// EAS (`update:list`, then `update:view` per group for its commit and time).
// The daily production update ships this commit, so everything it publishes
// ran on Eric's phone through the preview channel first.
//
//   node scripts/soaked-commit.mjs [channel=preview] [hours=24]
//
// Prints the commit, or nothing when no update has soaked. Needs EXPO_TOKEN.
import { spawnSync } from "node:child_process";
import { soakedCommit } from "../../../scripts/lib/ota-gates.mjs";
import { appRoot } from "./fingerprint.mjs";

const [channel = "preview", hours = "24"] = process.argv.slice(2);

// `update:view` takes `--json` only; it rejects `--non-interactive`.
function eas(easArgs, flags = ["--json", "--non-interactive"]) {
	const result = spawnSync("pnpm", ["exec", "eas", ...easArgs, ...flags], {
		cwd: appRoot,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (result.status !== 0 && /Could not find branch/i.test(result.stderr)) {
		console.error(`No ${channel} branch on EAS yet.`);
		process.exit(0);
	}
	if (result.status !== 0) {
		console.error(`eas ${easArgs.join(" ")} failed:\n${result.stderr}`);
		process.exit(result.status || 1);
	}
	return JSON.parse(result.stdout);
}

// Groups come newest first. Stop at the first that has soaked: older ones
// can only be older commits.
const groups = eas(["update:list", "--branch", channel, "--limit", "25"]).currentPage ?? [];
for (const { group } of groups) {
	const found = soakedCommit(eas(["update:view", group], ["--json"]), new Date(), Number(hours));
	if (found) {
		console.error(`${channel} update ${group} from ${found.createdAt} has soaked.`);
		console.log(found.commit);
		process.exit(0);
	}
}
console.error(`No ${channel} update is ${hours} hours old yet.`);
