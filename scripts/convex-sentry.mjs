/**
 * Forwards failed Convex executions, including scheduled and other unattended
 * functions, from `convex logs --jsonl` to Sentry.
 *
 * Upstream: docs/standards/sentry-monitoring/examples/convex-sentry.mjs. Foundry
 * differences: the DSN falls back to the manifest's local `sentryDsn` landing,
 * and the reader gives up after repeated failed starts or a Convex auth error.
 *
 *   pnpm sentry:convex --prod
 *   pnpm sentry:convex --deployment <name>
 *
 * Env: SENTRY_CONVEX_DSN or SENTRY_DSN (else the local `sentryDsn` value from
 * `pnpm env:apply local`), optional SENTRY_ENVIRONMENT and SENTRY_APP, and
 * Convex CLI auth (a logged-in CLI or a private CONVEX_DEPLOY_KEY).
 *
 * Best effort: delivery is in memory, so failures older than the replayed
 * history are lost while the forwarder is down. Run it on an always-on host.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { localLandings } from "./local-env.mjs";

const HISTORY = 100;
const SEEN_LIMIT = 10_000;
const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;
const MAX_FAILED_STARTS = 5;
const AUTH_ERROR =
	/not logged in|convex login|unauthori[sz]ed|invalid deploy key|\b40[13]\b/i;

/** Strips credentials, email addresses, and logged values from error text. */
export function sanitizeText(value) {
	return value
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [Filtered]")
		.replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[Filtered]")
		.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Filtered]")
		.replace(
			/([?&](?:token|key|password|secret|email|code|authorization)=)[^&#\s]*/gi,
			"$1[Filtered]",
		)
		.replace(/^(\s*(?:Object|Value):).*$/gm, "$1 [Filtered]");
}

/**
 * One `convex logs --jsonl` record as a Sentry exception, or null. Only final
 * failed completions, and only structural fields: never log lines, arguments,
 * return values, or the caller's identity.
 */
export function executionErrorEvent(entry, { deployment, app }) {
	if (entry?.kind !== "Completion") return null;
	if (typeof entry.error !== "string" || !entry.error) return null;
	if (typeof entry.identifier !== "string") return null;
	if (typeof entry.timestamp !== "number") return null;
	// Convex retries an OCC conflict; only the final failure counts.
	if (entry.willRetry === true) return null;
	const stack = sanitizeText(entry.error);
	const error = new Error(stack.split("\n")[0]);
	error.stack = stack;
	const eventId = createHash("sha256")
		.update(
			JSON.stringify([
				deployment,
				entry.requestId,
				entry.executionId,
				entry.identifier,
				entry.timestamp,
			]),
		)
		.digest("hex")
		.slice(0, 32);
	return {
		error,
		eventId,
		// Seconds, which is also what a Sentry event timestamp uses.
		timestamp: entry.timestamp,
		tags: {
			app,
			func: entry.identifier,
			func_type: String(entry.udfType || "unknown"),
			...(typeof entry.caller === "string" ? { caller: entry.caller } : {}),
			...(typeof entry.requestId === "string"
				? { request_id: entry.requestId }
				: {}),
		},
	};
}

/**
 * What to do when the log reader exits: reconnect with doubling backoff while
 * it keeps producing output, stop after an auth error or after
 * MAX_FAILED_STARTS exits in a row that produced no log line.
 */
export function nextAttempt({ failedStarts, backoff, authError }) {
	if (authError) return { stop: "auth" };
	if (failedStarts >= MAX_FAILED_STARTS) return { stop: "failed" };
	return { delay: backoff, backoff: Math.min(backoff * 2, MAX_BACKOFF_MS) };
}

async function sentryDsn(root) {
	const fromEnv = process.env.SENTRY_CONVEX_DSN || process.env.SENTRY_DSN;
	if (fromEnv) return fromEnv;
	const landings = await localLandings(root, "sentryDsn");
	return landings.find((landing) => landing.value)?.value;
}

async function main(args) {
	const index = args.indexOf("--deployment");
	const deployment = args.includes("--prod")
		? "production"
		: index >= 0
			? args[index + 1]
			: process.env.CONVEX_DEPLOYMENT;
	if (!deployment) {
		console.error(
			"Select one deployment: --prod, --deployment <name>, or CONVEX_DEPLOYMENT.",
		);
		process.exit(1);
	}
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const dsn = await sentryDsn(root);
	if (!dsn) {
		console.error(
			"Set SENTRY_CONVEX_DSN, or run `pnpm env:apply local` to write the Sentry DSN.",
		);
		process.exit(1);
	}
	const app =
		process.env.SENTRY_APP || `${process.env.npm_package_name || "app"}-convex`;
	const Sentry = await import("@sentry/node");
	Sentry.init({
		dsn,
		environment:
			process.env.SENTRY_ENVIRONMENT ||
			(args.includes("--prod") ? "production" : "development"),
		serverName: deployment,
		defaultIntegrations: false,
		dataCollection: {
			userInfo: false,
			cookies: false,
			httpHeaders: false,
			httpBodies: [],
			urlQueryParams: false,
			stackFrameVariables: false,
		},
		beforeSend(event) {
			delete event.request;
			delete event.extra;
			delete event.user;
			return event;
		},
	});

	const seen = new Set();
	let child;
	let stopping = false;
	let backoff = MIN_BACKOFF_MS;
	let failedStarts = 0;
	const stop = async (code = 0) => {
		if (stopping) return;
		stopping = true;
		child?.kill("SIGTERM");
		await Sentry.close(5_000);
		process.exit(code);
	};
	const start = () => {
		console.log(`Forwarding Convex failures (${deployment}) to Sentry.`);
		child = spawn(
			"pnpm",
			["exec", "convex", "logs", "--jsonl", "--history", String(HISTORY), ...args],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);
		let producedOutput = false;
		let authError = false;
		const lines = createInterface({ input: child.stdout });
		lines.on("line", (line) => {
			let entry;
			try {
				entry = JSON.parse(line);
			} catch {
				return;
			}
			producedOutput = true;
			const result = executionErrorEvent(entry, { deployment, app });
			if (!result || seen.has(result.eventId)) return;
			seen.add(result.eventId);
			if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value);
			Sentry.withScope((scope) => {
				scope.addEventProcessor((event) => ({
					...event,
					timestamp: result.timestamp,
				}));
				Sentry.captureException(result.error, {
					event_id: result.eventId,
					tags: result.tags,
				});
			});
		});
		child.stderr.on("data", (chunk) => {
			process.stderr.write(chunk);
			if (AUTH_ERROR.test(String(chunk))) authError = true;
		});
		child.on("error", (error) =>
			console.error(`Could not start the Convex log reader: ${error.message}`),
		);
		child.on("close", (code) => {
			lines.close();
			if (stopping) return;
			if (producedOutput) {
				failedStarts = 0;
				backoff = MIN_BACKOFF_MS;
			} else failedStarts += 1;
			const next = nextAttempt({ failedStarts, backoff, authError });
			if (next.stop === "auth") {
				console.error(
					"Convex rejected the log reader's credentials. Run `pnpm exec convex login` or set a valid CONVEX_DEPLOY_KEY.",
				);
				return stop(1);
			}
			if (next.stop === "failed") {
				console.error(
					`Convex log reader failed ${failedStarts} times in a row (last exit ${code}); stopping.`,
				);
				return stop(1);
			}
			console.error(
				`Convex log reader exited (${code}); reconnecting in ${next.delay / 1000}s.`,
			);
			setTimeout(start, next.delay);
			backoff = next.backoff;
		});
	};
	process.on("SIGINT", () => stop());
	process.on("SIGTERM", () => stop());
	start();
}

if (
	process.argv[1] &&
	realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await main(process.argv.slice(2));
