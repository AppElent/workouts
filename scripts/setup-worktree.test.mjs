import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	deriveDeploymentReference,
	parseArgs,
	pnpmExecutable,
	removeEnvVariable,
	resolveSpawnCommand,
	sanitizeComponent,
	setEnvVariable,
	setupWorktree,
} from "./setup-worktree.mjs";

const temporaryDirectories = [];

afterEach(async () => {
	for (const directory of temporaryDirectories.splice(0)) {
		await import("node:fs/promises").then(({ rm }) =>
			rm(directory, { recursive: true, force: true }),
		);
	}
});

async function fixture(name = "t3code-a2d6e26a") {
	const parent = await mkdtemp(path.join(os.tmpdir(), "worktree-setup-"));
	temporaryDirectories.push(parent);
	const cwd = path.join(parent, name);
	await mkdir(path.join(cwd, "apps", "mobile"), { recursive: true });
	return cwd;
}

function cloudOptions(overrides = {}) {
	return {
		...parseArgs([
			"--convex=cloud",
			"--project=eric-jansen:workout-tracker",
			"--editor=t3code",
			"--install=false",
			"--push=false",
		]),
		...overrides,
	};
}

function selectingRunner(
	cwd,
	calls,
	{ key = "dev:new-deployment|secret-value" } = {},
) {
	return async ({ command, args }) => {
		calls.push([command, ...args]);
		if (args.includes("select")) {
			return { code: 1, stdout: "", stderr: "Deployment not found" };
		}
		if (args.includes("create") && args.includes("deployment")) {
			await writeFile(
				path.join(cwd, ".env.local"),
				"# web\nCONVEX_DEPLOYMENT=dev:new-deployment\nVITE_CONVEX_URL=https://new.convex.cloud\n",
			);
		}
		if (args.includes("token")) {
			await writeFile(
				path.join(cwd, ".env.local"),
				`# web\nCONVEX_DEPLOYMENT=dev:new-deployment\nVITE_CONVEX_URL=https://new.convex.cloud\nCONVEX_DEPLOY_KEY=${key}\n`,
			);
			return {
				code: 0,
				stdout: `CONVEX_DEPLOY_KEY=${key}`,
				stderr: "",
			};
		}
		return { code: 0, stdout: "", stderr: "" };
	};
}

describe("worktree identity", () => {
	it("sanitizes names and derives a stable bounded reference", () => {
		expect(sanitizeComponent(" Feature/LOUD name!! ")).toBe(
			"feature-loud-name",
		);
		expect(
			deriveDeploymentReference({
				worktreePath: "/tmp/t3code-a2d6e26a",
				userName: "Eric J.",
				editor: "T3 Code",
			}),
		).toBe("dev/eric-j-t3-code/t3code-a2d6e26a");
		const reference = deriveDeploymentReference({
			worktreePath: `/tmp/${"very-long-name-".repeat(12)}`,
			userName: "user",
			editor: "editor",
		});
		expect(reference).toMatch(/^[a-z0-9/-]+$/);
		expect(reference.length).toBeLessThanOrEqual(100);
	});

	it("strips the exact editor prefix from matching worktree names", () => {
		expect(
			deriveDeploymentReference({
				worktreePath: "/tmp/t3code-a2d6e26a",
				userName: "ericj",
				editor: "t3code",
			}),
		).toBe("dev/ericj-t3code/a2d6e26a");
	});
});

describe("arguments and commands", () => {
	it("defaults to dependency-only mode", () => {
		expect(parseArgs([])).toMatchObject({ convex: "none", seed: false });
	});

	it("accepts expiration days and validates seed mode", () => {
		expect(
			parseArgs([
				"--convex=cloud",
				"--project=team:project",
				"--days=9",
				"--seed=true",
			]).expiration,
		).toBe("in 9 days");
		expect(() => parseArgs(["--convex=local", "--seed=true"])).toThrow(
			"supported only in cloud mode",
		);
		expect(() => parseArgs(["--convex=local", "--days=2"])).toThrow(
			"supported only in cloud mode",
		);
		expect(() =>
			parseArgs([
				"--convex=cloud",
				"--project=team:project",
				"--days=2",
				"--expiration=in 3 days",
			]),
		).toThrow("either --days or --expiration");
	});

	it("selects platform-specific pnpm executables", () => {
		expect(pnpmExecutable("win32")).toBe("pnpm.cmd");
		expect(pnpmExecutable("linux")).toBe("pnpm");
		expect(pnpmExecutable("darwin")).toBe("pnpm");
		expect(
			resolveSpawnCommand({
				command: "pnpm.cmd",
				args: ["install"],
				platform: "win32",
				env: { npm_execpath: "C:\\pnpm\\pnpm.cjs" },
				execPath: "C:\\node\\node.exe",
			}),
		).toEqual({
			command: "C:\\node\\node.exe",
			args: ["C:\\pnpm\\pnpm.cjs", "install"],
		});
		expect(
			resolveSpawnCommand({
				command: "pnpm",
				args: ["install"],
				platform: "linux",
			}),
		).toEqual({ command: "pnpm", args: ["install"] });
	});
});

describe("environment editing", () => {
	it("removes only a stale deploy-key line and preserves all other content", () => {
		const source =
			"# keep this\r\nVITE_CONVEX_URL=https://old.convex.cloud\r\n\r\nCONVEX_DEPLOY_KEY=not-a-real-key\r\nOTHER=value\r\n";
		expect(removeEnvVariable(source, "CONVEX_DEPLOY_KEY")).toBe(
			"# keep this\r\nVITE_CONVEX_URL=https://old.convex.cloud\r\n\r\nOTHER=value\r\n",
		);
	});

	it("updates an existing Expo URL without changing unrelated lines", () => {
		expect(
			setEnvVariable(
				"# mobile\nEXPO_PUBLIC_CONVEX_URL=https://old.example\nEXPO_PUBLIC_CLERK_KEY=pk_test_placeholder\n",
				"EXPO_PUBLIC_CONVEX_URL",
				"https://new.convex.cloud",
			),
		).toBe(
			"# mobile\nEXPO_PUBLIC_CONVEX_URL=https://new.convex.cloud\nEXPO_PUBLIC_CLERK_KEY=pk_test_placeholder\n",
		);
	});

	it("adds a missing Expo URL", () => {
		expect(
			setEnvVariable(
				"# mobile\nOTHER=value\n",
				"EXPO_PUBLIC_CONVEX_URL",
				"https://new.convex.cloud",
			),
		).toBe(
			"# mobile\nOTHER=value\nEXPO_PUBLIC_CONVEX_URL=https://new.convex.cloud\n",
		);
	});
});

describe("setup orchestration", () => {
	it("runs only dependency installation in the default mode", async () => {
		const cwd = await fixture();
		const calls = [];
		await setupWorktree(parseArgs([]), {
			cwd,
			platform: "win32",
			runner: async ({ command, args }) => {
				calls.push([command, ...args]);
				return { code: 0, stdout: "", stderr: "" };
			},
			logger: () => {},
		});
		expect(calls).toEqual([["pnpm.cmd", "install"]]);
	});

	it("is idempotent and does not create or mint twice", async () => {
		const cwd = await fixture();
		const calls = [];
		const logs = [];
		const runner = selectingRunner(cwd, calls);
		await setupWorktree(cloudOptions(), {
			cwd,
			env: { USER: "ericj" },
			platform: "linux",
			runner,
			logger: (message) => logs.push(message),
			errorLogger: (message) => logs.push(message),
		});
		await setupWorktree(cloudOptions(), {
			cwd,
			env: { USER: "ericj" },
			platform: "linux",
			runner,
			logger: (message) => logs.push(message),
			errorLogger: (message) => logs.push(message),
		});

		expect(
			calls.filter(
				(call) =>
					call.slice(1, 5).join(" ") === "exec convex deployment create",
			),
		).toHaveLength(1);
		expect(calls.filter((call) => call.includes("token"))).toHaveLength(1);
		expect(
			await readFile(path.join(cwd, "apps", "mobile", ".env.local"), "utf8"),
		).toContain("EXPO_PUBLIC_CONVEX_URL=https://new.convex.cloud");
		expect(logs.join("\n")).not.toContain("top-secret");
		expect(logs.join("\n")).not.toContain("secret-value");
	});

	it("selects an existing cloud deployment without creating it", async () => {
		const cwd = await fixture();
		const calls = [];
		const logs = [];
		await setupWorktree(cloudOptions({ scopedKey: false }), {
			cwd,
			env: { USER: "ericj" },
			runner: async ({ args }) => {
				calls.push(args);
				await writeFile(
					path.join(cwd, ".env.local"),
					"CONVEX_DEPLOYMENT=dev:existing\nVITE_CONVEX_URL=https://existing.convex.cloud\n",
				);
				return { code: 0, stdout: "", stderr: "" };
			},
			logger: (message) => logs.push(message),
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain("select");
		expect(logs.join("\n")).toContain("Deployment exists; selected");
	});

	it("seeds only after a successful cloud push", async () => {
		const cwd = await fixture();
		const calls = [];
		await setupWorktree(
			cloudOptions({
				push: true,
				seed: true,
				scopedKey: false,
				expiration: "in 9 days",
			}),
			{
				cwd,
				env: { USER: "ericj" },
				runner: selectingRunner(cwd, calls),
				logger: () => {},
				errorLogger: () => {},
			},
		);
		const pushIndex = calls.findIndex(
			(call) => call.slice(1).join(" ") === "exec convex dev --once",
		);
		const seedIndex = calls.findIndex(
			(call) => call.slice(1).join(" ") === "seed:reset",
		);
		expect(pushIndex).toBeGreaterThan(-1);
		expect(seedIndex).toBeGreaterThan(pushIndex);
		const createCall = calls.find(
			(call) => call.slice(1, 5).join(" ") === "exec convex deployment create",
		);
		expect(createCall).toEqual(expect.arrayContaining(["in 9 days"]));
	});

	it("does not seed when the cloud push fails", async () => {
		const cwd = await fixture();
		const calls = [];
		const baseRunner = selectingRunner(cwd, calls);
		await expect(
			setupWorktree(
				cloudOptions({ push: true, seed: true, scopedKey: false }),
				{
					cwd,
					env: { USER: "ericj" },
					runner: async (invocation) => {
						if (invocation.args.includes("--once")) {
							calls.push([invocation.command, ...invocation.args]);
							return { code: 1, stdout: "", stderr: "push failed" };
						}
						return baseRunner(invocation);
					},
					logger: () => {},
					errorLogger: () => {},
				},
			),
		).rejects.toThrow("Convex function push failed");
		expect(calls.some((call) => call.includes("seed:reset"))).toBe(false);
	});

	it("does no work or writes in dry-run mode", async () => {
		const cwd = await fixture();
		const calls = [];
		const logs = [];
		await setupWorktree(cloudOptions({ dryRun: true }), {
			cwd,
			env: { USER: "ericj" },
			runner: async (command) => {
				calls.push(command);
				return { code: 0, stdout: "", stderr: "" };
			},
			logger: (message) => logs.push(message),
		});
		expect(calls).toHaveLength(0);
		await expect(
			readFile(path.join(cwd, ".worktree-setup.json"), "utf8"),
		).rejects.toMatchObject({
			code: "ENOENT",
		});
		expect(logs.join("\n")).toContain("Would select or create");
	});

	it("bootstraps missing local configuration once and explains the persistent process", async () => {
		const cwd = await fixture("manual-local-worktree");
		const calls = [];
		const logs = [];
		await setupWorktree(parseArgs(["--convex=local", "--install=false"]), {
			cwd,
			env: { USER: "ericj" },
			runner: async ({ args }) => {
				calls.push(args);
				if (args.includes("select")) {
					return {
						code: 1,
						stdout: "",
						stderr: "No local deployment found.",
					};
				}
				await writeFile(
					path.join(cwd, ".env.local"),
					"CONVEX_DEPLOYMENT=local:test\nVITE_CONVEX_URL=http://127.0.0.1:3210\n",
				);
				return { code: 0, stdout: "", stderr: "" };
			},
			logger: (message) => logs.push(message),
			errorLogger: (message) => logs.push(message),
		});
		expect(calls.filter((args) => args.includes("--once"))).toHaveLength(1);
		expect(calls.some((args) => args.includes("create"))).toBe(false);
		expect(logs.join("\n")).toContain("Keep `pnpm exec convex dev` running");
	});

	it("stops after deployment creation fails and restores the original env", async () => {
		const cwd = await fixture();
		const secret = "dev:old|do-not-log-this";
		const original = `# original\nCONVEX_DEPLOY_KEY=${secret}\nOTHER=value\n`;
		await writeFile(path.join(cwd, ".env.local"), original);
		const calls = [];
		const logs = [];
		await expect(
			setupWorktree(cloudOptions({ push: true }), {
				cwd,
				env: { USER: "ericj", CONVEX_DEPLOY_KEY: secret },
				runner: async ({ args, env }) => {
					calls.push(args);
					expect(env.CONVEX_DEPLOY_KEY).toBeUndefined();
					if (args.includes("select")) {
						return { code: 1, stdout: "", stderr: "Deployment not found" };
					}
					return { code: 1, stdout: "", stderr: "network unavailable" };
				},
				logger: (message) => logs.push(message),
				errorLogger: (message) => logs.push(message),
			}),
		).rejects.toThrow("Convex deployment creation failed");
		expect(calls).toHaveLength(2);
		expect(calls.some((args) => args.includes("token"))).toBe(false);
		expect(calls.some((args) => args.includes("--once"))).toBe(false);
		expect(await readFile(path.join(cwd, ".env.local"), "utf8")).toBe(original);
		expect(logs.join("\n")).not.toContain(secret);
	});

	it("does not classify authentication failure as a missing deployment", async () => {
		const cwd = await fixture();
		const calls = [];
		await expect(
			setupWorktree(cloudOptions(), {
				cwd,
				env: { USER: "ericj" },
				runner: async ({ args }) => {
					calls.push(args);
					return { code: 1, stdout: "", stderr: "Authentication failed" };
				},
				logger: () => {},
				errorLogger: () => {},
			}),
		).rejects.toThrow("refusing to create");
		expect(calls).toHaveLength(1);
	});
});
