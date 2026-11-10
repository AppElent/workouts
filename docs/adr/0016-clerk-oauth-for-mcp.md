---
type: decision
description: Read before changing how MCP clients authenticate or which MCP tools may write.
version: 1.0.0
status: accepted
date: 2026-11-10
---

# Authorize MCP clients with Clerk OAuth and a Convex customJwt provider

The Foundry MCP server at `/mcp` uses Clerk as its OAuth 2.1 authorization
server. Clients find Clerk through protected-resource metadata (RFC 9728),
register with DCR or CIMD, and sign the user in with PKCE. Clerk issues JWT
access tokens whose `aud` is the MCP endpoint URL (RFC 8707). The Worker
verifies issuer, audience, and signature locally, then passes the same token to
Convex, which trusts it through a `customJwt` provider per endpoint URL.

This replaces the custom `/mcp/auth` loopback flow. That flow handed out
Convex session JWTs through a redirect only local tools could use, so Claude.ai,
mobile, and ChatGPT could not connect. Standard OAuth works with every MCP
client and lets users see and revoke the grant in Clerk.

Two custom scopes split access: `foundry:read` and `foundry:write`. Tools the
grant does not cover are not listed. Write tools create or update but never
delete, and every create tool takes an idempotency key that Convex enforces, so
agent retries cannot duplicate Sets, Diary Entries, or other records.

A client holding the token can also call Convex directly, so Convex enforces
the boundary too. An OAuth identity (it carries `client_id`) without
`foundry:write` cannot run mutations or actions, and no OAuth identity can reset
or delete the account. A write grant is otherwise trusted with the user's data
like the app is. "No delete tools" shapes the MCP surface; it is not a Convex
rule for single records.

## Considered options

- **Keep the loopback flow:** works only for local clients; rejected.
- **Clerk session tokens or the `convex` JWT template:** short-lived, not bound
  to the MCP resource, and not issued to third-party clients; rejected.
- **Own OAuth server in the Worker:** more code and secrets for no gain over
  Clerk; rejected.
- **Verify with Clerk's API per request:** adds latency and a dependency on
  each call; JWT access tokens are verified locally instead.

## Consequences

- Every Convex deployment must define `MCP_RESOURCE_URLS`, using `none` when it
  serves no MCP endpoint.
- Clerk scopes are created in the Dashboard; other OAuth settings can be
  automated.
- Tokens for other apps on the shared Clerk instance are rejected because their
  audience differs.
