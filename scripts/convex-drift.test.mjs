import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	checkConvexDrift,
	classify,
	guard,
	lastSuccessfulDeployment,
	main,
	needsCheck,
	parseCommits,
	report,
} from "./convex-drift.mjs";

const commit = (sha, committedAt, subject = "change") => ({ sha, committedAt, subject });

describe("Convex drift", () => {
	it("measures against the newest deployment that succeeded", () => {
		const deployments = [
			{ id: 3, sha: "c" }, // still running
			{ id: 2, sha: "b" }, // failed after an earlier attempt
			{ id: 1, sha: "a" },
		];
		const states = { 3: ["in_progress"], 2: ["failure", "in_progress"], 1: ["success", "in_progress"] };
		expect(lastSuccessfulDeployment(deployments, (id) => states[id])).toEqual({ id: 1, sha: "a" });
		expect(lastSuccessfulDeployment([{ id: 3, sha: "c" }], (id) => states[id])).toBeUndefined();
	});

	it("parses git log lines, keeping tabs in subjects", () => {
		expect(parseCommits("abc\t2026-11-11T08:00:00+01:00\tfix: a\tb\n\n")).toEqual([
			commit("abc", "2026-11-11T08:00:00+01:00", "fix: a\tb"),
		]);
	});

	it("fails only once the oldest undeployed commit outlives the grace period", () => {
		const now = new Date("2026-11-12T10:00:00Z");
		expect(classify([], { now, graceHours: 24 })).toBe("ok");
		const fresh = [commit("b", "2026-11-12T09:00:00Z")];
		expect(classify(fresh, { now, graceHours: 24 })).toBe("pending");
		expect(classify(fresh, { now })).toBe("drift");
		const stale = [...fresh, commit("a", "2026-11-11T09:00:00Z")];
		expect(classify(stale, { now, graceHours: 24 })).toBe("drift");
		const future = [commit("c", "2026-11-12T10:05:00Z")];
		expect(classify(future, { now })).toBe("drift");
	});

	it("names the deployed commit, the missing ones, and the fix", () => {
		const message = report({
			status: "drift",
			deployment: { sha: "d7310be79330", created_at: "2026-11-11T07:40:14Z" },
			target: "origin/main",
			commits: [commit("a669468d1234", "2026-11-11T12:00:00Z", "refactor: untangle (#194)")],
		});
		expect(message).toContain("production Convex runs d7310be7");
		expect(message).toContain("- a669468d refactor: untangle (#194)");
		expect(message).toContain("Run workflow on main");
	});
});

describe("Convex drift against git history", () => {
	let cwd;
	const git = (...args) => {
		const result = spawnSync("git", args, { cwd, encoding: "utf8" });
		if (result.status !== 0) throw new Error(result.stderr);
		return result.stdout.trim();
	};
	const commit = (file, content, message) => {
		mkdirSync(join(cwd, dirname(file)), { recursive: true });
		writeFileSync(join(cwd, file), content);
		git("add", "-A");
		git("commit", "-qm", message);
		return git("rev-parse", "HEAD");
	};
	const drift = (deployed, target = "HEAD") =>
		checkConvexDrift({ cwd, deployed, target }).commits.map((c) => c.subject);

	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), "convex-drift-"));
		git("init", "-q", "-b", "main");
		git("config", "user.email", "test@example.com");
		git("config", "user.name", "Test");
		git("config", "commit.gpgsign", "false");
		git("config", "core.hooksPath", "/dev/null");
		commit("convex/foods.ts", "v1", "base");
	});
	afterEach(() => rmSync(cwd, { recursive: true, force: true }));

	it("lists Convex commits and ignores tests and other paths", () => {
		const deployed = git("rev-parse", "HEAD");
		commit("src/app.ts", "web", "web only");
		commit("convex/foods.test.ts", "t", "test only");
		commit("packages/core/src/units.ts", "u", "core change");
		expect(drift(deployed)).toEqual(["core change"]);
	});

	it("does not count a release branch's merge of already-deployed main", () => {
		git("checkout", "-qb", "release");
		commit("apps/mobile/app.ts", "m", "mobile only");
		git("checkout", "-q", "main");
		const deployed = commit("convex/foods.ts", "v2", "deployed change");
		git("checkout", "-q", "release");
		git("merge", "-q", "--no-edit", "main");
		expect(drift(deployed)).toEqual([]);
	});

	it("still lists a release branch's own Convex commit beside that merge", () => {
		git("checkout", "-qb", "release");
		commit("convex/sets.ts", "own", "branch change");
		git("checkout", "-q", "main");
		const deployed = commit("convex/foods.ts", "v2", "deployed change");
		git("checkout", "-q", "release");
		git("merge", "-q", "--no-edit", "main");
		expect(drift(deployed)).toEqual(["branch change"]);
	});

	it("does not count a merge of main that production has since moved past", () => {
		git("checkout", "-qb", "release");
		commit("apps/mobile/app.ts", "m", "mobile only");
		git("checkout", "-q", "main");
		commit("convex/foods.ts", "v2", "merged change");
		git("checkout", "-q", "release");
		git("merge", "-q", "--no-edit", "main");
		git("checkout", "-q", "main");
		const deployed = commit("convex/foods.ts", "v3", "later deployed change");
		git("checkout", "-q", "release");
		expect(drift(deployed)).toEqual([]);
	});

	it("lists Convex code written in a merge of deployed main", () => {
		git("checkout", "-qb", "release");
		commit("apps/mobile/app.ts", "m", "mobile only");
		git("checkout", "-q", "main");
		const deployed = commit("convex/foods.ts", "v2", "deployed change");
		git("checkout", "-q", "release");
		git("merge", "-q", "--no-commit", "main");
		writeFileSync(join(cwd, "convex/endpoint.ts"), "new");
		git("add", "-A");
		git("commit", "-qm", "merge with an extra endpoint");
		expect(drift(deployed)).toEqual(["merge with an extra endpoint"]);
	});

	it("lists a merge that brings in undeployed Convex changes", () => {
		const deployed = git("rev-parse", "HEAD");
		git("checkout", "-qb", "release");
		commit("apps/mobile/app.ts", "m", "mobile only");
		git("checkout", "-q", "main");
		commit("convex/foods.ts", "v2", "undeployed change");
		git("checkout", "-q", "release");
		git("merge", "-q", "--no-edit", "main");
		expect(drift(deployed)).toEqual(["Merge branch 'main' into release"]);
	});

	it("is in step when the Convex files match, even after a change and its revert", () => {
		const deployed = git("rev-parse", "HEAD");
		commit("convex/foods.ts", "v2", "change");
		commit("convex/foods.ts", "v1", "revert");
		expect(drift(deployed)).toEqual([]);
	});
});

describe("release guard", () => {
	it("runs a source-map retry without checking and passes on its exit code", () => {
		const exit = main(["--target", "HEAD", "--", "node", "-e", "process.exit(3)", "--", "--upload-only"]);
		expect(exit).toBe(3);
	});

	it("runs the command only after the check passes, keeping its exit code", () => {
		const ran = [];
		const runCommand = (command) => {
			ran.push(command);
			return 4;
		};
		expect(guard(["publish"], () => 1, runCommand)).toBe(1);
		expect(guard(["publish"], () => 2, runCommand)).toBe(2);
		expect(ran).toEqual([]);
		expect(guard(["publish"], () => 0, runCommand)).toBe(4);
		expect(ran).toEqual([["publish"]]);
		expect(guard([], () => 1, runCommand)).toBe(1);
	});

	it("refuses an option where the command should be", () => {
		expect(main(["--", "--target", "HEAD"])).toBe(2);
	});

	it("skips the check only for source-map-only retries", () => {
		expect(needsCheck(["node", "publish-update.mjs", "preview", "--message", "x"])).toBe(true);
		expect(needsCheck(["node", "publish-update.mjs", "production", "--upload-only"])).toBe(false);
	});
});
