// Read-only navigation comparison on this worktree's scoped Convex deployment.
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ConvexProvider, ConvexReactClient, useQueries } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
	ConvexQueryCacheProvider,
	useQueries as useCachedQueries,
} from "convex-helpers/react/cache";
import { createElement, useEffect } from "react";
import { act, create } from "react-test-renderer";

const root = new URL("../../../", import.meta.url);
const setup = JSON.parse(
	readFileSync(new URL(".worktree-setup.json", root), "utf8"),
);
const env = Object.fromEntries(
	readFileSync(new URL(".env.local", root), "utf8")
		.split("\n")
		.filter((line) => /^[A-Z_]+=/.test(line))
		.map((line) => {
			const split = line.indexOf("=");
			return [
				line.slice(0, split),
				line
					.slice(split + 1)
					.split(" #")[0]
					.replace(/^['"]|['"]$/g, ""),
			];
		}),
);
const deployment = setup.deploymentName.split(" #")[0].replace(/^dev:/, "");
const key = env.CONVEX_DEPLOY_KEY;
const url = env.CONVEX_URL ?? env.VITE_CONVEX_URL;
if (
	!setup.scopedKeyCreated ||
	setup.mode !== "cloud" ||
	!setup.reference.includes(":dev/") ||
	!key?.startsWith(`dev:${deployment}|`) ||
	!url ||
	new URL(url).hostname.split(".")[0] !== deployment
)
	throw new Error(
		"A matching scoped, isolated development worktree is required.",
	);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const subject = `query-cache-${randomUUID()}`;
const identity = {
	subject,
	issuer: "https://query-cache.invalid",
	tokenIdentifier: `https://query-cache.invalid|${subject}`,
};
const date = new Date().toISOString().slice(0, 10);
const queries = {
	routines: { query: makeFunctionReference("routines:list"), args: {} },
	active: {
		query: makeFunctionReference("workoutSessions:getActive"),
		args: {},
	},
	diary: { query: makeFunctionReference("nutritionDiary:day"), args: { date } },
	goals: {
		query: makeFunctionReference("nutritionGoals:forDate"),
		args: { date },
	},
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function measure(cached) {
	const metrics = {
		visits: 10,
		queryAdds: 0,
		queryRemoves: 0,
		responseBytes: 0,
	};
	class MeasuredWebSocket extends WebSocket {
		constructor(...args) {
			super(...args);
			this.addEventListener("message", (event) => {
				metrics.responseBytes +=
					typeof event.data === "string"
						? Buffer.byteLength(event.data)
						: (event.data.byteLength ?? event.data.size);
			});
		}
		send(data) {
			const message = JSON.parse(data);
			if (message.type === "ModifyQuerySet") {
				for (const change of message.modifications) {
					if (change.type === "Add") metrics.queryAdds++;
					if (change.type === "Remove") metrics.queryRemoves++;
				}
			}
			super.send(data);
		}
	}
	const client = new ConvexReactClient(url, {
		webSocketConstructor: MeasuredWebSocket,
		unsavedChangesWarning: false,
		logger: false,
	});
	client.setAdminAuth(key, identity);
	let ready = false;
	function Page() {
		const result = (cached ? useCachedQueries : useQueries)(queries);
		for (const value of Object.values(result))
			if (value instanceof Error) throw value;
		useEffect(() => {
			ready = Object.values(result).every((value) => value !== undefined);
		}, [result]);
		return null;
	}
	const tree = (shown) =>
		createElement(
			ConvexProvider,
			{ client },
			cached
				? createElement(
						ConvexQueryCacheProvider,
						{ expiration: 30_000, maxIdleEntries: 20 },
						shown ? createElement(Page) : null,
					)
				: shown
					? createElement(Page)
					: null,
		);
	let view;
	try {
		await act(async () => {
			view = create(tree(false));
		});
		for (let index = 0; index < metrics.visits; index++) {
			ready = false;
			await act(async () => {
				view.update(tree(true));
			});
			const deadline = Date.now() + 15_000;
			while (!ready) {
				if (Date.now() > deadline)
					throw new Error("Query readiness timed out.");
				await act(async () => {
					await delay(50);
				});
			}
			await act(async () => {
				view.update(tree(false));
			});
			await delay(100);
		}
	} finally {
		if (view)
			await act(async () => {
				view.unmount();
			});
		await delay(100);
		await client.close();
	}
	return metrics;
}

const report = {
	observedAt: new Date().toISOString(),
	deployment,
	note: "Read-only empty-account navigation; wire counts/bytes are not billed function usage. No background edits in this workload.",
	baseline: await measure(false),
	cached: await measure(true),
};
if (process.argv[2])
	writeFileSync(
		fileURLToPath(new URL(process.argv[2], `file://${process.cwd()}/`)),
		`${JSON.stringify(report, null, 2)}\n`,
	);
console.log(JSON.stringify(report, null, 2));
