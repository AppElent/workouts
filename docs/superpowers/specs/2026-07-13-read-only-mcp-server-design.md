# Read-Only MCP Server Design

## Goal

Expose a first MCP endpoint from the Workouts webapp so external AI clients can inspect a signed-in user's workout data. This first slice is base infrastructure plus read-only insight tools only. It does not add write tools, hosted-workout automation, an in-app AI assistant, or a separate MCP-hosting service.

## Package Choice

Do not use `@tanstack/ai-mcp` for this slice. That package is host-side/client-oriented: it helps a TanStack AI chat loop discover and call tools from MCP servers. Workouts is exposing an MCP server, so the server implementation should use the MCP TypeScript SDK and, where compatible with TanStack Start server routes, Cloudflare's MCP transport helpers.

Planned dependencies:

- `@modelcontextprotocol/sdk` for `McpServer`, tool registration, schemas, and protocol types.
- `agents` only if `agents/mcp` can be used cleanly from a TanStack Start server route or from the same app's server entrypoint.
- Existing `zod` stays the schema library.

## Hosting Shape

The MCP server is hosted by the existing TanStack Start webapp, at the same origin as the UI:

```text
https://<workouts-host>/mcp
```

Preferred implementation:

- Add `src/routes/mcp.ts`.
- Define TanStack Start server route handlers for the HTTP methods required by Streamable HTTP.
- Keep the route as a thin protocol adapter.
- Put tool creation and Workouts-specific read logic in `src/lib/mcp/*`.

Fallback if required by transport constraints:

- Add `src/server.ts` and wrap the default TanStack Start `handler.fetch`.
- Route only `/mcp` through the MCP handler and pass all other requests to TanStack Start.
- This is still the same Workouts webapp and same Cloudflare Worker deployment, not a separate service.

Use the fallback only if the server route cannot provide the runtime hooks needed by the selected MCP transport.

## Tool Set

Expose a compact, read-only set of goal-shaped tools:

- `list_exercises`: return default exercises plus the user's custom exercises when authenticated.
- `list_recent_workouts`: return recent workout sessions for the user, with a safe maximum limit.
- `get_workout_sets`: return the sets for one workout session owned by the user.
- `list_personal_records`: return current one-rep max records for the user.
- `get_exercise_volume`: return weekly volume for one exercise owned or visible to the user.

Tool handlers should format responses for agent use rather than leaking raw database rows wholesale. Include stable IDs where a follow-up tool needs them. Avoid exposing internal fields that are not useful to an MCP client.

## Auth

All personal-data tools require authentication.

Initial auth model:

- MCP clients send `Authorization: Bearer <Clerk JWT>`.
- Clients obtain that JWT from a dedicated MCP auth endpoint at `/mcp/auth`.
- The MCP auth endpoint uses the same browser-mediated mechanism as the existing CLI auth flow: validate a loopback `redirect_uri` plus `state`, require the user to sign in through the webapp, call Clerk's `getToken({ template: "convex" })`, then redirect the token back to the local client callback.
- The MCP route extracts the token and creates an authenticated Convex HTTP client for the request.
- Convex queries continue to enforce the existing user ownership rules.
- Missing, expired, or invalid tokens produce protocol errors without returning personal data.

Unauthenticated access is limited to protocol initialization and, if useful, non-sensitive server metadata. Tool descriptions may be visible to unauthenticated clients, but tool calls that read user data must deny by default.

The existing `/api/cli/auth/login` route stays CLI-owned. The MCP endpoint may share generic redirect parsing/building helpers with the CLI route, but user-facing labels, errors, tests, and documentation should refer to MCP so the auth surface can evolve independently later.

Long-lived Clerk API keys or app-managed MCP tokens are intentionally out of scope for this slice. They can be added later with UI for creation, storage, rotation, and revocation.

## Data Flow

1. MCP client connects to `/mcp`.
2. If the client does not already have a usable token, it starts the MCP auth flow at `/mcp/auth?redirect_uri=http://127.0.0.1:<port>/callback&state=<nonce>`.
3. The browser-mediated auth endpoint returns a Convex-compatible Clerk JWT to the local callback.
4. The client retries or starts the MCP request with `Authorization: Bearer <token>`.
5. TanStack server route receives the Streamable HTTP request.
6. Route creates a fresh MCP server instance for the request or connection lifecycle required by the transport.
7. Route builds a per-request context containing the Clerk bearer token and an authenticated Convex HTTP client.
8. Tool handlers call existing Convex queries where possible:
   - `exercises.list`
   - `workoutSessions.listRecent`
   - `sets.listForSession`
   - `oneRepMaxes.listCurrentForUser`
   - `progress.weeklyVolume`
9. Tool handlers return concise text or structured JSON content through MCP.

## Error Handling

- Invalid input: return a validation error with the field that failed and the expected shape.
- Missing auth: return an auth-required protocol error.
- Unauthorized resource access: return not found or unauthorized without exposing whether another user's resource exists.
- Convex/network failure: return a generic tool failure and log enough server-side detail for debugging.

## Tests

Add focused tests for the MCP layer:

- MCP auth redirect helpers accept loopback callbacks, preserve state, and reject non-loopback callbacks.
- MCP auth route requests a Convex Clerk token and redirects token or structured errors to the client callback.
- Server factory registers the expected tools.
- Tool argument validation rejects invalid inputs.
- Missing auth denies all personal-data tool calls.
- Mocked authenticated calls shape successful responses correctly.
- Protocol-level tests cover `initialize`, `tools/list`, one successful `tools/call`, invalid tool name, and invalid arguments.

Run:

- `pnpm typecheck`
- targeted Vitest tests for the MCP files
- `pnpm build`

Manual verification should use MCP Inspector or an MCP-capable client against local `/mcp`.

## Documentation And Registry

Add connection notes to project docs:

- local and deployed endpoint URL
- auth header requirement
- MCP auth login endpoint and loopback callback flow
- an example client/proxy command
- the initial read-only limitation

Update Appelent project registry files so Workouts includes the active `mcp` capability. The capability remains skill-owned, not package-owned, because there is not yet an `@appelent/mcp` package.

## Open Implementation Check

During implementation, verify whether `agents/mcp` can run directly inside a TanStack Start server route. If it cannot, use the `src/server.ts` same-app fallback described above. Either way, the public result remains a hosted `/mcp` endpoint on the Workouts webapp.
