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
