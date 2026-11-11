---
type: runbook
description: Read when connecting to, operating, or changing the Foundry MCP server.
version: 3.0.0
---

# Foundry MCP

Foundry serves a remote MCP server at `/mcp` from the same Worker as the web app.
Any Foundry user can connect Claude, ChatGPT, or another MCP client and read or
log their own data. The design is in
[ADR 0016](../adr/0016-clerk-oauth-for-mcp.md).

| Environment | Endpoint                                      | Clerk issuer                                 |
| ----------- | --------------------------------------------- | -------------------------------------------- |
| Production  | `https://foundry.appelent.nl/mcp`             | `https://clerk.appelent.nl`                  |
| Dev Worker  | `https://foundry-dev.appelent.workers.dev/mcp` | `https://calm-cricket-82.clerk.accounts.dev` |
| Local       | `http://localhost:3000/mcp`                   | dev issuer                                   |

## Connect

- **Claude.ai, Desktop, mobile:** Settings → Connectors → Add custom connector,
  paste the endpoint, then sign in with Foundry.
- **Claude Code:** `claude mcp add --transport http foundry https://foundry.appelent.nl/mcp`,
  then run `/mcp` and choose Authenticate.
- **ChatGPT and others:** add the endpoint as a remote MCP server with OAuth.

Clients discover everything else: the endpoint answers `401` with
`WWW-Authenticate: Bearer resource_metadata=…`, the metadata names Clerk as the
authorization server, and the client registers itself (DCR or CIMD) and signs
the user in with PKCE.

## How a request is authorized

1. The client sends `Authorization: Bearer <Clerk OAuth access token>`.
2. The Worker verifies the JWT against Clerk's JWKS: issuer, RS256, and
   `aud` exactly equal to this endpoint's URL (RFC 8707 `resource`).
3. The token's `scope` decides which tools exist for this connection:
   `foundry:read` lists read tools, `foundry:write` adds write tools. A token
   with neither gets `403 insufficient_scope`.
4. Tools call Convex with the same token. Convex trusts it through a
   `customJwt` provider whose `applicationID` is the endpoint URL, so
   `identity.subject` is the Clerk user ID and the usual ownership checks apply.
5. Convex enforces the scopes again, because a client could call it directly
   with the token: `getIdentity` in `convex/lib/connectedApps.ts` rejects
   mutations and actions from an OAuth identity without `foundry:write`, and
   account deletion and test-data reset reject every OAuth identity. Use
   `getIdentity(ctx)`, never `ctx.auth.getUserIdentity()`, in new modules.

Browser `Origin`s are limited to claude.ai, claude.com, chatgpt.com, the app's
own origin, and localhost against a local server. Server-side clients send none.

## Tools

Read (`foundry:read`): `get_current_user`, `list_activities`, `get_run_or_ride`,
`list_body_metrics`, `list_wods`, `get_wod_results`, `list_exercises`,
`get_exercise_history`, `get_exercise_volume`, `list_one_rep_maxes`,
`list_routines`, `get_active_strength_session`, `get_strength_session`,
`get_nutrition_day`, `get_nutrition_week`, `get_nutrition_goals`,
`search_foods`.

Write (`foundry:write`): `log_run_or_ride`, `update_run_or_ride`,
`log_body_metrics`, `log_wod_result`, `start_strength_session`,
`add_exercise_to_session`, `log_set`, `update_set`, `finish_strength_session`,
`record_one_rep_max`, `log_food`, `log_custom_food`, `update_diary_entry`.

Rules for every tool:

- Write tools that create data require an `idempotencyKey`. The server stores
  it as `mcp:<key>`; a retry with the same key and input returns the first
  result, and the same key with different input is rejected.
- There are no delete tools. Users delete in the app.
- Results are JSON in `structuredContent` and as text. Errors show validation
  and Convex user messages only; internal errors become a generic message.

To add a tool, add it to a file in `src/lib/mcp/tools/` with `defineTool`, set
`access`, and add a case to `src/lib/mcp/handler.test.ts`. A new create tool
needs a Convex idempotency key (`operationId`, `clientEntryId`, or
`withOperationReceipt`).

## Setup per environment

**Clerk instance** (shared by all AppElent apps):

- OAuth applications → Scopes: `foundry:read` and `foundry:write`. Creating
  scopes is Dashboard-only.
- OAuth settings: JWT access tokens, PKCE required, audience claim on, and
  `default_scopes` = `openid profile email foundry:read foundry:write`
  (Backend API `PATCH /v1/instance/oauth_application_settings` when the
  Dashboard lacks a field). Leave dynamic client registration off: Claude.ai and
  Claude Code use CIMD.
- MCP resource for the endpoint URL (Clerk MCP `configure_mcp_server`, or the
  Dashboard). This also turns on CIMD.
- Production DNS: the `clerk`, `accounts`, `clkmail`, and DKIM CNAMEs on
  `appelent.nl` are **DNS only** in Cloudflare. A proxied `accounts` record
  breaks sign-in and consent with Cloudflare Error 1000.

**Convex:** `MCP_RESOURCE_URLS` (Infisical `/foundry/mcp-resource-urls`) is a
comma-separated list of endpoint URLs. Convex requires every variable
`auth.config.ts` reads on every deployment, so a deployment without MCP uses
`none`. Apply it with `pnpm env:apply <environment> --only convex` **before**
pushing functions, or the push fails.

| Infisical env | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| dev           | `http://localhost:3000/mcp,https://foundry-dev.appelent.workers.dev/mcp` |
| staging       | `none` (PR previews)                                                  |
| prod          | `https://foundry.appelent.nl/mcp`                                      |
| prod, `mcp-resource-urls-staging` | `none` (staging web)                              |

PR preview Workers and the staging web have no MCP. Preview URLs change per PR,
and staging would need its own Clerk resource and a staging value.

## Verify

1. `curl -i -X POST <endpoint>`: expect `401` with `resource_metadata`.
2. `curl <origin>/.well-known/oauth-protected-resource/mcp`: expect `resource`
   equal to the endpoint and `scopes_supported` with both Foundry scopes.
3. Connect Claude Code (above) and ask "Who am I in Foundry?". It should call
   `get_current_user` and show the granted scopes.
4. Connect Claude.ai separately. It uses its own client and Anthropic's
   servers, so Claude Code working does not prove it.

## Troubleshooting

- **`401 invalid_token`:** the token's `aud` is not this endpoint. Check the
  Clerk MCP resource and that the client sent `resource`.
- **`403 insufficient_scope`:** the grant lacks Foundry scopes. Check the Clerk
  scopes and `default_scopes`, then reconnect.
- **Claude.ai: "Authorization with Foundry failed":** tail the Worker
  (`pnpm exec wrangler tail foundry`) while connecting. Only a `401` and a
  metadata fetch from `160.79.x` means Clerk stopped the flow. Read the `error`
  on the `claude.ai/api/mcp/auth_callback` URL in browser history.
- **`invalid_scope` ("not allowed to request scope …"):** Clerk saved that CIMD
  client before the scopes existed. Edit its scopes, or delete it under OAuth
  applications so the next connect recreates it.
- **Cloudflare Error 1000 on `accounts.appelent.nl`:** the record is proxied;
  set it to DNS only.
- **Tools fail with "Not authenticated":** Convex does not trust the token.
  Check `MCP_RESOURCE_URLS` on that deployment matches the endpoint exactly.
