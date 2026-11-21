---
type: runbook
description: Read when connecting to, operating, or changing the Foundry MCP server.
version: 3.4.0
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
  The client must support CIMD, because DCR is off.

Clients discover everything else: the endpoint answers `401` with
`WWW-Authenticate: Bearer resource_metadata=…`, the metadata names Clerk as the
authorization server, and the client identifies itself with a Client ID
Metadata Document (CIMD) and signs the user in with PKCE. Dynamic client
registration (DCR) is off.

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
`search_foods`, and the view tools `open_foundry`, `show_week_overview`,
`review_food_log`, and `show_exercise_progress` (see [Views](#views)).

Write (`foundry:write`): `log_run_or_ride`, `update_run_or_ride`,
`log_body_metrics`, `log_wod_result`, `create_exercise`,
`start_strength_session`, `add_exercise_to_session`, `log_set`, `update_set`,
`finish_strength_session`, `record_one_rep_max`, `log_food`,
`log_custom_food`, `update_diary_entry`.

Training setup and logging afterwards follow the
[Training contract](../contracts/training.md#connected-app-setup):
`create_exercise` dedupes by name, `add_exercise_to_session` takes
`plannedSets` (kg or a percentage of the 1RM), and `start_strength_session`,
`log_set`, and `finish_strength_session` take `startedAt`, `loggedAt`, and
`endedAt`.

Rules for every tool:

- Write tools that create data require an `idempotencyKey`. The server stores
  it as `mcp:<key>`; a retry with the same key and input returns the first
  result, and the same key with different input is rejected. `create_exercise`
  is the exception: the name is its identity, so a retry returns the same
  Personal Exercise.
- There are no delete tools. Users delete in the app.
- Results are JSON in `structuredContent` and as text. Errors show validation
  and Convex user messages only: a coded `ConvexError` reads as its English
  catalog text (`src/lib/i18n/messages/en/errors.ts`) or its code and field.
  Internal errors become a generic message and are reported to Sentry.

To add a tool, add it to a file in `src/lib/mcp/tools/` with `defineTool`, set
`access`, and add a case to `src/lib/mcp/handler.test.ts`. A new create tool
needs a Convex idempotency key (`operationId`, `clientEntryId`, or
`withCreateReceipt` in `convex/lib/operationReceipt.ts`).

## Views

Four read tools open an interactive view (an [MCP App](https://modelcontextprotocol.io/extensions/apps/overview))
in hosts that support it, such as Claude.ai. Other clients get the same data as
JSON and text.

| Tool                     | View                         | What it does                                                                                              |
| ------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `open_foundry`           | `ui://foundry/home`              | Home: today's nutrition against goals, the active or latest Strength Session, and this week. Links open the week overview and exercise progress in the same view. |
| `show_week_overview`     | `ui://foundry/week-overview`     | Activities and nutrition per day for one Monday-to-Sunday week. Previous/next week call the tool again. |
| `review_food_log`        | `ui://foundry/food-log`          | Proposed diary entries to adjust, remove, and log. Log calls `log_food` per item.                        |
| `show_exercise_progress` | `ui://foundry/exercise-progress` | e1RM or top set over 4w, 12w, or 1y as SVG charts, with weekly volume and 1RMs.                           |

How it works:

- The UI is React in `src/lib/mcp/views/ui/`. The Vite plugin in
  `src/lib/mcp/views/vitePlugin.ts` builds it into one HTML file with inlined
  JS and CSS and exposes it as `virtual:foundry-mcp-views`. The Worker bundle
  carries it; there is no separate deploy. All views share the file, and
  the server sets `data-view` per resource.
- The views make no network requests, so the resource declares no CSP domains.
  They talk to the server only through the host (`callServerTool`).
- `_meta.ui.domain` is Claude's sandbox origin for this endpoint: the first 32
  hex characters of SHA-256 of the endpoint URL, then `.claudemcpcontent.com`.
  The server computes it per request, so each environment gets its own.
- Resources and view tools need `foundry:read`. `review_food_log` only proposes
  entries; without `foundry:write` the view hides Log and says why. Each item
  gets an `idempotencyKey` made from the result's `reviewId` and its row, so
  neither a retry nor a reloaded view (the host sends the same result again)
  logs twice. After every save the view tells the model everything saved so far
  (`updateModelContext` replaces what it said before). Once something is saved,
  removed items stay removed. An edit that Foundry refuses because the first
  attempt already landed shows its own message (`operationConflict`), and an
  invalid quantity is flagged and holds Log back. The text result of
  `review_food_log` is a short summary; the full proposal is in
  `structuredContent`.
- Calendar days follow the user's time zone. The tool call that opens a view
  cannot know it, so `show_week_overview` and `show_exercise_progress` take an
  optional IANA `timeZone` (UTC when omitted), and the view calls the tool again
  with the host's `timeZone` before it shows anything. `review_food_log` takes
  its `date` from the caller, as the nutrition tools do.
- Food and serving names are sent in English and Dutch; the view shows the
  host's language.
- View text follows the host locale in English or Dutch
  (`src/lib/i18n/messages/*/mcp-views.ts`).

### Foundry as an app in Claude

Claude can also open Foundry as an app: from the Artifacts page or the sidebar,
in the side panel next to the chat, and with tools Claude calls inside the open
view. Claude rolls these out to a limited set of organisations, only in the
unified Claude experience (no Chat/Cowork choice) and not on mobile. Where they
are missing, the same views render inline in the conversation. Claude's docs:
[entry points](https://claude.com/docs/connectors/building/mcp-apps/entry-points),
[display modes](https://claude.com/docs/connectors/building/mcp-apps/display-modes),
and [app tools](https://claude.com/docs/connectors/building/mcp-apps/app-tools).

- **Entry point.** `open_foundry` carries
  `_meta["openai/ui"].entrypoints = [{ type: "global" }]` next to
  `_meta.ui.resourceUri` (the `meta` field of `defineTool`). Every input is
  optional, and `{}` shows the home view. Claude lists it only when the title
  is 60 characters or fewer without Claude's or Anthropic's name, the name has
  no `__`, `..`, or `._`/`_.`, and the tool is not Blocked. A change can take two
  hours to show; on claude.ai → Customize → Connectors, the connector's menu has
  **Refresh tools list** to apply it at once.
- **Display modes.** Every view declares `availableDisplayModes: ["inline",
  "fullscreen"]` and shows its own expand button, which calls
  `requestDisplayMode` from the click. In Claude, `fullscreen` is the side
  panel (opens at about half the chat, at least about 320 px) or full screen.
  The week overview's resource sets `_meta.ui.preferredDisplayMode:
  "fullscreen"`, a Claude extension: after the tool returns, Claude tries once
  to move it out of the conversation. The layouts work from 320 px up; the
  week shows seven columns from 720 px.
- **App tools.** Each view registers tools with `app.registerTool` in
  `src/lib/mcp/views/ui/appTools.ts`, before `app.connect()` (in `useApp`'s
  `onAppCreated`), with zod schemas (ext-apps 1.7 or later and zod 4.2 or later
  are required). They change only what the view shows and answer with text;
  writes still go through server tools and the view's buttons.

  | View                | App tools                                                                 |
  | ------------------- | ------------------------------------------------------------------------- |
  | `home`              | `go_home`, `go_to_week`, `show_exercise`, `set_range`, `set_metric`       |
  | `week-overview`     | `go_to_week`                                                              |
  | `exercise-progress` | `set_range`, `set_metric`                                                 |
  | `food-log`          | `add_item`, `set_quantity`, `remove_item` (Log stays the user's button)   |

  The tools are registered once, but what they act on is React state, so each
  screen publishes its controls to a `ControlBridge`; a tool whose screen is
  not showing answers that nothing changed. `add_item` looks the food up with
  `review_food_log` and gives the new row a fresh idempotency key. Claude sees
  a view's tools from the message after the view opened, and a conversation can
  hold two views; each tool changes only its own view.

`appTools.test.ts` checks the registration and schemas, `FoodLog.test.tsx` the
food log tools, and `handler.test.ts` the `_meta` of `open_foundry` and the
display-mode metadata.

#### Views on claude.ai in the browser

On 12 Nov 2026 the views rendered in Claude Desktop but not on claude.ai in a
browser; the tool data still showed. What the code rules out:

- The resource is the same for both: one connector URL, so the same
  `_meta.ui.domain`. A wrong domain shows an error on the web and in Desktop
  alike.
- The views load nothing from the network, so no CSP domain is missing.
- Tool results are a few KB, far under the 150,000 characters after which
  Claude writes a result to a file and the view never hydrates.
- The HTML is about 680 KB: zod (bundled by ext-apps for protocol validation)
  and React DOM make up most of it. Claude documents no size limit for a view.

What is left is the browser: an extension or a privacy setting that blocks the
third-party `*.claudemcpcontent.com` iframe or its scripts. To check, open the
chat in a private window with extensions off. If the view renders there, it is
an extension; otherwise open developer tools, find the nested
`claudemcpcontent.com` iframe, and read its console (Verbose level for the SDK
messages).

To change a view, edit `src/lib/mcp/views/ui/` and check it in a host:

1. Run the ext-apps [`basic-host`](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host)
   example or MCP Inspector against an MCP endpoint, call the tool, and check
   light, dark, and a narrow width. Use a local server with fixture data
   rather than `pnpm dev:watch`, which pushes to the shared dev deployment.
2. Then check the dev Worker in Claude.ai.

`pnpm build` fails if the view bundle does not build. `handler.test.ts` checks
the resource HTML, `_meta.ui`, and the view tools.

If a view does not render in Claude, see Claude's
[MCP Apps troubleshooting](https://claude.com/docs/connectors/building/mcp-apps/troubleshooting).
A blank view usually means a script error: open the iframe's console in the
browser developer tools.

## Setup per environment

**Clerk instance** (shared by all AppElent apps):

- OAuth applications → Scopes: `foundry:read` and `foundry:write`. Creating
  scopes is Dashboard-only.
- OAuth settings: JWT access tokens, PKCE required, audience claim on, and
  `default_scopes` = `openid profile email foundry:read foundry:write`
  (Backend API `PATCH /v1/instance/oauth_application_settings` when the
  Dashboard lacks a field). Clerk uses them when a client omits `scope`. Leave
  DCR off: Claude.ai and Claude Code use CIMD.
- CIMD: turn on **Publish CIMD support** under OAuth applications → Settings →
  Client onboarding.
  Then check that `/.well-known/oauth-authorization-server` on the Clerk issuer
  shows `client_id_metadata_document_supported: true` and lists `none` in
  `token_endpoint_auth_methods_supported`. Claude uses CIMD only when both are
  there. Clerk turns CIMD on by itself only for the first MCP server on an
  instance: through `configure_mcp_server`, or in the Dashboard when you select
  **Allow public clients to connect**. For any later server, check the setting
  yourself.
- MCP resource for the endpoint URL (Clerk MCP `configure_mcp_server`, or the
  Dashboard).
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
4. Connect Claude.ai separately and ask the same question. Expect the same
   result. Claude.ai uses its own client and Anthropic's servers, so Claude
   Code working does not prove it.

## Troubleshooting

- **`401 invalid_token`:** the token's `aud` is not this endpoint. Check the
  Clerk MCP resource and that the client sent `resource`.
- **`403 insufficient_scope`:** the token has neither Foundry scope. Clerk
  grants a CIMD client only the scopes saved on it, so check that client under
  OAuth applications and give it both Foundry scopes, then reconnect.
  `default_scopes` matter only for a client that omits `scope`, which this
  endpoint's `401` always sends.
- **Claude.ai: "Authorization with Foundry failed":** tail the Worker
  (`pnpm exec wrangler tail foundry`) while connecting. Claude.ai calls from
  Anthropic's range `160.79.104.0/21`. If the tail shows a `401` and a metadata
  fetch, but no later request with a token, the OAuth flow did not complete.
  Read the `error` on the `claude.ai/api/mcp/auth_callback` URL in browser
  history.
- **Claude.ai fails before sign-in, and Clerk's metadata lacks
  `client_id_metadata_document_supported: true` or the `none` auth method:**
  Claude cannot use CIMD and DCR is off, so it cannot register. A missing flag
  means Publish CIMD support is off; turn it on. Clerk's docs name no setting
  for `none` alone, so if only `none` is missing, ask Clerk support.
- **`invalid_scope` ("not allowed to request scope …"):** Clerk saved that CIMD
  client before the scopes existed. Delete it under OAuth applications so the
  next connect recreates it, or set its scopes to `openid profile email
  foundry:read foundry:write offline_access`. Claude also asks for
  `offline_access`.
- **Cloudflare Error 1000 on `accounts.appelent.nl`:** the record is proxied;
  set it to DNS only.
- **Tools fail with "Not authenticated":** Convex does not trust the token.
  Check `MCP_RESOURCE_URLS` on that deployment matches the endpoint exactly.
