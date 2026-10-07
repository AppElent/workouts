# Sentry operations

Sentry covers the Expo client, React browser client, Cloudflare SSR Worker, and
Convex execution failures. All default to `appelent/foundry`'s existing public
DSN and use an `app` tag to separate `foundry-mobile`, `foundry-web`,
`foundry-web-server`, and `foundry-convex`.

## Clients and SSR

See [mobile Sentry](mobile-sentry.md) for native sampling, source maps, feedback,
and device verification. The browser captures global errors, React hydration
and boundary errors, route errors, and caught Convex mutation/action failures.
TanStack Router instrumentation measures page loads and navigations; mutations
and actions have function-name spans without arguments or results.

The Cloudflare Worker wraps the Start handler with `@sentry/cloudflare` for
request isolation, request traces, thrown exceptions, and response failures.
Handled SSR 5xx responses also produce a generic error event when Start does
not expose the underlying exception. This wrapper cannot recover a stack that
Start has already swallowed. The `nodejs_compat` flag remains required.

Browser and Worker releases use `SENTRY_RELEASE` or the checkout's Git SHA.
Transactions sample at 20% in production and 100% elsewhere. Browser replay
samples 5% of sessions and 100% of error sessions, with text/input masking and
media blocking. Local Vite development and localhost/loopback previews disable delivery, even
when the preview runs a production bundle with production Wrangler bindings. Explicit logger
calls send structured failure logs; default console ingestion is removed.
Browser feedback has no injected widget. Account → Report a problem opens the
app-owned Base UI form with optional PNG/JPEG/WebP upload (up to 5 MB), preview,
and removal. Submission errors preserve the draft. Feedback includes a route
template, and router navigation updates a `screen` tag without record IDs.
Screenshots are explicitly selected content, not automatically masked replay.
Mobile provides the corresponding action in Profile and retains shake-to-report.
Automatic error screenshots and OS screenshot detection remain disabled.

The browser attaches Clerk's opaque ID and clears it on sign-out/unmount. SDK
data collection disables automatic identity, cookies, HTTP headers/bodies/query
parameters, stack locals, database payloads, and AI/GraphQL payloads. Event hooks
also redact common credentials/emails and discard arbitrary extras and console
breadcrumbs. Never put health data or credentials into exception messages,
tags, custom contexts, or logger attributes. Mobile uses its SDK's equivalent
PII and masking controls. Trace headers target only the web app's own origin;
Convex's websocket does not propagate them.

## Build configuration

| Value | Consumer |
| --- | --- |
| `VITE_SENTRY_DSN` | Optional browser + SSR build override |
| `VITE_SENTRY_ENVIRONMENT` | Browser build environment; defaults to Vite mode |
| `SENTRY_DSN` | Optional Worker runtime override |
| Worker `environment_name` | SSR environment, already set by Wrangler/preview CI |
| `SENTRY_AUTH_TOKEN` | Build-only source-map upload token; never public |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Upload target; defaults to `appelent`, `foundry` |
| `SENTRY_RELEASE` | Optional release override, shared by browser/Worker/maps |
| `SENTRY_CONVEX_DSN` | Optional backend log-forwarder project override |
| `SENTRY_ENVIRONMENT` | Log-forwarder environment override |

`env.manifest.ts` routes the public DSN to Vite/Expo, and upload credentials to
local tooling, GitHub preview CI, and EAS. Run `pnpm env:plan`/`env:apply` for the
environment you intend to sync. The production build's shell must have the
upload token; a value in a dotenv file is not automatically a shell export.
CI/preview workflows pass the GitHub `SENTRY_AUTH_TOKEN` secret to the build.
No upload was verified without those credentials.

Vite generates hidden maps for client and server outputs. When an upload token
is present, the Sentry Vite plugin uploads both and tags the release. Upload
failure fails the build. Builds without the token skip uploads. The subsequent
service-worker generation step removes all client maps before deployment;
server maps remain available locally. Use the `pnpm build` scripts, not bare
`vite build`, for deployable assets. Align DSN and upload project overrides.

## Convex on the free plan

Convex's [managed Sentry integration](https://docs.convex.dev/production/integrations/exception-reporting)
requires Pro. This project instead includes a free-plan forwarder using the
installed CLI's `convex logs --jsonl`. It reports failed query/mutation/action/
HTTP-action executions, including unattended scheduled functions. It sends the
original server error stack, function/type, request ID, and selected deployment;
it drops console lines, arguments, return values, and identity data.

Run from the repo root with Convex CLI authentication or a deployment-scoped
`CONVEX_DEPLOY_KEY` available to the process:

```sh
pnpm sentry:convex --prod
pnpm sentry:convex --deployment colorless-sturgeon-704
```

`--prod` labels events `production`; other deployments default to `development`.
Set `SENTRY_ENVIRONMENT=preview` when forwarding a preview deployment. Choose
only one reader per deployment. The Node SDK needs no upload/auth token to send
events. Keep the Convex deployment key secret.

**This process must stay running on an always-on host or supervisor.** It has
not been provisioned as a hosted service by this change. Convex's CLI handles
network reconnection; the wrapper restarts an exited reader and replays its last
100 entries. Stable event IDs and bounded local deduplication prevent repeated
history from becoming new events. This is best-effort: long downtime or high
traffic can exceed retained history, and failed Sentry deliveries have no durable
local queue. Backend performance/distributed tracing and authenticated-user
attribution are not supplied by these logs. Client-side reporting continues
even while the forwarder is down, but cannot capture unattended failures.

If upgrading to Pro later, enable the managed integration per deployment and
stop the corresponding forwarder to avoid duplicate backend reports.

## Acceptance

1. Build with the upload token and confirm browser/Worker maps match the Git
   release. Confirm `dist/client` contains no `.map` files.
2. On a release preview, verify page load/navigation spans, a caught mutation
   failure with its original stack, a React render failure, and an SSR failure.
   Use temporary test code and remove it after verification.
3. Confirm replay masking and inspect event payloads for forbidden data. Check
   sign-out clears the browser/mobile user ID.
4. Run the backend forwarder against a development deployment. Trigger a
   temporary failing internal scheduled function and confirm its server stack
   and function/request/deployment tags arrive. Client-triggered errors can
   appear once for the client and once for the server, under different `app` tags.
5. Configure Sentry production alerts for new/regressed errors, crash-free
   mobile sessions, and Expo emergency launches. Configure host monitoring for
   the backend forwarder; its absence is a coverage gap, not a healthy backend.

Repository checks cover redaction, error rethrowing/deduplication, and log
selection/identity. Live symbolication, native replay/profiling, Sentry dashboard
alerts, and hosted backend forwarding still require deployment verification.
