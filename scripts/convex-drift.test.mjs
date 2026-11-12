import { classify, lastSuccessfulDeployment, parseCommits, report } from "./convex-drift.mjs";

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
