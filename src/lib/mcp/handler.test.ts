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
): FoundryMcpOptions {
	return {
		issuer: "https://clerk.example",
		verifyToken: async (token, resource): Promise<McpAccess | undefined> =>
			token === "good" && resource === `${ORIGIN}/mcp`
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
	init: { token?: string | null; origin?: string } = {},
) {
	const headers = new Headers({
		accept: "application/json, text/event-stream",
		"content-type": "application/json",
	});
	const token = init.token === undefined ? "good" : init.token;
	if (token) headers.set("authorization", `Bearer ${token}`);
	if (init.origin) headers.set("origin", init.origin);
	return new Request(`${ORIGIN}/mcp`, {
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
