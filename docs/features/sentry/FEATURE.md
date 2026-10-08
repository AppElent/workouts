---
version: 1.0.1
description: Configure Sentry across browser, Expo, Workers, and Convex with private build credentials and verified environment boundaries.
---

# Sentry

Use this guide when adding or reviewing error reporting, performance tracing, replay, feedback, or source-map uploads. First inventory the app's existing SDK initialization, error boundaries, environment manifest, deployment workflows, and Sentry project. Extend those owners; avoid initializing a second client or wrapping the same handler twice. Shared guidance is toolkit-owned; application instrumentation and operational scripts remain app-owned.

Consult the installed SDK types and current [Sentry platform documentation](https://docs.sentry.io/platforms/) before choosing options. SDK generations differ in privacy, tracing, logging, and build-plugin APIs. Preserve the app's dependency policy and deliberate provider choices. Do not copy an organization, project, DSN, release name, or sample rate from another app.

## Coverage and ownership

| Surface | Application wiring | Coverage limit |
| --- | --- | --- |
| Browser | Initialize before hydration; connect React/route errors and the router's supported tracing integration | Only code executed by that browser |
| Expo native | Initialize once, wrap the root, connect navigation, and configure native build integration | Native crashes/profiling/replay require a compatible built binary and device verification |
| Cloudflare SSR | Instrument the actual Worker fetch entry using the installed SDK's supported wrapper or build integration | A framework may swallow the original exception and return a 500 |
| Convex | Choose managed exception reporting or an independently hosted log forwarder | Client capture alone cannot observe unattended backend failures |

Use stable surface tags such as `app=product-web`, `product-mobile`, `product-web-server`, and `product-convex`. Decide whether surfaces share a Sentry project and document the choice in the app's runbook. Clear the opaque authenticated user ID on sign-out; attach no email/name by default.

Capture actionable caught failures at one common boundary. For example, instrument Convex client mutation/action calls, preserve the original error and stack, and rethrow so existing UI error handling still runs. Do not capture function arguments/results. Deduplicate repeated capture of the same error; document that independent client/server events may still describe one failure. Query subscription failures need their own verified boundary. Do not propagate trace headers to third parties without an intentional, supported integration.

## Environments and local previews

Choose environment names from deployment identity, not JavaScript build optimization. A production bundle can run on localhost. Wrangler can also supply production bindings during local preview, so `environment_name=production` alone does not prove a request is deployed.

Default to disabling local delivery. Check the actual browser URL before initialization and the server request URL before entering the Sentry wrapper. Parse the URL and compare its hostname; never search the entire URL for the word localhost. Cover `localhost`, `.localhost`, IPv4 loopback, IPv6 loopback, and the local wildcard address used by preview tooling. A small app-owned helper can be shared:

```ts
export function isLocalReportingUrl(url: string): boolean {
  const host = new URL(url).hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") ||
    host === "[::1]" || host === "0.0.0.0" ||
    /^127\.\d+\.\d+\.\d+$/.test(host);
}
```

For Workers, dispatch local requests directly to the application handler; dispatch deployed requests through the instrumented handler with its environment and execution context. Keep request state isolated. Browser delivery should also require that development mode is off and the URL is not local. If an app deliberately enables local capture, use an explicit development environment and test that path. Configure LAN addresses, tunnels, and custom local domains separately when used; this helper cannot identify every development host.

Add a regression test for a localhost SSR 500 with production bindings: the app response is preserved and the Sentry wrapper is never entered. Verify a deployed request still enters the wrapper. Existing events retain their original environment labels after the code is fixed.

## Credentials and source maps

| Value | Purpose | Destination |
| --- | --- | --- |
| DSN | Sends events to the selected project | Public browser/native config or server runtime |
| `SENTRY_AUTH_TOKEN` | Authorizes build artifact uploads | Private local tooling, CI, and EAS build/upload processes |
| Organization/project | Selects the upload target | Build configuration aligned with the DSN |
| Release/dist or debug IDs | Associates artifacts with emitted events | Matching build and runtime metadata for the selected upload mechanism |

Reuse an existing valid token with appropriate upload permissions. A DSN does not authorize uploads. The token must never land in `VITE_*`, `EXPO_PUBLIC_*`, a bundle, runtime event data, or tracked dotenv files.

Follow [environment routing](../environments/FEATURE.md). The manifest declares where values land; the secret store holds the value. An existing source key such as `sentry-auth-token` is sufficient when its routing, destination sync, permissions, and upload target are correct. Plans and name-only checks prove neither token validity nor a successful upload.

Verify how each command loads credentials. Writing `SENTRY_AUTH_TOKEN` to `.env.local` does not automatically populate `process.env` in a Vite config or a standalone Node script. Load the intended file through a supported mechanism or supply the variable to the process, preserving shell/CI overrides. Avoid broad dotenv loading that could copy unrelated secrets into public configuration. Never print tokens while diagnosing presence.

Generate hidden web source maps, upload the actual client and server outputs using the supported plugin, then remove public client maps before deployment/service-worker precaching. Verify the final artifact has no public maps, including maps generated by a later build step. Native releases also need the relevant native debug symbols. Expo OTA updates need maps for the exact exported update; confirm credentials before publishing, preserve channel/environment selection, and fail visibly on upload errors. If publishing succeeds and upload fails, retry uploads for that same artifact instead of silently publishing another update. Refer to the current [Expo/Sentry guide](https://docs.expo.dev/guides/using-sentry/).

## Convex reporting

Convex's [managed exception reporting](https://docs.convex.dev/production/integrations/exception-reporting) currently requires Pro and is configured per deployment in Dashboard → Settings → Integrations with a DSN. Do not treat browser instrumentation as enabling that integration. Check plan availability and emitted environment/user tags against the app's policy before enabling it; managed reporting has different customization limits from an application SDK.

On a free plan, client reporting can capture backend failures returned to active users. Scheduled jobs and other unattended failures need an always-on forwarder or another supported backend reporting path. If hosting is deferred, leave the forwarder ready to deploy and state that unattended coverage is inactive.

A log-forwarder implementation should select one deployment explicitly, read structured Convex execution logs using the installed CLI's verified format, and forward failed completion records only. Allowlist function/type, deployment, timestamp, request/execution identifiers, and sanitized stack/message. Exclude console payloads, arguments, return values, and identity. Use stable event IDs, bounded deduplication, reader restart/backoff, bounded buffering, shutdown flush, and private deployment credentials. Document downtime/history gaps and whether delivery has a durable spool; an in-memory reader is best effort. Disable one backend reporting path when migrating to another to prevent duplicate ingestion. Source-map upload credentials are not required merely to send events.

## Privacy, sampling, and acceptance

Disable automatic PII collection using the installed SDK's supported options. Redact request query strings, bodies, headers, cookies, stack locals, arbitrary extras, credentials, and sensitive text before delivery. Review URL path segments too. Avoid ingesting raw console output. Replay must mask text/inputs and block media by default; screenshots/view hierarchy require deliberate review. Inspect a received event for IP/geolocation and ingestion-side enrichment rather than assuming a client option removes everything.

Choose tracing, profiling, replay, and error sampling deliberately and document expected cost. Native profiling/replay support depends on the SDK, platform, and binary. Keep explicit logs structural and sanitized. Configure alerts and retention separately; installing an SDK does not establish an operational response.

Verify before claiming completion:

- Run relevant lint/typechecks and focused tests for privacy, duplicate capture, local suppression, and deployed wrapper dispatch.
- Build web and mobile artifacts; verify initialization order and absence of public secrets/maps.
- In an authorized test environment, send a controlled error per enabled surface and inspect environment, release, surface tag, user policy, original stack, and redaction.
- Confirm an uploaded map actually resolves a generated stack; an upload command alone does not prove symbolication.
- Test a compatible native binary on a device and test an OTA update separately when supported.
- For backend coverage, verify the chosen managed integration or hosted forwarder with an unattended failure. Record inactive coverage explicitly.

## Feedback, screenshots, and replay testing

Feedback can carry device/build/user context, breadcrumbs, a linked error, and a replay when one exists. Attach a sanitized route or screen name explicitly if support needs to know where the form opened. A sampled or unavailable replay cannot guarantee that context. Keep user-entered feedback separate from automatic telemetry redaction; verify which fields survive the event hooks.

Screenshot attachments to feedback are a separate capability from automatic error screenshots and session replay. Enable the installed widget's supported screenshot controls deliberately, let users preview/remove the image, and verify that attachment delivery works. Text/image masking in replay does not automatically redact a standalone screenshot. Avoid collecting an unreviewed screenshot of sensitive app content.

Native apps can detect a screenshot while foregrounded using [Expo ScreenCapture](https://docs.expo.dev/versions/latest/sdk/screen-capture/), subject to platform/version support. A notification is not the screenshot image. Record a structural breadcrumb with the screen name or offer a feedback action; upload an image only through the chosen attachment flow. iOS and Android 14+ support detection without photo-library permission; older Android versions have additional permission constraints. Browsers have no reliable general OS-screenshot notification. Verify against the app's Expo SDK and rebuild when introducing a native dependency.

For a deterministic replay acceptance test, use a dedicated deployed preview or native release-test build, temporarily sample all test sessions or start replay explicitly through the supported SDK API, navigate through a short flow, and send a controlled test error. Inspect the linked replay and its masking in Sentry, then restore normal sampling. Local delivery guards and native development-mode disabling must remain intact. A feedback submission alone should not be assumed to force an unsampled replay to upload.

## Existing-project migration

Inventory duplicate initializers and capture sites before replacing them. Preserve the app's project/DSN, secret source keys, manifest ownership, deployment/channel names, and UI error behavior. Add the local-preview guard to both browser and server paths, align artifact/runtime metadata, and reconcile existing privacy/sampling policies. Rebuild/restart previews so old artifacts stop reporting. Syncing this guide does not migrate application code, provision a forwarder, publish a release, or prove live reporting.
