import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import * as Sentry from "@sentry/node";
import { executionErrorEvent } from "./convex-sentry-events.mjs";

const args = process.argv.slice(2);
const deploymentIndex = args.indexOf("--deployment");
const deployment = deploymentIndex >= 0 ? args[deploymentIndex + 1] : args.includes("--prod") ? "production" : process.env.CONVEX_DEPLOYMENT;
if (!deployment) {
	console.error("Select a deployment with --prod, --deployment <name>, or CONVEX_DEPLOYMENT.");
	process.exit(1);
}
const environment = process.env.SENTRY_ENVIRONMENT || (args.includes("--prod") ? "production" : "development");
Sentry.init({
	dsn: process.env.SENTRY_CONVEX_DSN || "https://43d3de8058924d6c718b133785d811c8@o4504753234051072.ingest.us.sentry.io/4512164168663040",
	environment,
	dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, stackFrameVariables: false },
	defaultIntegrations: false,
	beforeSend(event) {
		delete event.request;
		delete event.extra;
		delete event.user;
		for (const exception of event.exception?.values || []) {
			if (exception.value) exception.value = exception.value
				.replace(/Bearer\s+[^\s"']+/gi, "Bearer [Filtered]")
				.replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[Filtered]")
				.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Filtered]");
		}
		return event;
	},
});

let child;
let stopping = false;
const seen = new Set();
function start() {
	console.log(`Forwarding Convex exceptions (${deployment}) to Sentry.`);
	child = spawn("pnpm", ["exec", "convex", "logs", "--jsonl", "--history", "100", ...args], { stdio: ["ignore", "pipe", "inherit"] });
	const lines = createInterface({ input: child.stdout });
	lines.on("line", (line) => {
		let entry;
		try { entry = JSON.parse(line); } catch { return; }
		const result = executionErrorEvent(entry, { environment, deployment });
		if (!result || seen.has(result.eventId)) return;
		seen.add(result.eventId);
		if (seen.size > 10000) seen.delete(seen.values().next().value);
		Sentry.withScope((scope) => {
			scope.addEventProcessor((event) => ({ ...event, timestamp: result.timestamp }));
			Sentry.captureException(result.error, { event_id: result.eventId, tags: result.tags });
		});
	});
	child.on("error", () => console.error("Could not start Convex log reader."));
	child.on("close", (code) => {
		lines.close();
		if (!stopping) {
			console.error(`Convex log reader exited (${code}); reconnecting in 5 seconds.`);
			setTimeout(start, 5000);
		}
	});
}

async function stop() {
	if (stopping) return;
	stopping = true;
	child?.kill("SIGTERM");
	await Sentry.close(5000);
	process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
start();
