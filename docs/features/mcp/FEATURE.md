---
version: 1.0.0
description: Implement app-owned MCP tools with explicit transport, authentication, and verification.
---

# MCP server

Choose transport and hosting based on the application. Remote Workers endpoints can use the Cloudflare Agents SDK; local stdio servers use the MCP SDK. There is no AppElent MCP runtime package. Keep domain services and permission checks in the app, with a thin transport adapter.

1. Define each tool's input schema, stable output, and required permissions. Prefer narrow tasks over arbitrary execution primitives.
2. For a remote endpoint, choose request-scoped stateless behavior or explicit durable session state. Do not reuse request-specific mutable state across users. Follow the installed SDK's supported server/handler factory and the current [Cloudflare MCP guide](https://developers.cloudflare.com/agents/model-context-protocol/).
3. In a TanStack/Workers app, mount a dedicated /mcp route or delegate to a separate Worker. Preserve normal app routing, bindings, and error handling. Verify that the handler receives the request, environment, and execution context it expects.
4. For stdio, write protocol data only to stdout and diagnostics to stderr. Document the exact launch command and required environment names.
5. Keep business functions testable independently from MCP transport. Validate every call and resolve identity before accessing user data.

## Authentication

A browser session cookie is not automatically available to a non-browser MCP client. Define how the client obtains and presents credentials, including expiry and scope. Use an appropriate OAuth integration for third-party account access or explicitly configured internal access control. Never treat possession of a tool name as authorization.

For browser-accessible HTTP endpoints, validate Origin against an explicit policy. Protect tool discovery when metadata is sensitive. Deny when identity/scope cannot be resolved, and repeat resource-level permissions inside domain operations. Keep provider errors and secrets out of tool responses.

## Verification and migration

Test domain success, invalid inputs, unauthorized resources, stable results, and failure responses. Protocol tests cover initialize, tools/list, tools/call, unknown tool, invalid arguments, missing/expired credentials, and insufficient scope. Use a reviewed MCP Inspector version for manual connection and exercise each new tool with realistic inputs.

Document endpoint/launch command, client authentication, expected permissions, and limitations. A successful local Inspector call is not proof of production OAuth or cross-user isolation. When migrating from the web plugin, preserve existing app auth and routes and compare current SDK interfaces; remove feature-router dependencies, not working domain checks.
