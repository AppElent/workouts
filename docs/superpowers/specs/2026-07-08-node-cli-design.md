# Node CLI Design

## Summary

Add a Node-based command line interface for Workouts. The CLI will live in a root-level `cli/` folder, run locally from this repo first, and be structured so it can become an installable package later.

The CLI will provide a broad CRUD-shaped command surface for auth, configuration, exercises, workout sessions, sets, routines, and WODs. Version 1 will implement commands that map cleanly to the current backend and will return explicit "not implemented yet" messages for planned verbs that need more backend or UX work.

## Goals

- Provide an end-user CLI named `workouts`.
- Keep CLI source isolated under `cli/`.
- Support browser-based login through the web app.
- Support a manual token login fallback.
- Use TanStack Start only for CLI auth brokering.
- Use Convex directly for workout data commands after authentication.
- Preserve current Convex business rules instead of duplicating them in a REST API.
- Support human-readable output by default and script-friendly JSON via a global `--json` flag.

## Non-Goals

- Publishing the CLI as a standalone package in the first implementation.
- Replacing the existing React UI.
- Adding full CRUD backend symmetry for every resource before the CLI is useful.
- Building full browser-auth end-to-end test automation in the first implementation.

## Architecture

The CLI will be a separate TypeScript Node entrypoint inside `cli/`, but still part of the existing pnpm workspace. The root package should expose a local script or bin so development can run commands such as `pnpm workouts ...`.

The CLI has three layers:

1. Command layer: parses command groups, validates CLI flags, and formats output.
2. App auth layer: talks to TanStack Start routes for login, callback exchange, status, and logout.
3. Convex data layer: calls Convex directly with the stored CLI credential.

TanStack Start is the auth broker, not the data API. Convex remains the source of truth for workout data and business rules.

## Authentication Flow

`workouts auth login` starts a browser-based login flow:

1. CLI starts a local callback listener with a one-time state value.
2. CLI opens the app auth URL, such as `/cli/auth/start`, passing the callback URL and state.
3. The web app handles Clerk login in the browser.
4. The app redirects back to the local callback with a short-lived code.
5. The CLI exchanges the code with a TanStack Start auth route.
6. The CLI stores the resulting CLI credential in the user's config directory.

`workouts auth login --token <token>` provides the manual fallback. It stores or exchanges a supplied token without opening the browser.

`workouts auth logout` removes only CLI credentials. It should not sign the user out of their browser session.

## Configuration

CLI configuration is stored in the user's config directory, not in the repo. The config includes:

- app URL for TanStack Start auth routes
- Convex URL for data calls
- current CLI credential

Commands:

```text
workouts config get
workouts config set api-url <url>
workouts config set convex-url <url>
```

## Command Surface

Implemented or planned v1 command groups:

```text
workouts auth login
workouts auth login --token <token>
workouts auth status
workouts auth logout

workouts config get
workouts config set api-url <url>
workouts config set convex-url <url>

workouts exercise list
workouts exercise show <id-or-name>
workouts exercise add --name ... --muscle ... --category ... --equipment ...
workouts exercise remove <id-or-name>

workouts workout list
workouts workout show <id>
workouts workout start [--name ...]
workouts workout finish <id>
workouts workout cancel <id>
workouts workout remove <id>

workouts set list --workout <id>
workouts set add --workout <id> --exercise <id-or-name> --reps ... --weight ... [--unit kg|lbs] [--rpe ...] [--type ...]
workouts set remove <id>

workouts routine list
workouts routine show <id-or-name>

workouts wod list
workouts wod show <id-or-name>
```

Planned commands that are not implemented in v1 should fail with a clear "not implemented yet" message and exit non-zero without a stack trace.

## Data Flow

Read and write commands load CLI config, validate authentication, create a Convex client, and call generated `api.*` function references. Commands should reuse existing Convex queries and mutations where possible.

Name-based lookup is allowed where it improves CLI ergonomics, especially for exercises, routines, and WODs. If a name lookup returns multiple matches, the CLI must show the matching IDs and require a more specific value.

## Output

Human-readable output is the default:

- list commands use concise tables
- show commands use labeled detail output
- mutations print a short success message and the affected ID

A global `--json` flag returns structured JSON for scripting and suppresses decorative formatting.

## Error Handling

Errors should be formatted consistently:

- Missing auth: tell the user to run `workouts auth login`.
- Expired auth: tell the user to re-login.
- Ambiguous lookup: show matching IDs and require a more specific value.
- Convex validation errors: print the useful message without raw backend wrappers.
- Unsupported command: print "not implemented yet" without a stack trace.
- Network failure: identify whether the app auth server or Convex is unreachable.

Unexpected errors may include a stack trace only when a debug flag or environment variable is enabled.

## Testing

The implementation should include focused tests for:

- command parsing and help behavior
- config read/write using temporary directories
- auth-flow state validation and token fallback
- command-to-Convex argument mapping
- name lookup and ambiguous-match handling
- human-readable output and `--json` output
- error formatting

Full browser-auth end-to-end testing is not required for v1. The token path and callback exchange can be tested with mocked HTTP responses.

## Acceptance Criteria

- CLI code lives under root `cli/`.
- The repo exposes a local way to run `workouts`.
- Browser login and token fallback are represented in the auth design and command surface.
- TanStack Start handles CLI auth brokering.
- Data commands call Convex directly after auth.
- Broad command groups exist for auth, config, exercises, workouts, sets, routines, and WODs.
- Unsupported planned commands fail clearly.
- Tests cover the core CLI parsing, config, data mapping, and error formatting behavior.
