// Writes synthetic fixtures only to the selected, scoped worktree deployment.
// Run after `convex dev --once`; never run against a shared or production deployment.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConvexClient, ConvexHttpClient } from "convex/browser";
import { SHIPPED_EXERCISES } from "@workouts/core/exercises";
import { calculateOneRepMax } from "@workouts/core";

const setup = JSON.parse(readFileSync(".worktree-setup.json", "utf8"));
if (!setup.scopedKeyCreated || setup.mode !== "cloud" || !setup.reference.includes(":dev/")) {
	throw new Error("A scoped, isolated development worktree is required.");
}
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter(line => /^[A-Z_]+=/.test(line)).map(line => {
	const split = line.indexOf("=");
	return [line.slice(0, split), line.slice(split + 1).split(" #")[0].replace(/^['"]|['"]$/g, "")];
}));
const key = env.CONVEX_DEPLOY_KEY;
const url = env.CONVEX_URL ?? env.VITE_CONVEX_URL;
const deployment = setup.deploymentName.split(" #")[0].replace(/^dev:/, "");
if (!key || !url || new URL(url).hostname.split(".")[0] !== deployment || !key.startsWith(`dev:${deployment}|`)) {
	throw new Error("The scoped key, URL and worktree deployment must match.");
}
const subject = `issue89-${randomUUID()}`;
const identity = { subject, issuer: "https://issue89.invalid", tokenIdentifier: `https://issue89.invalid|${subject}` };
const directory = mkdtempSync(join(tmpdir(), "issue89-usage-"));
let httpBytes = 0;
let wireBytes = 0;
let httpRequests = 0;
let wireMessages = 0;
const client = new ConvexHttpClient(url, { fetch: async (...args) => {
	const result = await fetch(...args);
	httpBytes += (await result.clone().arrayBuffer()).byteLength;
	httpRequests++;
	return result;
} });
client.setAdminAuth(key, identity);
class MeasuredWebSocket extends WebSocket {
	constructor(...args) {
		super(...args);
		this.addEventListener("message", event => {
			wireBytes += typeof event.data === "string" ? Buffer.byteLength(event.data) : event.data.byteLength ?? event.data.size;
			wireMessages++;
		});
	}
}
function liveClient() {
	const live = new ConvexClient(url, { webSocketConstructor: MeasuredWebSocket, logger: false });
	live.setAdminAuth(key, identity);
	return live;
}
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function logs() {
	const response = await fetch(`${url}/api/stream_function_logs?cursor=0`, { headers: { Authorization: `Convex ${key}` }, signal: AbortSignal.timeout(15000) });
	if (!response.ok) throw new Error(`Function logs: ${response.status}`);
	return (await response.json()).entries;
}
const report = { observedAt: new Date().toISOString(), deployment, subject, fixtures: {}, phases: [] };
async function phase(name, run) {
	const before = new Set((await logs()).map(row => row.executionId));
	const start = { httpBytes, wireBytes, httpRequests, wireMessages };
	await run();
	await delay(500);
	const entries = (await logs()).filter(row => row.kind === "Completion" && !before.has(row.executionId) && /^(nutritionLibrary:|sets:)/.test(row.identifier));
	const usage = {};
	for (const entry of entries) for (const [field, amount] of Object.entries(entry.usageStats)) usage[field] = (usage[field] ?? 0) + amount;
	const result = {
		name, httpRequests: httpRequests - start.httpRequests, httpResponseBytes: httpBytes - start.httpBytes,
		webSocketMessages: wireMessages - start.wireMessages, webSocketResponseBytes: wireBytes - start.wireBytes,
		completions: entries.length, cachedCompletions: entries.filter(row => row.cachedResult).length,
		functions: entries.map(row => ({ identifier: row.identifier, cached: row.cachedResult, returnBytes: row.returnBytes, usage: row.usageStats })), usage,
	};
	report.phases.push(result);
	console.log(JSON.stringify({ ...result, functions: undefined }));
}
const nutrients = Object.fromEntries(["energy", "protein", "carbs", "fat", "saturatedFat", "fibre", "sugars", "salt"].map(name => [name, { kind: "value", amount: name === "energy" ? 350 : 10 }]));
const foods = Array.from({ length: 5000 }, (_, index) => {
	const id = `food-${index}`;
	const name = `Measured oats ${String(index).padStart(4, "0")}`;
	const payload = JSON.stringify({ id, name: { en: name, nl: name }, baseUnit: "g", nutrients, servings: [{ label: { en: "Bowl", nl: "Kom" }, amount: 50 }], provenance: { recordOrigin: "personal", nutritionSource: "manual", locallyEdited: false }, createdAt: 1, updatedAt: 1 });
	return { userId: subject, recordId: id, recordKind: "food", payload, schemaVersion: 2, revision: 1, deleted: false, updatedAt: 1, name: `${name} ${name}`.toLowerCase(), searchText: `${name} ${name}`, category: "food" };
});
function importRows(table, rows) {
	const file = join(directory, `${table}-${randomUUID()}.jsonl`);
	writeFileSync(file, rows.map(row => JSON.stringify(row)).join("\n"));
	execFileSync("pnpm", ["exec", "convex", "import", "--table", table, "--append", file], { env: { ...process.env, CONVEX_DEPLOY_KEY: key }, stdio: "pipe" });
}
importRows("nutritionLibraryRecords", foods);
report.fixtures.foods = { count: foods.length, meanPayloadBytes: foods.reduce((sum, row) => sum + Buffer.byteLength(row.payload), 0) / foods.length, meanImportedRowBytes: foods.reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row)), 0) / foods.length };
const args = { query: "", paginationOpts: { cursor: null, numItems: 50 } };
let page;
await phase("cold library page", async () => { page = await client.query("nutritionLibrary:browse", args); });
let live = liveClient();
async function subscribeOnce() {
	return new Promise((resolve, reject) => {
		let unsubscribe;
		const timeout = setTimeout(() => reject(new Error("Subscription timed out")), 15000);
		unsubscribe = live.onUpdate("nutritionLibrary:browse", args, () => {
			clearTimeout(timeout);
			setTimeout(() => { unsubscribe(); resolve(); }, 100);
		}, reject);
	});
}
await phase("20 unchanged focus/unfocus visits", async () => { for (let visit = 0; visit < 20; visit++) { await subscribeOnce(); await delay(100); } });

await phase("retained subscription across 20 unchanged visits", async () => {
	let stop;
	await new Promise((resolve, reject) => { stop = live.onUpdate("nutritionLibrary:browse", args, () => resolve(), reject); });
	for (let visit = 0; visit < 20; visit++) { await live.query("nutritionLibrary:browse", args); await delay(100); }
	stop();
});
await phase("indexed text search", async () => { await client.query("nutritionLibrary:browse", { ...args, query: "Measured oats 004" }); });
const food = page.page[0];
const edited = JSON.parse(food.payload);
edited.name.en = "Measured edited oats";
const save = { version: 1, expectedSubject: subject, operationId: randomUUID(), operation: { kind: "upsert", record: { id: food.id, kind: "food", schemaVersion: 2, payload: JSON.stringify(edited) }, expectedRevision: food.revision } };
await phase("Food edit and ten receipt retries", async () => { for (let attempt = 0; attempt < 11; attempt++) await client.mutation("nutritionLibrary:save", save); });
await phase("fresh client reconnect", async () => { await live.close(); live = liveClient(); await subscribeOnce(); });
await phase("process restart and empty cache", async () => { await live.close(); live = liveClient(); await subscribeOnce(); });
await live.close();
const sessionId = await client.mutation("workoutSessions:create", { name: "Issue 89 usage fixture" });
const exerciseId = SHIPPED_EXERCISES[0]._id;
function sets(start, count) {
	return Array.from({ length: count }, (_, index) => ({ userId: subject, sessionId, exerciseId, setNumber: start + index + 1, reps: 5, weight: 60 + index % 30, unit: "kg", setType: "working", loggedAt: start + index, estimatedMax: calculateOneRepMax(60 + index % 30, 5).value }));
}
let latest;
for (const [start, count] of [[0, 1000], [1000, 9000]]) {
	importRows("sets", sets(start, count));
	await phase(`latest set with ${start + count} history rows`, async () => { latest = await client.query("sets:getLastForExercise", { exerciseId }); });
	await phase(`best estimate after edit with ${start + count} history rows`, async () => { await client.mutation("sets:update", { id: latest._id, weight: 30 }); });
}
report.fixtures.sets = { count: 10000, meanImportedRowBytes: sets(0, 10000).reduce((sum, row) => sum + Buffer.byteLength(JSON.stringify(row)), 0) / 10000 };
const file = process.argv[2] ?? join(directory, "results.json");
writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Measurements saved to ${file}; fixture directory ${directory}`);
