import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import type { McpAccess } from "./auth";
import { type FoundryMcpOptions, handleFoundryMcpRequest } from "./handler";
import type { FoundryBackend } from "./tools/define";

const ORIGIN = "https://foundry.example";
const READ_WRITE = ["foundry:read", "foundry:write"];

type Call = { kind: "query" | "mutation"; name: string; args: unknown };

function fakeBackend(
	responses: Record<string, (args: never) => unknown> = {},
): FoundryBackend & { calls: Call[] } {
	const calls: Call[] = [];
	const run = (kind: Call["kind"]) => async (reference: never, args: never) => {
		const name = getFunctionName(reference);
		calls.push({ kind, name, args });
		const respond = responses[name];
		if (!respond) throw new Error(`unexpected call ${name}`);
		return respond(args);
	};
	return {
		calls,
		query: run("query") as FoundryBackend["query"],
		mutation: run("mutation") as FoundryBackend["mutation"],
	};
}

function options(
	backend: FoundryBackend,
	scopes: string[] = READ_WRITE,
	origin = ORIGIN,
): FoundryMcpOptions {
	return {
		issuer: "https://clerk.example",
		verifyToken: async (token, resource): Promise<McpAccess | undefined> =>
			token === "good" && resource === `${origin}/mcp`
				? { userId: "user_1", scopes: new Set(scopes), token }
				: undefined,
		createBackend: () => backend,
		fetchUserInfo: async () => ({
			name: "Ada Lovelace",
			email: "ada@example.com",
		}),
		now: () => new Date("2026-11-10T12:00:00Z"),
	};
}

function rpc(
	method: string,
	params?: unknown,
	init: { token?: string | null; origin?: string; url?: string } = {},
) {
	const headers = new Headers({
		accept: "application/json, text/event-stream",
		"content-type": "application/json",
	});
	const token = init.token === undefined ? "good" : init.token;
	if (token) headers.set("authorization", `Bearer ${token}`);
	if (init.origin) headers.set("origin", init.origin);
	return new Request(init.url ?? `${ORIGIN}/mcp`, {
		method: "POST",
		headers,
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
}

async function result<T>(response: Response) {
	expect(response.status).toBe(200);
	return ((await response.json()) as { result: T }).result;
}

type ToolResult = {
	isError?: boolean;
	content: { text: string }[];
	structuredContent?: Record<string, unknown>;
};

async function callTool(
	backend: FoundryBackend,
	name: string,
	args: Record<string, unknown>,
	scopes?: string[],
) {
	return result<ToolResult>(
		await handleFoundryMcpRequest(
			rpc("tools/call", { name, arguments: args }),
			options(backend, scopes),
		),
	);
}

describe("Foundry MCP endpoint", () => {
	it("challenges unauthenticated requests with resource metadata", async () => {
		const response = await handleFoundryMcpRequest(
			rpc("initialize", {}, { token: null }),
			options(fakeBackend()),
		);
		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toContain(
			`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`,
		);
	});

	it("rejects invalid and expired tokens as invalid_token", async () => {
		const response = await handleFoundryMcpRequest(
			rpc("tools/list", {}, { token: "expired" }),
			options(fakeBackend()),
		);
		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toContain(
			'error="invalid_token"',
		);
	});

	it("rejects tokens without a Foundry scope", async () => {
		const response = await handleFoundryMcpRequest(
			rpc("tools/list"),
			options(fakeBackend(), ["openid", "profile"]),
		);
		expect(response.status).toBe(403);
		expect(response.headers.get("www-authenticate")).toContain(
			'error="insufficient_scope"',
		);
	});

	it("rejects browser origins outside the allowlist", async () => {
		const response = await handleFoundryMcpRequest(
			rpc("tools/list", {}, { origin: "https://evil.example" }),
			options(fakeBackend()),
		);
		expect(response.status).toBe(403);
		const allowed = await handleFoundryMcpRequest(
			rpc("tools/list", {}, { origin: "https://claude.ai" }),
			options(fakeBackend()),
		);
		expect(allowed.headers.get("access-control-allow-origin")).toBe(
			"https://claude.ai",
		);
	});

	it("answers GET with 405 because the server is stateless", async () => {
		const response = await handleFoundryMcpRequest(
			new Request(`${ORIGIN}/mcp`, {
				headers: { authorization: "Bearer good" },
			}),
			options(fakeBackend()),
		);
		expect(response.status).toBe(405);
	});

	it("initializes with instructions", async () => {
		const init = await result<{
			serverInfo: { name: string };
			instructions: string;
		}>(
			await handleFoundryMcpRequest(
				rpc("initialize", {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "vitest", version: "1.0.0" },
				}),
				options(fakeBackend()),
			),
		);
		expect(init.serverInfo.name).toBe("foundry");
		expect(init.instructions).toContain("idempotencyKey");
	});

	it("lists only read tools for a read-only grant", async () => {
		const list = async (scopes: string[]) =>
			(
				await result<{
					tools: {
						name: string;
						annotations: { readOnlyHint: boolean; destructiveHint?: boolean };
					}[];
				}>(
					await handleFoundryMcpRequest(
						rpc("tools/list"),
						options(fakeBackend(), scopes),
					),
				)
			).tools;
		const readOnly = await list(["foundry:read"]);
		expect(readOnly.length).toBeGreaterThan(10);
		expect(readOnly.every((tool) => tool.annotations.readOnlyHint)).toBe(true);
		const all = await list(READ_WRITE);
		const names = all.map((tool) => tool.name);
		expect(names).toEqual(
			expect.arrayContaining(["log_set", "log_food", "log_run_or_ride"]),
		);
		const writes = all.filter((tool) => !tool.annotations.readOnlyHint);
		expect(
			writes.every((tool) => tool.annotations.destructiveHint === false),
		).toBe(true);
		expect(names.some((name) => /delete|remove/.test(name))).toBe(false);
	});

	it("refuses a write tool the grant does not include", async () => {
		const call = await callTool(fakeBackend(), "log_set", {}, ["foundry:read"]);
		expect(call.isError).toBe(true);
	});

	it("reports invalid arguments without calling Convex", async () => {
		const backend = fakeBackend();
		const call = await callTool(backend, "log_set", { reps: -1 });
		expect(call.isError).toBe(true);
		expect(backend.calls).toHaveLength(0);
	});

	it("returns the current user", async () => {
		const call = await callTool(fakeBackend(), "get_current_user", {});
		expect(call.structuredContent).toMatchObject({
			userId: "user_1",
			name: "Ada Lovelace",
			email: "ada@example.com",
			serverTime: "2026-11-10T12:00:00.000Z",
		});
	});

	it("lists exercises from the catalog and personal exercises", async () => {
		const backend = fakeBackend({
			"exercises:listPersonal": () => ({
				page: [
					{
						_id: "ex_personal",
						name: "Zercher Carry",
						muscleGroups: ["core"],
						category: "compound",
						equipment: "barbell",
						isDefault: false,
					},
				],
				isDone: true,
				continueCursor: "",
			}),
		});
		const call = await callTool(backend, "list_exercises", {
			query: "zercher carry",
		});
		expect(call.structuredContent?.exercises).toEqual([
			expect.objectContaining({ id: "ex_personal", personal: true }),
		]);
	});

	it("logs a set with a namespaced operation ID", async () => {
		const backend = fakeBackend({ "sets:add": () => "set_1" });
		const call = await callTool(backend, "log_set", {
			idempotencyKey: "key-12345",
			sessionId: "session_1",
			exerciseId: "back-squat",
			setNumber: 1,
			reps: 5,
			weight: 100,
			unit: "kg",
		});
		expect(call.structuredContent).toEqual({ setId: "set_1" });
		expect(backend.calls[0]).toMatchObject({
			kind: "mutation",
			name: "sets:add",
			args: { operationId: "mcp:key-12345", setType: "working" },
		});
	});

	it("returns the active session instead of starting a second one", async () => {
		const session = {
			_id: "session_1",
			status: "active",
			startTime: 0,
			exercises: [],
		};
		const backend = fakeBackend({
			"workoutSessions:getActive": () => session,
			"workoutSessions:getById": () => session,
			"sets:listForSession": () => [],
		});
		const call = await callTool(backend, "start_strength_session", {});
		expect(call.structuredContent).toMatchObject({ alreadyActive: true });
		expect(backend.calls.some((c) => c.kind === "mutation")).toBe(false);
	});

	it("logs a shipped food as a diary snapshot for the caller", async () => {
		const backend = fakeBackend({
			"nutritionLibrary:browse": () => ({
				page: [],
				isDone: true,
				continueCursor: "",
			}),
			"nutritionDiary:applyOperation": () => ({
				entryIds: ["entry_1"],
				clientEntryIds: ["mcp:food-key-1"],
			}),
			"nutritionDiary:day": () => ({
				date: "2026-11-10",
				entries: [],
				totals: {},
				revision: 1,
			}),
		});
		const search = await callTool(backend, "search_foods", {
			query: "banana",
			limit: 1,
		});
		const [food] = (search.structuredContent?.foods ?? []) as {
			foodId: string;
			servings: { servingIndex: number }[];
		}[];
		expect(food.foodId).toBe("shipped:banana");
		const call = await callTool(backend, "log_food", {
			idempotencyKey: "food-key-1",
			date: "2026-11-10",
			meal: "breakfast",
			foodId: food.foodId,
			servingIndex: food.servings[0].servingIndex,
			quantity: 1,
		});
		expect(call.isError).toBeUndefined();
		const write = backend.calls.find(
			(c) => c.name === "nutritionDiary:applyOperation",
		);
		expect(write?.args).toMatchObject({
			operationId: "mcp:food-key-1",
			expectedSubject: "user_1",
			operation: {
				kind: "create",
				entry: {
					date: "2026-11-10",
					meal: "breakfast",
					clientEntryId: "mcp:food-key-1",
					provenance: { source: "shipped" },
				},
			},
		});
	});

	it("hides internal errors but keeps domain messages", async () => {
		const failing = fakeBackend({
			"bodyMetrics:list": () => {
				throw new Error("db exploded: secret detail");
			},
		});
		const call = await callTool(failing, "list_body_metrics", {});
		expect(call.isError).toBe(true);
		expect(call.content[0]?.text).toBe("The Foundry tool failed.");
	});

	it("explains coded Convex refusals in English", async () => {
		const refusing = (data: unknown) =>
			fakeBackend({
				"bodyMetrics:list": () => {
					throw new ConvexError(data as never);
				},
			});
		const text = async (data: unknown) =>
			(await callTool(refusing(data), "list_body_metrics", {})).content[0]
				?.text;
		expect(await text({ code: "tooLarge", field: "weight" })).toBe(
			"Foundry refused this: tooLarge (weight).",
		);
		expect(await text({ code: "sessionEnded" })).toBe(
			"This activity has already ended.",
		);
		expect(
			await text({
				code: "readOnly",
				message: "This connected app has read-only access to Foundry.",
			}),
		).toBe("This connected app has read-only access to Foundry.");
	});

	it("finishes a session with unlogged targets only once confirmed", async () => {
		const backend = fakeBackend({
			"workoutSessions:getById": () => ({
				_id: "session_1",
				status: "active",
				startTime: 0,
				exercises: [{ exerciseId: "squat", plannedSets: [{}, {}] }],
			}),
			"sets:listForSession": () => [{ _id: "set_1", exerciseId: "squat" }],
			"workoutSessions:finish": () => null,
		});
		const refused = await callTool(backend, "finish_strength_session", {
			sessionId: "session_1",
		});
		expect(refused.isError).toBe(true);
		expect(refused.content[0]?.text).toContain("discardUnfinished");
		expect(backend.calls.some((c) => c.kind === "mutation")).toBe(false);

		const done = await callTool(backend, "finish_strength_session", {
			sessionId: "session_1",
			discardUnfinished: true,
		});
		expect(done.isError).toBeUndefined();
		expect(
			backend.calls.filter((c) => c.name === "workoutSessions:finish"),
		).toHaveLength(1);
	});
});

const EXISTING_TOOLS = [
	"get_current_user",
	"list_activities",
	"get_run_or_ride",
	"log_run_or_ride",
	"update_run_or_ride",
	"list_body_metrics",
	"log_body_metrics",
	"list_wods",
	"get_wod_results",
	"log_wod_result",
	"list_exercises",
	"get_exercise_history",
	"get_exercise_volume",
	"list_one_rep_maxes",
	"list_routines",
	"get_active_strength_session",
	"get_strength_session",
	"start_strength_session",
	"add_exercise_to_session",
	"log_set",
	"update_set",
	"finish_strength_session",
	"record_one_rep_max",
	"get_nutrition_day",
	"get_nutrition_week",
	"get_nutrition_goals",
	"search_foods",
	"log_food",
	"log_custom_food",
	"update_diary_entry",
];
const VIEW_TOOLS = {
	show_week_overview: "ui://foundry/week-overview",
	review_food_log: "ui://foundry/food-log",
	show_exercise_progress: "ui://foundry/exercise-progress",
};
const SQUAT = "shipped:exercise:barbell-back-squat";

type ListedTool = {
	name: string;
	annotations: { readOnlyHint: boolean };
	_meta?: { ui?: { resourceUri?: string }; "ui/resourceUri"?: string };
};

async function listTools(scopes: string[]) {
	return (
		await result<{ tools: ListedTool[] }>(
			await handleFoundryMcpRequest(
				rpc("tools/list"),
				options(fakeBackend(), scopes),
			),
		)
	).tools;
}

function total(amount: number) {
	return {
		amount,
		entryCount: 1,
		valueCount: 1,
		traceCount: 0,
		absentCount: 0,
		incomplete: false,
		qualified: false,
	};
}

function macroTotals(energy: number, protein: number) {
	return {
		energy: total(energy),
		protein: total(protein),
		carbs: total(100),
		fat: total(50),
		saturatedFat: total(10),
		fibre: total(20),
		sugars: total(30),
		salt: total(4),
	};
}

const GOALS = {
	goals: [
		{ nutrient: "energy", direction: "max", target: 2200 },
		{ nutrient: "protein", direction: "min", target: 150 },
		{ nutrient: "salt", direction: "max", target: 6 },
	],
	basis: "effective",
	effectiveFrom: "2026-01-01",
	nextEffectiveFrom: null,
	displayOrder: [],
};

describe("Foundry MCP views", () => {
	it("keeps the existing tools and adds the three view tools", async () => {
		const tools = await listTools(READ_WRITE);
		expect(tools.map((tool) => tool.name).sort()).toEqual(
			[...EXISTING_TOOLS, ...Object.keys(VIEW_TOOLS)].sort(),
		);
		for (const tool of tools) {
			const view = VIEW_TOOLS[tool.name as keyof typeof VIEW_TOOLS];
			if (view) {
				expect(tool._meta?.ui?.resourceUri).toBe(view);
				expect(tool._meta?.["ui/resourceUri"]).toBe(view);
				expect(tool.annotations.readOnlyHint).toBe(true);
			} else {
				expect(tool._meta).toBeUndefined();
			}
		}
	});

	it("lists one HTML resource per view", async () => {
		const list = await result<{
			resources: { uri: string; mimeType: string }[];
		}>(
			await handleFoundryMcpRequest(
				rpc("resources/list"),
				options(fakeBackend()),
			),
		);
		expect(list.resources).toEqual(
			Object.values(VIEW_TOOLS).map((uri) =>
				expect.objectContaining({ uri, mimeType: "text/html;profile=mcp-app" }),
			),
		);
	});

	it.each([
		["https://foundry.appelent.nl", "cd102ab69774fc367e455454bd4eb467"],
		[
			"https://foundry-dev.appelent.workers.dev",
			"4910b2fc43b2d6c7d812fb4c42e04de7",
		],
	])(
		"serves a self-contained view with Claude's domain for %s",
		async (origin, hash) => {
			const read = await result<{
				contents: {
					uri: string;
					mimeType: string;
					text: string;
					_meta: { ui: { domain: string; csp?: unknown } };
				}[];
			}>(
				await handleFoundryMcpRequest(
					rpc(
						"resources/read",
						{ uri: "ui://foundry/week-overview" },
						{ url: `${origin}/mcp` },
					),
					options(fakeBackend(), READ_WRITE, origin),
				),
			);
			const [content] = read.contents;
			expect(content.mimeType).toBe("text/html;profile=mcp-app");
			expect(content._meta.ui.domain).toBe(`${hash}.claudemcpcontent.com`);
			expect(content._meta.ui.csp).toBeUndefined();
			expect(content.text).toMatch(/^<!doctype html>/);
			expect(content.text).toContain('data-view="week-overview"');
			// Everything is inline: no scripts, styles, fonts, or images from elsewhere.
			// The inline script is left out: React's dev warnings mention `<link>`.
			const markup = content.text.replace(
				/(<script type="module">)[\s\S]*?(<\/script>)/,
				"$1$2",
			);
			expect(markup).toContain('<script type="module"></script>');
			expect(markup).not.toMatch(
				/<script[^>]+src=|<link\b|@import|url\(\s*["']?https?:/i,
			);
		},
	);

	it("gates views and logging by scope", async () => {
		const readOnly = (await listTools(["foundry:read"])).map(
			(tool) => tool.name,
		);
		expect(readOnly).toEqual(expect.arrayContaining(Object.keys(VIEW_TOOLS)));
		expect(readOnly).not.toContain("log_food");

		const writeOnly = (await listTools(["foundry:write"])).map(
			(tool) => tool.name,
		);
		expect(writeOnly.some((name) => name in VIEW_TOOLS)).toBe(false);
		const resources = await handleFoundryMcpRequest(
			rpc("resources/list"),
			options(fakeBackend(), ["foundry:write"]),
		);
		const body = (await resources.json()) as { error?: unknown };
		expect(body.error).toBeDefined();
	});

	it("shows a week of training and nutrition", async () => {
		const backend = fakeBackend({
			"activities:list": () => ({
				items: [
					{
						id: "run_1",
						sport: "running",
						occurredAt: Date.parse("2026-11-11T07:00:00Z"),
						durationSeconds: 1800,
						distanceMeters: 5000,
					},
					{
						id: "session_1",
						sport: "strength",
						occurredAt: Date.parse("2026-11-09T18:00:00Z"),
						durationSeconds: 3600,
						title: "Push",
					},
				],
				cursor: null,
				isDone: true,
			}),
			"nutritionReview:week": (args: { startDate: string }) => ({
				startDate: args.startDate,
				endDate: "2026-11-15",
				days: Array.from({ length: 7 }, (_, index) => ({
					date: `2026-11-${String(9 + index).padStart(2, "0")}`,
					entryCount: index < 2 ? 3 : 0,
					totals: macroTotals(index < 2 ? 2000 : 0, index < 2 ? 140 : 0),
					goals: GOALS.goals,
					goalBasis: "effective",
					effectiveFrom: "2026-01-01",
				})),
				averages: {
					energy: 2000,
					protein: 140,
					energyDays: 2,
					proteinDays: 2,
					energyQualified: false,
					proteinQualified: false,
				},
			}),
		});
		const call = await callTool(backend, "show_week_overview", {
			weekStart: "2026-11-12",
		});
		expect(call.isError).toBeUndefined();
		const week = call.structuredContent as Record<string, never>;
		expect(week).toMatchObject({
			view: "week-overview",
			weekStart: "2026-11-09",
			weekEnd: "2026-11-15",
			previousWeekStart: "2026-11-02",
			nextWeekStart: "2026-11-16",
			isCurrentWeek: true,
			training: {
				strengthSessions: 1,
				runs: 1,
				rides: 0,
				distanceMeters: 5000,
				durationSeconds: 5400,
			},
			nutrition: {
				loggedDays: 2,
				energyAverageKcal: 2000,
				proteinAverageG: 140,
				goals: [
					{ macro: "energyKcal", direction: "max", target: 2200 },
					{ macro: "proteinG", direction: "min", target: 150 },
				],
			},
		});
		const days = week.days as {
			date: string;
			activities: { id: string }[];
			nutrition: { energyKcal: number | null };
		}[];
		expect(days[0].activities.map((a) => a.id)).toEqual(["session_1"]);
		expect(days[2].activities.map((a) => a.id)).toEqual(["run_1"]);
		expect(days[0].nutrition.energyKcal).toBe(2000);
		expect(days[3].nutrition.energyKcal).toBeNull();
		expect(backend.calls[0].args).toMatchObject({
			from: Date.parse("2026-11-09T00:00:00Z"),
			to: Date.parse("2026-11-16T00:00:00Z"),
		});
	});

	it("rejects an impossible week start", async () => {
		const call = await callTool(fakeBackend(), "show_week_overview", {
			weekStart: "2026-02-31",
		});
		expect(call.isError).toBe(true);
	});

	it("reviews proposed food without logging it", async () => {
		const backend = fakeBackend({
			"nutritionDiary:day": () => ({
				date: "2026-11-10",
				entries: [{ _id: "entry_0" }],
				totals: macroTotals(500, 30),
				revision: 1,
			}),
			"nutritionGoals:forDate": () => GOALS,
		});
		const review = async (scopes: string[]) =>
			(
				await callTool(
					backend,
					"review_food_log",
					{
						date: "2026-11-10",
						meal: "breakfast",
						items: [{ foodId: "shipped:banana", servingIndex: 0, quantity: 2 }],
					},
					scopes,
				)
			).structuredContent as {
				canLog: boolean;
				items: {
					name: string;
					quantity: number;
					servings: { perQuantity: { energyKcal: number | null } }[];
				}[];
				logged: { entryCount: number; energyKcal: number };
				goals: unknown[];
			};
		const full = await review(READ_WRITE);
		expect(full).toMatchObject({
			view: "food-log",
			date: "2026-11-10",
			meal: "breakfast",
			canLog: true,
			logged: { entryCount: 1, energyKcal: 500, proteinG: 30 },
		});
		expect(full.goals).toHaveLength(2);
		expect(full.items[0].name.toLowerCase()).toContain("banana");
		expect(full.items[0].servings[0].perQuantity.energyKcal).toBeGreaterThan(0);
		expect((await review(["foundry:read"])).canLog).toBe(false);
		expect(backend.calls.some((c) => c.kind === "mutation")).toBe(false);
	});

	it("refuses a review with an unknown serving", async () => {
		const backend = fakeBackend({
			"nutritionDiary:day": () => ({
				date: "2026-11-10",
				entries: [],
				totals: {},
			}),
			"nutritionGoals:forDate": () => GOALS,
		});
		const call = await callTool(backend, "review_food_log", {
			date: "2026-11-10",
			meal: "lunch",
			items: [{ foodId: "shipped:banana", servingIndex: 99, quantity: 1 }],
		});
		expect(call.isError).toBe(true);
		expect(call.content[0]?.text).toContain("servingIndex");
	});

	it("does not log a food twice when the view retries with the same key", async () => {
		const receipts = new Map<string, { entryIds: string[] }>();
		const entries: string[] = [];
		const backend = fakeBackend({
			"nutritionDiary:applyOperation": (args: { operationId: string }) => {
				const seen = receipts.get(args.operationId);
				if (seen) return seen;
				entries.push(args.operationId);
				const receipt = { entryIds: [`entry_${entries.length}`] };
				receipts.set(args.operationId, receipt);
				return receipt;
			},
			"nutritionDiary:day": () => ({
				date: "2026-11-10",
				entries: [],
				totals: {},
				revision: 1,
			}),
		});
		const log = () =>
			callTool(backend, "log_food", {
				idempotencyKey: "view-key-0001",
				date: "2026-11-10",
				meal: "breakfast",
				foodId: "shipped:banana",
				servingIndex: 0,
				quantity: 1,
			});
		const first = await log();
		const retry = await log();
		expect(retry.structuredContent?.entryId).toBe(
			first.structuredContent?.entryId,
		);
		expect(entries).toEqual(["mcp:view-key-0001"]);
	});

	it("shows exercise progress for a range and metric", async () => {
		const day = (date: string) => Date.parse(`${date}T18:00:00Z`);
		const set = (
			sessionId: string,
			date: string,
			weight: number,
			reps: number,
			setType = "working",
		) => ({
			_id: `${sessionId}-${weight}-${reps}`,
			sessionId,
			exerciseId: SQUAT,
			reps,
			weight,
			unit: "kg",
			setType,
			loggedAt: day(date),
			sessionDate: day(date),
		});
		const backend = fakeBackend({
			"exercises:listPersonal": () => ({
				page: [],
				isDone: true,
				continueCursor: "",
			}),
			"exercises:getHistory": () => [
				set("old", "2026-01-05", 200, 1),
				set("s1", "2026-10-20", 60, 10, "warmup"),
				set("s1", "2026-10-20", 100, 5),
				set("s1", "2026-10-20", 110, 1),
				set("s2", "2026-11-03", 105, 5),
			],
			"progress:weeklyVolume": () => [
				{ week: "2026-W02", volume: 200 },
				{ week: "2026-W43", volume: 610 },
				{ week: "2026-W45", volume: 525 },
			],
			"oneRepMaxes:listForExercise": () => [
				{
					_id: "orm_1",
					date: day("2026-11-01"),
					value: 120,
					unit: "kg",
					source: "manual",
				},
			],
		});
		const call = await callTool(backend, "show_exercise_progress", {
			exerciseId: SQUAT,
			range: "4w",
		});
		expect(call.isError).toBeUndefined();
		expect(call.structuredContent).toMatchObject({
			view: "exercise-progress",
			exercise: { id: SQUAT },
			range: "4w",
			metric: "e1rm",
			unit: "kg",
			points: [
				{ date: "2026-10-20", value: 116.7, weight: 100, reps: 5 },
				{ date: "2026-11-03", value: 122.5, weight: 105, reps: 5 },
			],
			weeklyVolume: [
				{ week: "2026-W43", volume: 610 },
				{ week: "2026-W45", volume: 525 },
			],
			oneRepMaxes: [{ date: "2026-11-01", value: 120, source: "manual" }],
			summary: { sessions: 2, latest: 122.5, best: 122.5, change: 5.8 },
		});

		const topSet = await callTool(backend, "show_exercise_progress", {
			exerciseId: SQUAT,
			range: "1y",
			metric: "topSet",
		});
		expect(
			((topSet.structuredContent?.points ?? []) as { value: number }[]).map(
				(p) => p.value,
			),
		).toEqual([200, 110, 105]);
	});

	it("refuses progress for an unknown exercise", async () => {
		const backend = fakeBackend({
			"exercises:listPersonal": () => ({
				page: [],
				isDone: true,
				continueCursor: "",
			}),
			"exercises:getHistory": () => [],
			"progress:weeklyVolume": () => [],
			"oneRepMaxes:listForExercise": () => [],
		});
		const call = await callTool(backend, "show_exercise_progress", {
			exerciseId: "nope",
		});
		expect(call.isError).toBe(true);
	});
});
