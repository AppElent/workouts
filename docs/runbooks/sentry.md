# Workouts Sentry operations

Apply the shared [Sentry feature](../features/sentry/FEATURE.md) for instrumentation,
privacy, local suppression, artifacts, feedback, and per-surface acceptance.

## Project bindings

All surfaces target `appelent/foundry` (project ID `4512164168663040`) by default.
The `app` tags are `foundry-mobile`, `foundry-web`, `foundry-web-server`, and
`foundry-convex`. This shared project groups the product's web/native/backend failures.
`env.manifest.ts` owns variables and destinations; [environment routing](environment.md)
owns Infisical/EAS/CI setup. Installed SDK versions live in package/lockfiles.

| Surface | Selected behavior |
| --- | --- |
| Browser/Worker | Navigation/request traces; React/route and caught Convex failures; Worker SSR 5xx fallback. Git SHA or SENTRY_RELEASE aligns web/Worker/maps. |
| Mobile | Navigation/app-start/network traces, frame/stall measurements, Hermes/native profiling, masked replay, shake-to-report. Sentry environment follows EAS Update channel, with development/production fallback. |
| Convex | Free-plan log forwarder for failed executions, including scheduled functions; hosting is still outstanding. |

| Signal | Workouts sampling |
| --- | --- |
| Errors | SDK default, 100% |
| Transactions | 20% production; 100% other release environments |
| Mobile profiles | 25% of sampled transactions |
| Replay | 5% sessions; 100% error sessions |
| Logs | Explicit structural failure logs; no console ingestion |

Local browser/Worker previews and native development bundles disable delivery.
Clerk supplies only the opaque account ID, cleared on sign-out/unmount. Workout
and nutrition values stay out of telemetry. Apply shared redaction/masking rules.

Web Account and mobile Profile expose Report a problem. Mobile also uses shake.
Feedback is English/Dutch with no name/email fields and optional user-selected
images; native Take screenshot uses Sentry's hide/capture/preview flow. Route/screen
context uses templates without record IDs. Automatic error screenshots, view
hierarchies, and OS screenshot listeners remain disabled. Feedback confirmation
does not prove delivery; attachments are separate from replay masking.

## Build and upload

The manifest routes `sentry-dsn` and `sentry-auth-token`; EAS and GitHub builds use
the private upload token. The Expo plugin targets `appelent/foundry`. Before a
provider apply, inspect `pnpm env:plan preview --only eas`; apply through the
existing environment workflow. Its EAS integration needs the repo-local eas-cli.

Use `pnpm build` for deployable web artifacts: hidden client/server maps upload
when the token is supplied, upload failure fails the build, and the subsequent
service-worker step removes public client maps. A build without a token skips
uploads; it does not verify symbolication. Worker maps remain local.

For local native development without upload credentials, set
`SENTRY_DISABLE_AUTO_UPLOAD=true`. Release builds follow [mobile releases](mobile-releases.md).
For OTA, run from `apps/mobile`:

```sh
pnpm preview:ios:update
# Production only when publishing to production is intended:
pnpm update:publish --platform ios --channel production --environment production
```

The wrappers require the local upload token before publishing and upload the
exported `dist` afterward. EAS build secrets do not populate the local shell.
After a successful publish but failed upload, retain that artifact and retry:

```sh
SENTRY_ORG=appelent SENTRY_PROJECT=foundry pnpm exec sentry-expo-upload-sourcemaps dist
```

Direct `eas update` bypasses the guard. Align plugin/build/runtime targets when
overriding the DSN. Native dependency changes require a compatible new binary.

## Convex forwarder

From the root, with CLI authentication or a private deployment-scoped key:

```sh
pnpm sentry:convex --prod
pnpm sentry:convex --deployment <verified-development-deployment>
```

Select only one reader per deployment. `--prod` labels production; set
`SENTRY_ENVIRONMENT=preview` for previews. This process needs an always-on host
or supervisor, which has not been provisioned. It restarts the reader, replays
100 entries, and deduplicates stable event IDs. Long downtime/high volume can
exceed history; delivery has no durable queue. It supplies neither backend
performance/distributed traces nor authenticated-user attribution.

If adopting managed Convex reporting, stop the corresponding reader to avoid
duplicate ingestion. Verify plan support and per-deployment behavior using the
shared guide before migration.

## Mobile compatibility

Workouts deliberately selects Sentry 8 for Expo support and shake-to-report.
Only `@sentry/react-native` is excluded from Expo's dependency recommendation
check. Reassess this exception during SDK upgrades; retain types/tests/export
and native-build checks. `@sentry/cli` is an explicit mobile dev dependency for
predictable pnpm resolution; keep it compatible with the installed SDK.

## Outstanding acceptance

Repository tests cover redaction, rethrow/deduplication, and log selection.
Live browser/Worker/native symbolication, native replay/profiling, feedback image
delivery, dashboard alerts, and hosted backend forwarding still need deployment
verification. Apply the shared acceptance procedure to each enabled surface.
Check new/regressed issue and crash-free-session alerts, plus Expo emergency-launch
alerts. Test a scheduled backend failure after hosting the forwarder; absence of
that process is an unattended-coverage gap.
