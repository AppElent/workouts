# Read-Only MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host a read-only MCP server at `/mcp` in the existing TanStack Start Workouts webapp, with a paired `/mcp/auth` browser login flow for obtaining a Convex-compatible Clerk JWT.

**Architecture:** Use TanStack Start server routes for both MCP protocol and MCP auth. Keep protocol handling thin: `/mcp` creates a fresh `McpServer`, attaches a web-standard Streamable HTTP transport, and delegates tool behavior to focused `src/lib/mcp/*` modules. `/mcp/auth` reuses the CLI-style browser callback mechanism while keeping MCP-specific labels, helper names, tests, and docs.

**Tech Stack:** React 19, TanStack React Start, TanStack Router file routes, Clerk React, Convex HTTP client, `@modelcontextprotocol/sdk@1.29.0`, Zod 4, Vitest, pnpm 11, Biome.

## Global Constraints

- Use `pnpm`, not `npm` or `npx`.
- Do not use `@tanstack/ai-mcp`; it is host-side/client-oriented and not the server implementation package for this slice.
- Prefer TanStack Start server routes first: `/mcp` for protocol and `/mcp/auth` for auth.
- Use the MCP SDK web-standard transport: `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`.
- All personal-data tools require `Authorization: Bearer <Clerk JWT>`.
- `/mcp/auth` must validate loopback `redirect_uri` plus `state`, call `getToken({ template: "convex" })`, and redirect the token to the local callback.
- Keep `/api/cli/auth/login` CLI-owned; do not rename or remove it.
- Expose only read-only tools in this slice: `list_exercises`, `list_recent_workouts`, `get_workout_sets`, `list_personal_records`, `get_exercise_volume`.
- Update Appelent registry files so Workouts includes the active `mcp` capability.

---

## File Structure

- Create `src/lib/localCallbackAuth.ts`: shared loopback redirect parsing and token/error redirect builders for browser-mediated local callback auth.
- Modify `src/lib/cliAuthRedirect.ts`: keep CLI public function names, delegate to `localCallbackAuth.ts`, preserve current behavior.
- Create `src/lib/mcpAuthRedirect.ts`: MCP-specific public helper names and error messages, backed by `localCallbackAuth.ts`.
- Modify `src/lib/cliAuthRedirect.test.ts`: preserve existing CLI helper coverage after the helper split.
- Create `src/lib/mcpAuthRedirect.test.ts`: MCP helper coverage for `/mcp/auth`.
- Create `src/routes/mcp/auth.tsx`: browser-mediated MCP sign-in page.
- Create `src/lib/mcp/dataClient.ts`: Convex-backed data client interface and implementation used by MCP tools.
- Create `src/lib/mcp/toolResults.ts`: stable result formatting helpers for concise MCP responses.
- Create `src/lib/mcp/server.ts`: MCP server factory and tool registration.
- Create `src/lib/mcp/handler.ts`: Streamable HTTP request handler for the `/mcp` server route.
- Create `src/lib/mcp/*.test.ts`: focused unit/protocol tests for data shaping, auth denial, tool registration, and JSON-RPC flow.
- Create `src/routes/mcp.ts`: TanStack Start server route for `/mcp`.
- Create `src/lib/mcpRoutes.test.ts`: route-tree guard for `/mcp` and `/mcp/auth`.
- Create `docs/mcp.md`: endpoint, auth, and client notes.
- Modify `package.json` and `pnpm-lock.yaml`: add MCP dependencies.
- Modify `C:\Users\ericj\.claude\appelent\projects.json` and `.claude/appelent/projects.managed.json`: add `mcp` to Workouts capabilities.

---

### Task 1: Shared Local Callback Auth Helpers

**Files:**
- Create: `src/lib/localCallbackAuth.ts`
- Create: `src/lib/mcpAuthRedirect.ts`
- Create: `src/lib/mcpAuthRedirect.test.ts`
- Modify: `src/lib/cliAuthRedirect.ts`
- Modify: `src/lib/cliAuthRedirect.test.ts`

**Interfaces:**
- Produces:
  - `parseLocalCallbackAuthRequest(requestUrl: string, options: LocalCallbackAuthOptions): LocalCallbackAuthRequest`
  - `buildLocalCallbackTokenRedirect(args: LocalCallbackTokenRedirectArgs): string`
  - `buildLocalCallbackErrorRedirect(args: LocalCallbackErrorRedirectArgs): string`
  - `parseMcpAuthRequest(requestUrl: string): McpAuthRequest`
  - `buildMcpAuthTokenRedirect(args: { redirectUri: string; state: string; token: string }): string`
  - `buildMcpAuthErrorRedirect(args: { redirectUri: string; state: string; error: string; description?: string }): string`
- Consumes: existing CLI route imports from `src/lib/cliAuthRedirect.ts` must keep working unchanged.

- [ ] **Step 1: Add failing MCP auth helper tests**

Create `src/lib/mcpAuthRedirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	buildMcpAuthErrorRedirect,
	buildMcpAuthTokenRedirect,
	parseMcpAuthRequest,
} from "./mcpAuthRedirect";

describe("MCP auth redirect helpers", () => {
	it("accepts loopback callback URLs with state", () => {
		const request = parseMcpAuthRequest(
			"http://localhost:3000/mcp/auth?redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback&state=abc",
		);

		expect(request).toEqual({
			ok: true,
			redirectUri: "http://127.0.0.1:54321/callback",
			state: "abc",
		});
	});

	it("rejects non-loopback callback URLs with MCP-specific copy", () => {
		const request = parseMcpAuthRequest(
			"http://localhost:3000/mcp/auth?redirect_uri=https%3A%2F%2Fevil.example%2Fcallback&state=abc",
		);

		expect(request).toEqual({
			ok: false,
			message:
				"MCP callback URL must be a local http://127.0.0.1 or http://localhost URL.",
		});
	});

	it("builds token and error callback URLs with the original state", () => {
		expect(
			buildMcpAuthTokenRedirect({
				redirectUri: "http://127.0.0.1:54321/callback",
				state: "abc",
				token: "token",
			}),
		).toBe("http://127.0.0.1:54321/callback?state=abc&token=token");

		expect(
			buildMcpAuthErrorRedirect({
				redirectUri: "http://127.0.0.1:54321/callback",
				state: "abc",
				error: "token_unavailable",
				description: "Could not create an MCP token.",
			}),
		).toBe(
			"http://127.0.0.1:54321/callback?state=abc&error=token_unavailable&error_description=Could+not+create+an+MCP+token.",
		);
	});
});
```

- [ ] **Step 2: Run tests to verify the new helper is missing**

Run: `pnpm exec vitest run src/lib/mcpAuthRedirect.test.ts`

Expected: FAIL with a module resolution error for `./mcpAuthRedirect`.

- [ ] **Step 3: Create the shared local callback helper**

Create `src/lib/localCallbackAuth.ts`:

```ts
export type LocalCallbackAuthRequest =
	| {
			ok: true;
			redirectUri: string;
			state: string;
	  }
	| {
			ok: false;
			message: string;
	  };

export type LocalCallbackAuthOptions = {
	featureName: string;
	missingRequestMessage: string;
	invalidCallbackMessage: string;
	invalidLoopbackMessage: string;
};

export type LocalCallbackTokenRedirectArgs = {
	redirectUri: string;
	state: string;
	token: string;
};

export type LocalCallbackErrorRedirectArgs = {
	redirectUri: string;
	state: string;
	error: string;
	description?: string;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function parseLocalCallbackAuthRequest(
	requestUrl: string,
	options: LocalCallbackAuthOptions,
): LocalCallbackAuthRequest {
	const url = new URL(requestUrl);
	const redirectUri = url.searchParams.get("redirect_uri");
	const state = url.searchParams.get("state");

	if (!redirectUri || !state) {
		return {
			ok: false,
			message: options.missingRequestMessage,
		};
	}

	let callbackUrl: URL;
	try {
		callbackUrl = new URL(redirectUri);
	} catch {
		return {
			ok: false,
			message: options.invalidCallbackMessage,
		};
	}

	if (
		callbackUrl.protocol !== "http:" ||
		!LOOPBACK_HOSTS.has(callbackUrl.hostname)
	) {
		return {
			ok: false,
			message: options.invalidLoopbackMessage,
		};
	}

	return {
		ok: true,
		redirectUri: callbackUrl.toString(),
		state,
	};
}

export function buildLocalCallbackTokenRedirect({
	redirectUri,
	state,
	token,
}: LocalCallbackTokenRedirectArgs): string {
	const url = new URL(redirectUri);
	url.searchParams.set("state", state);
	url.searchParams.set("token", token);
	return url.toString();
}

export function buildLocalCallbackErrorRedirect({
	redirectUri,
	state,
	error,
	description,
}: LocalCallbackErrorRedirectArgs): string {
	const url = new URL(redirectUri);
	url.searchParams.set("state", state);
	url.searchParams.set("error", error);
	if (description) {
		url.searchParams.set("error_description", description);
	}
	return url.toString();
}
```

- [ ] **Step 4: Rewire CLI helpers through the shared helper**

Replace `src/lib/cliAuthRedirect.ts` with:

```ts
import {
	buildLocalCallbackErrorRedirect,
	buildLocalCallbackTokenRedirect,
	parseLocalCallbackAuthRequest,
	type LocalCallbackAuthRequest,
} from "./localCallbackAuth";

export type CliAuthRequest = LocalCallbackAuthRequest;

export function parseCliAuthRequest(requestUrl: string): CliAuthRequest {
	return parseLocalCallbackAuthRequest(requestUrl, {
		featureName: "CLI",
		missingRequestMessage: "CLI login request is missing redirect_uri or state.",
		invalidCallbackMessage: "CLI callback URL is invalid.",
		invalidLoopbackMessage:
			"CLI callback URL must be a local http://127.0.0.1 or http://localhost URL.",
	});
}

export const buildCliAuthTokenRedirect = buildLocalCallbackTokenRedirect;
export const buildCliAuthErrorRedirect = buildLocalCallbackErrorRedirect;
```

- [ ] **Step 5: Add MCP helper wrapper**

Create `src/lib/mcpAuthRedirect.ts`:

```ts
import {
	buildLocalCallbackErrorRedirect,
	buildLocalCallbackTokenRedirect,
	parseLocalCallbackAuthRequest,
	type LocalCallbackAuthRequest,
} from "./localCallbackAuth";

export type McpAuthRequest = LocalCallbackAuthRequest;

export function parseMcpAuthRequest(requestUrl: string): McpAuthRequest {
	return parseLocalCallbackAuthRequest(requestUrl, {
		featureName: "MCP",
		missingRequestMessage: "MCP login request is missing redirect_uri or state.",
		invalidCallbackMessage: "MCP callback URL is invalid.",
		invalidLoopbackMessage:
			"MCP callback URL must be a local http://127.0.0.1 or http://localhost URL.",
	});
}

export const buildMcpAuthTokenRedirect = buildLocalCallbackTokenRedirect;
export const buildMcpAuthErrorRedirect = buildLocalCallbackErrorRedirect;
```

- [ ] **Step 6: Run helper tests**

Run: `pnpm exec vitest run src/lib/cliAuthRedirect.test.ts src/lib/mcpAuthRedirect.test.ts`

Expected: PASS for both test files.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib/localCallbackAuth.ts src/lib/cliAuthRedirect.ts src/lib/cliAuthRedirect.test.ts src/lib/mcpAuthRedirect.ts src/lib/mcpAuthRedirect.test.ts
git commit -m "feat: add mcp auth redirect helpers"
```

---

### Task 2: MCP Browser Auth Route

**Files:**
- Create: `src/routes/mcp/auth.tsx`
- Create: `src/lib/mcpRoutes.test.ts`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes:
  - `parseMcpAuthRequest(requestUrl: string): McpAuthRequest`
  - `buildMcpAuthTokenRedirect(args): string`
  - `buildMcpAuthErrorRedirect(args): string`
- Produces:
  - TanStack route path `/mcp/auth`

- [ ] **Step 1: Add route-tree guard test**

Create `src/lib/mcpRoutes.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeTreeSource = readFileSync("src/routeTree.gen.ts", "utf8");

describe("MCP routes", () => {
	it("exposes MCP protocol and auth routes", () => {
		expect(routeTreeSource).toContain("'/mcp'");
		expect(routeTreeSource).toContain("'/mcp/auth'");
	});
});
```

- [ ] **Step 2: Run route test to verify it fails**

Run: `pnpm exec vitest run src/lib/mcpRoutes.test.ts`

Expected: FAIL because `/mcp` and `/mcp/auth` are not in `src/routeTree.gen.ts`.

- [ ] **Step 3: Add `/mcp/auth` route**

Create `src/routes/mcp/auth.tsx`:

```tsx
import { AuthCard, SignInForm } from "@appelent/auth";
import { useAuth } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
	buildMcpAuthErrorRedirect,
	buildMcpAuthTokenRedirect,
	parseMcpAuthRequest,
} from "#/lib/mcpAuthRedirect";

export const Route = createFileRoute("/mcp/auth")({
	ssr: false,
	component: McpAuthLoginPage,
});

function McpAuthLoginPage() {
	const { getToken, isLoaded, isSignedIn } = useAuth();
	const [error, setError] = useState<string | undefined>();
	const authRequest = useMemo(
		() => parseMcpAuthRequest(window.location.href),
		[],
	);

	useEffect(() => {
		if (!authRequest.ok || !isLoaded || !isSignedIn) return;

		let cancelled = false;
		const request = authRequest;

		async function redirectWithToken() {
			try {
				const token = await getToken({ template: "convex" });
				if (cancelled) return;

				if (!token) {
					window.location.assign(
						buildMcpAuthErrorRedirect({
							redirectUri: request.redirectUri,
							state: request.state,
							error: "token_unavailable",
							description: "Could not create an MCP token.",
						}),
					);
					return;
				}

				window.location.assign(
					buildMcpAuthTokenRedirect({
						redirectUri: request.redirectUri,
						state: request.state,
						token,
					}),
				);
			} catch {
				if (cancelled) return;
				window.location.assign(
					buildMcpAuthErrorRedirect({
						redirectUri: request.redirectUri,
						state: request.state,
						error: "token_unavailable",
						description: "Could not create an MCP token.",
					}),
				);
			}
		}

		redirectWithToken();

		return () => {
			cancelled = true;
		};
	}, [authRequest, getToken, isLoaded, isSignedIn]);

	if (!authRequest.ok) {
		return (
			<AuthCard
				title="MCP sign in"
				subtitle="This MCP login request is invalid."
			>
				<p className="text-sm text-red-400">{authRequest.message}</p>
			</AuthCard>
		);
	}

	if (error) {
		return (
			<AuthCard
				title="MCP sign in"
				subtitle="The MCP login could not continue."
			>
				<p className="text-sm text-red-400">{error}</p>
			</AuthCard>
		);
	}

	if (!isLoaded) {
		return (
			<AuthCard title="MCP sign in" subtitle="Preparing your MCP session.">
				<p className="text-sm text-muted-foreground">Loading...</p>
			</AuthCard>
		);
	}

	if (!isSignedIn) {
		return (
			<AuthCard
				title="Sign in to Workouts MCP"
				subtitle="Continue to connect this MCP client."
			>
				<SignInForm onSuccess={() => setError(undefined)} />
			</AuthCard>
		);
	}

	return (
		<AuthCard title="MCP sign in" subtitle="Returning to your MCP client.">
			<p className="text-sm text-muted-foreground">Connecting...</p>
		</AuthCard>
	);
}
```

- [ ] **Step 4: Keep MCP auth route outside app shell chrome**

Modify the `BARE_ROUTES` array in `src/routes/__root.tsx`:

```ts
const BARE_ROUTES = [
	"/sign-in",
	"/sign-up",
	"/forgot-password",
	"/login",
	"/api/cli/auth",
	"/mcp/auth",
];
```

- [ ] **Step 5: Regenerate TanStack route tree**

Run: `pnpm build:development`

Expected: build may continue far enough to regenerate `src/routeTree.gen.ts`. If the full build fails because MCP protocol route is not created yet, run Task 3 before retrying this exact command.

- [ ] **Step 6: Run route and helper tests**

Run: `pnpm exec vitest run src/lib/mcpRoutes.test.ts src/lib/mcpAuthRedirect.test.ts`

Expected: PASS after `src/routeTree.gen.ts` contains `/mcp/auth`. The `/mcp` assertion may still fail until Task 4 creates `src/routes/mcp.ts`; if so, keep this test staged with the route implementation task and do not commit it separately.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/routes/mcp/auth.tsx src/routes/__root.tsx src/routeTree.gen.ts src/lib/mcpRoutes.test.ts
git commit -m "feat: add mcp auth route"
```

Commit only when the route-tree test passes. If `/mcp` is not implemented yet, defer `src/lib/mcpRoutes.test.ts` to Task 4.

---

### Task 3: MCP Data Client And Tool Server

**Files:**
- Create: `src/lib/mcp/dataClient.ts`
- Create: `src/lib/mcp/toolResults.ts`
- Create: `src/lib/mcp/server.ts`
- Create: `src/lib/mcp/server.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces:
  - `type WorkoutsMcpDataClient`
  - `createConvexWorkoutsMcpDataClient(options: { convexUrl: string; token?: string }): WorkoutsMcpDataClient`
  - `createWorkoutsMcpServer(options: { dataClient: WorkoutsMcpDataClient }): McpServer`
- Consumes: Convex queries `api.exercises.list`, `api.workoutSessions.listRecent`, `api.sets.listForSession`, `api.oneRepMaxes.listCurrentForUser`, `api.progress.weeklyVolume`.

- [ ] **Step 1: Add MCP SDK dependency**

Run: `pnpm add @modelcontextprotocol/sdk@1.29.0`

Expected: `package.json` gains `@modelcontextprotocol/sdk`; `pnpm-lock.yaml` changes.

- [ ] **Step 2: Add failing server tests**

Create `src/lib/mcp/server.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createWorkoutsMcpServer } from "./server";
import type { WorkoutsMcpDataClient } from "./dataClient";

function createFakeDataClient(): WorkoutsMcpDataClient {
	return {
		listExercises: vi.fn(async () => [
			{
				id: "exercise1",
				name: "Back Squat",
				muscleGroups: ["quads", "glutes"],
				category: "compound",
				equipment: "barbell",
				isDefault: true,
			},
		]),
		listRecentWorkouts: vi.fn(async () => [
			{
				id: "session1",
				name: "Leg Day",
				date: 1_700_000_000_000,
				status: "completed",
				startTime: 1_700_000_000_000,
				endTime: 1_700_003_600_000,
			},
		]),
		getWorkoutSets: vi.fn(async () => [
			{
				id: "set1",
				exerciseId: "exercise1",
				setNumber: 1,
				reps: 5,
				weight: 100,
				unit: "kg",
				setType: "working",
				loggedAt: 1_700_000_100_000,
			},
		]),
		listPersonalRecords: vi.fn(async () => [
			{
				id: "orm1",
				exerciseId: "exercise1",
				value: 140,
				unit: "kg",
				date: 1_700_000_000_000,
				source: "actual",
			},
		]),
		getExerciseVolume: vi.fn(async () => [
			{
				week: "2026-W01",
				volume: 2400,
			},
		]),
	};
}

describe("createWorkoutsMcpServer", () => {
	it("creates a connected-capable MCP server with registered tools", () => {
		const server = createWorkoutsMcpServer({
			dataClient: createFakeDataClient(),
		});

		expect(server).toBeDefined();
		expect(server.isConnected()).toBe(false);
	});
});
```

- [ ] **Step 3: Run server test to verify missing modules**

Run: `pnpm exec vitest run src/lib/mcp/server.test.ts`

Expected: FAIL because `./server` and `./dataClient` do not exist.

- [ ] **Step 4: Add MCP data client**

Create `src/lib/mcp/dataClient.ts`:

```ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

export type ExerciseSummary = {
	id: string;
	name: string;
	muscleGroups: string[];
	category: "compound" | "isolation";
	equipment:
		| "barbell"
		| "dumbbell"
		| "cable"
		| "bodyweight"
		| "machine"
		| "kettlebell"
		| "band"
		| "other";
	isDefault: boolean;
	notes?: string;
};

export type WorkoutSummary = {
	id: string;
	name?: string;
	date: number;
	status: "active" | "completed" | "cancelled";
	startTime: number;
	endTime?: number;
};

export type WorkoutSetSummary = {
	id: string;
	exerciseId: string;
	setNumber: number;
	reps: number;
	weight: number;
	unit: "kg" | "lbs";
	rpe?: number;
	setType: "warmup" | "working" | "drop" | "failure";
	loggedAt: number;
};

export type PersonalRecordSummary = {
	id: string;
	exerciseId: string;
	value: number;
	unit: "kg" | "lbs";
	date: number;
	source: "manual" | "calculated" | "actual";
	formula?: string;
};

export type WeeklyVolumeSummary = {
	week: string;
	volume: number;
};

export type WorkoutsMcpDataClient = {
	listExercises(): Promise<ExerciseSummary[]>;
	listRecentWorkouts(args: { limit?: number }): Promise<WorkoutSummary[]>;
	getWorkoutSets(args: { sessionId: string }): Promise<WorkoutSetSummary[]>;
	listPersonalRecords(): Promise<PersonalRecordSummary[]>;
	getExerciseVolume(args: { exerciseId: string }): Promise<WeeklyVolumeSummary[]>;
};

export class McpAuthRequiredError extends Error {
	constructor() {
		super("Authentication is required for Workouts MCP tools.");
		this.name = "McpAuthRequiredError";
	}
}

export function createConvexWorkoutsMcpDataClient({
	convexUrl,
	token,
}: {
	convexUrl: string;
	token?: string;
}): WorkoutsMcpDataClient {
	if (!token) throw new McpAuthRequiredError();

	const client = new ConvexHttpClient(convexUrl);
	client.setAuth(token);

	return {
		async listExercises() {
			const exercises = await client.query(api.exercises.list, {});
			return exercises.map((exercise) => ({
				id: exercise._id,
				name: exercise.name,
				muscleGroups: exercise.muscleGroups,
				category: exercise.category,
				equipment: exercise.equipment,
				isDefault: exercise.isDefault,
				notes: exercise.notes,
			}));
		},
		async listRecentWorkouts({ limit }) {
			const sessions = await client.query(api.workoutSessions.listRecent, {
				limit,
			});
			return sessions.map((session) => ({
				id: session._id,
				name: session.name,
				date: session.date,
				status: session.status,
				startTime: session.startTime,
				endTime: session.endTime,
			}));
		},
		async getWorkoutSets({ sessionId }) {
			const sets = await client.query(api.sets.listForSession, {
				sessionId: sessionId as never,
			});
			return sets.map((set) => ({
				id: set._id,
				exerciseId: set.exerciseId,
				setNumber: set.setNumber,
				reps: set.reps,
				weight: set.weight,
				unit: set.unit,
				rpe: set.rpe,
				setType: set.setType,
				loggedAt: set.loggedAt,
			}));
		},
		async listPersonalRecords() {
			const records = await client.query(api.oneRepMaxes.listCurrentForUser, {});
			return records.map((record) => ({
				id: record._id,
				exerciseId: record.exerciseId,
				value: record.value,
				unit: record.unit,
				date: record.date,
				source: record.source,
				formula: record.formula,
			}));
		},
		async getExerciseVolume({ exerciseId }) {
			return client.query(api.progress.weeklyVolume, {
				exerciseId: exerciseId as never,
			});
		},
	};
}
```

- [ ] **Step 5: Add tool result formatter**

Create `src/lib/mcp/toolResults.ts`:

```ts
export function jsonText(value: unknown) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(value, null, 2),
			},
		],
	};
}

export function errorText(message: string) {
	return {
		isError: true,
		content: [
			{
				type: "text" as const,
				text: message,
			},
		],
	};
}
```

- [ ] **Step 6: Add MCP server factory**

Create `src/lib/mcp/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { McpAuthRequiredError, type WorkoutsMcpDataClient } from "./dataClient";
import { errorText, jsonText } from "./toolResults";

export function createWorkoutsMcpServer({
	dataClient,
}: {
	dataClient: WorkoutsMcpDataClient;
}) {
	const server = new McpServer({
		name: "workouts",
		version: "0.1.0",
	});

	registerReadOnlyTools(server, dataClient);

	return server;
}

function registerReadOnlyTools(
	server: McpServer,
	dataClient: WorkoutsMcpDataClient,
) {
	server.registerTool(
		"list_exercises",
		{
			title: "List exercises",
			description:
				"List default exercises plus custom exercises visible to the authenticated Workouts user.",
			inputSchema: {},
		},
		async () => withToolErrors(() => dataClient.listExercises()),
	);

	server.registerTool(
		"list_recent_workouts",
		{
			title: "List recent workouts",
			description:
				"List recent workout sessions for the authenticated Workouts user. The limit is capped by Convex.",
			inputSchema: {
				limit: z.number().int().min(1).max(50).optional(),
			},
		},
		async ({ limit }) =>
			withToolErrors(() => dataClient.listRecentWorkouts({ limit })),
	);

	server.registerTool(
		"get_workout_sets",
		{
			title: "Get workout sets",
			description:
				"Return sets for one workout session owned by the authenticated Workouts user.",
			inputSchema: {
				sessionId: z.string().min(1),
			},
		},
		async ({ sessionId }) =>
			withToolErrors(() => dataClient.getWorkoutSets({ sessionId })),
	);

	server.registerTool(
		"list_personal_records",
		{
			title: "List personal records",
			description:
				"List current one-rep max records for the authenticated Workouts user.",
			inputSchema: {},
		},
		async () => withToolErrors(() => dataClient.listPersonalRecords()),
	);

	server.registerTool(
		"get_exercise_volume",
		{
			title: "Get exercise volume",
			description:
				"Return weekly training volume for one exercise visible to the authenticated Workouts user.",
			inputSchema: {
				exerciseId: z.string().min(1),
			},
		},
		async ({ exerciseId }) =>
			withToolErrors(() => dataClient.getExerciseVolume({ exerciseId })),
	);
}

async function withToolErrors(load: () => Promise<unknown>) {
	try {
		return jsonText(await load());
	} catch (error) {
		if (error instanceof McpAuthRequiredError) {
			return errorText("Authentication is required. Start at /mcp/auth.");
		}
		return errorText("The Workouts MCP tool failed.");
	}
}
```

- [ ] **Step 7: Run server tests**

Run: `pnpm exec vitest run src/lib/mcp/server.test.ts`

Expected: PASS.

- [ ] **Step 8: Run typecheck for Convex ID casting issues**

Run: `pnpm typecheck`

Expected: PASS. If TypeScript rejects `sessionId as never` or `exerciseId as never`, replace those casts with explicit imports of Convex `Id`:

```ts
import type { Id } from "@convex/_generated/dataModel";
```

Then cast to `sessionId as Id<"workoutSessions">` and `exerciseId as Id<"exercises">`.

- [ ] **Step 9: Commit**

Run:

```bash
git add package.json pnpm-lock.yaml src/lib/mcp/dataClient.ts src/lib/mcp/toolResults.ts src/lib/mcp/server.ts src/lib/mcp/server.test.ts
git commit -m "feat: add read-only mcp tool server"
```

---

### Task 4: MCP Protocol Route And Protocol Tests

**Files:**
- Create: `src/lib/mcp/handler.ts`
- Create: `src/lib/mcp/handler.test.ts`
- Create: `src/routes/mcp.ts`
- Modify: `src/lib/mcpRoutes.test.ts`
- Modify: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes:
  - `createWorkoutsMcpServer(options): McpServer`
  - `createConvexWorkoutsMcpDataClient(options): WorkoutsMcpDataClient`
- Produces:
  - `handleWorkoutsMcpRequest(request: Request, options: WorkoutsMcpRequestOptions): Promise<Response>`
  - TanStack route path `/mcp`

- [ ] **Step 1: Add failing protocol tests**

Create `src/lib/mcp/handler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { handleWorkoutsMcpRequest } from "./handler";
import type { WorkoutsMcpDataClient } from "./dataClient";

function fakeDataClient(): WorkoutsMcpDataClient {
	return {
		listExercises: async () => [
			{
				id: "exercise1",
				name: "Back Squat",
				muscleGroups: ["quads"],
				category: "compound",
				equipment: "barbell",
				isDefault: true,
			},
		],
		listRecentWorkouts: async () => [],
		getWorkoutSets: async () => [],
		listPersonalRecords: async () => [],
		getExerciseVolume: async () => [],
	};
}

function mcpRequest(body: unknown) {
	return new Request("http://localhost:3000/mcp", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: "Bearer test-token",
		},
		body: JSON.stringify(body),
	});
}

describe("handleWorkoutsMcpRequest", () => {
	it("handles MCP initialize", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: {
						name: "vitest",
						version: "1.0.0",
					},
				},
			}),
			{
				createDataClient: () => fakeDataClient(),
			},
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.result.serverInfo.name).toBe("workouts");
	});

	it("lists registered tools", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest({
				jsonrpc: "2.0",
				id: 2,
				method: "tools/list",
			}),
			{
				createDataClient: () => fakeDataClient(),
			},
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.result.tools.map((tool: { name: string }) => tool.name)).toEqual(
			expect.arrayContaining(["list_exercises", "list_recent_workouts"]),
		);
	});

	it("calls a read-only tool", async () => {
		const response = await handleWorkoutsMcpRequest(
			mcpRequest({
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: {
					name: "list_exercises",
					arguments: {},
				},
			}),
			{
				createDataClient: () => fakeDataClient(),
			},
		);

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.result.content[0].text).toContain("Back Squat");
	});
});
```

- [ ] **Step 2: Run protocol tests to verify missing handler**

Run: `pnpm exec vitest run src/lib/mcp/handler.test.ts`

Expected: FAIL because `./handler` does not exist.

- [ ] **Step 3: Add MCP handler**

Create `src/lib/mcp/handler.ts`:

```ts
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
	createConvexWorkoutsMcpDataClient,
	type WorkoutsMcpDataClient,
} from "./dataClient";
import { createWorkoutsMcpServer } from "./server";

export type WorkoutsMcpRequestOptions = {
	convexUrl?: string;
	createDataClient?: (args: {
		convexUrl: string;
		token?: string;
	}) => WorkoutsMcpDataClient;
};

export async function handleWorkoutsMcpRequest(
	request: Request,
	options: WorkoutsMcpRequestOptions = {},
): Promise<Response> {
	const token = parseBearerToken(request.headers.get("authorization"));
	const convexUrl = options.convexUrl ?? getConvexUrl();
	const createDataClient =
		options.createDataClient ?? createConvexWorkoutsMcpDataClient;
	const dataClient = createDataClient({ convexUrl, token });
	const server = createWorkoutsMcpServer({ dataClient });
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});

	await server.connect(transport);
	return transport.handleRequest(request);
}

export function parseBearerToken(header: string | null): string | undefined {
	if (!header) return undefined;
	const [scheme, token] = header.split(" ");
	if (scheme.toLowerCase() !== "bearer" || !token) return undefined;
	return token;
}

function getConvexUrl(): string {
	const url = import.meta.env.VITE_CONVEX_URL;
	if (!url) throw new Error("missing env var VITE_CONVEX_URL");
	return url;
}
```

- [ ] **Step 4: Add `/mcp` server route**

Create `src/routes/mcp.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { handleWorkoutsMcpRequest } from "#/lib/mcp/handler";

export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			GET: async ({ request }) => handleWorkoutsMcpRequest(request),
			POST: async ({ request }) => handleWorkoutsMcpRequest(request),
			DELETE: async ({ request }) => handleWorkoutsMcpRequest(request),
		},
	},
});
```

- [ ] **Step 5: Regenerate route tree and run route guard**

Run: `pnpm build:development`

Expected: PASS or a build failure unrelated to route generation. Confirm `src/routeTree.gen.ts` contains `'/mcp'` and `'/mcp/auth'`.

Run: `pnpm exec vitest run src/lib/mcpRoutes.test.ts`

Expected: PASS.

- [ ] **Step 6: Run protocol tests**

Run: `pnpm exec vitest run src/lib/mcp/handler.test.ts src/lib/mcp/server.test.ts`

Expected: PASS. If `tools/list` fails before initialization because the SDK requires initialized state, change that test to send an initialize request first and then call `tools/list` with a fresh handler call only if stateless mode permits it; otherwise keep a single batch JSON-RPC request containing initialize and tools/list.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/lib/mcp/handler.ts src/lib/mcp/handler.test.ts src/routes/mcp.ts src/lib/mcpRoutes.test.ts src/routeTree.gen.ts
git commit -m "feat: expose mcp server route"
```

---

### Task 5: Documentation And Appelent Registry

**Files:**
- Create: `docs/mcp.md`
- Modify: `C:\Users\ericj\.claude\appelent\projects.json`
- Modify: `.claude/appelent/projects.managed.json`

**Interfaces:**
- Consumes:
  - `/mcp`
  - `/mcp/auth?redirect_uri=http://127.0.0.1:<port>/callback&state=<nonce>`
- Produces:
  - User-facing MCP connection notes.
  - Appelent registry entry for Workouts capability `mcp`.

- [ ] **Step 1: Create MCP docs**

Create `docs/mcp.md`:

```md
# Workouts MCP

Workouts exposes a read-only MCP endpoint at:

```text
/mcp
```

The endpoint is hosted by the same TanStack Start webapp as the Workouts UI.

## Auth

Personal data tools require a Convex-compatible Clerk JWT:

```http
Authorization: Bearer <token>
```

MCP clients can obtain a token by opening the browser-mediated auth endpoint:

```text
/mcp/auth?redirect_uri=http://127.0.0.1:<port>/callback&state=<nonce>
```

The callback URL must be local loopback over HTTP using `127.0.0.1` or `localhost`.
The auth page signs the user in through Workouts, creates a Clerk token using the
`convex` template, and redirects back to the local callback with either:

```text
?state=<nonce>&token=<jwt>
```

or:

```text
?state=<nonce>&error=<code>&error_description=<message>
```

## Tools

- `list_exercises`
- `list_recent_workouts`
- `get_workout_sets`
- `list_personal_records`
- `get_exercise_volume`

All tools are read-only in this first MCP slice.

## Local Verification

Start the app:

```bash
pnpm dev:watch
```

Connect an MCP-capable client to:

```text
http://localhost:3000/mcp
```

Use `/mcp/auth` to obtain a token before calling personal-data tools.
```

- [ ] **Step 2: Update Appelent global registry**

Modify `C:\Users\ericj\.claude\appelent\projects.json` so the Workouts project capabilities include `mcp`:

```json
"workouts": {
  "path": "D:\\Dev\\workouts",
  "baseline": "tanstack-convex-clerk-cloudflare",
  "capabilities": [
    "auth",
    "cli",
    "mcp"
  ]
}
```

- [ ] **Step 3: Update repo-local registry mirror**

Modify `.claude/appelent/projects.managed.json` so the Workouts project capabilities include `mcp` with the same array order:

```json
"workouts": {
  "path": "D:\\Dev\\workouts",
  "baseline": "tanstack-convex-clerk-cloudflare",
  "capabilities": [
    "auth",
    "cli",
    "mcp"
  ]
}
```

- [ ] **Step 4: Run registry/doc status check**

Run: `git diff -- docs/mcp.md .claude/appelent/projects.managed.json`

Expected: diff shows only the new MCP docs and `mcp` added to Workouts capabilities in the repo-local registry mirror.

Run: `git diff -- C:/Users/ericj/.claude/appelent/projects.json`

Expected: diff shows only `mcp` added to Workouts capabilities in the global registry.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs/mcp.md .claude/appelent/projects.managed.json
git add C:/Users/ericj/.claude/appelent/projects.json
git commit -m "docs: document workouts mcp endpoint"
```

---

### Task 6: Final Verification

**Files:**
- Verify all changed files from Tasks 1-5.

**Interfaces:**
- Consumes all prior task outputs.
- Produces passing verification evidence.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run src/lib/cliAuthRedirect.test.ts src/lib/mcpAuthRedirect.test.ts src/lib/mcpRoutes.test.ts src/lib/mcp/server.test.ts src/lib/mcp/handler.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 4: Run Biome check**

Run: `pnpm check`

Expected: PASS.

- [ ] **Step 5: Run production build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 6: Inspect final diff**

Run: `git status --short`

Expected: no unstaged changes after final commits, or only intentional uncommitted local files the user asked to keep.

Run: `git log --oneline -6`

Expected: recent commits show the MCP helper, auth route, tool server, protocol route, and docs/registry commits.

## Self-Review

- Spec coverage: Tasks 1-2 cover `/mcp/auth`; Tasks 3-4 cover `/mcp`, read-only tools, SDK package choice, auth denial, and route-first hosting; Task 5 covers docs and Appelent registry; Task 6 covers verification.
- Red-flag scan: no banned marker tokens or unspecified implementation steps remain.
- Type consistency: `WorkoutsMcpDataClient`, `createConvexWorkoutsMcpDataClient`, `createWorkoutsMcpServer`, and `handleWorkoutsMcpRequest` are defined before later tasks consume them.
