/**
 * Runs a command and puts `.env.local` back exactly as it was afterwards.
 *
 *   node scripts/keep-env-local.mjs -- pnpm exec convex dev --once
 *
 * `convex dev` always rewrites `.env.local` for the deployment it pushed to:
 * `CONVEX_DEPLOYMENT` and the client URL, but not a scoped deploy key. In a
 * prepared worktree that would leave local commands on mixed backends after
 * `deploy:dev`, so the deploy runs through this wrapper. Convex 1.49 has no
 * flag for this: `--env-file` changes which deployment is chosen, not which
 * file is written.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { constants } from "node:os";

const FILE = ".env.local";

const separator = process.argv.indexOf("--");
const [command, ...args] =
	separator === -1 ? [] : process.argv.slice(separator + 1);
if (!command) {
	console.error("Usage: node scripts/keep-env-local.mjs -- <command> [args]");
	process.exit(2);
}

const snapshot = existsSync(FILE) ? readFileSync(FILE) : null;

function restore() {
	if (snapshot === null) rmSync(FILE, { force: true });
	else writeFileSync(FILE, snapshot);
}

const child = spawn(command, args, { stdio: "inherit" });

// Pass signals on and wait for the child, so the file is restored and a
// cancelled push fails instead of letting the next deploy step run.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
	process.on(signal, () => child.kill(signal));

child.on("error", (error) => {
	restore();
	console.error(`${command}: ${error.message}`);
	process.exit(1);
});
child.on("exit", (code, signal) => {
	restore();
	process.exit(code ?? 128 + (constants.signals[signal] ?? 0));
});
