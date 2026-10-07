# Mobile Sentry

The mobile app uses `@sentry/react-native` 8.28.0 with Expo SDK 57 for
JavaScript and native errors, following Sentry's Expo integration guide.
Shaking the device opens Sentry's feedback form through
`feedbackIntegration({ enableShakeToReport: true })` and `Sentry.wrap`.
It also enables navigation/app-start/network tracing, frame/stall measurements,
Hermes/native profiling, masked session replay, and structured failure logs.
The web app and Convex server runtime are outside this mobile integration.

## Coverage and sampling

Release bundles report errors at the SDK default rate (100%). Local development
bundles disable event delivery, including feedback delivery; test with a release
preview build. Expo Go has no native replay, profiling, or frame tracking.

| Signal | Sampling |
| --- | --- |
| Transactions | 20% on the production channel, 100% on other release channels |
| Profiles | 25% of sampled native transactions |
| Replay | 5% of native sessions, 100% of sessions with a reported error |
| Structured logs | Explicit operation-failure logs only; no console/native log ingestion |

`expoRouterIntegration` registers navigation automatically with templated route
names and time-to-initial-display measurements. The SDK's default Expo Updates
integration attaches update ID, channel, runtime version, lifecycle breadcrumbs,
and emergency-launch warnings. Native release/version/build attribution remains
SDK-managed so source-map and debug-symbol matching stays consistent.

The shared Convex client traces mutations/actions and reports rejected calls
even when screens catch them for a toast. It rethrows the original error and
does not attach arguments or results. Route fallbacks report render/query errors.
Reporting deduplicates the same Error instance across these boundaries.
Other caught failures can use `src/observability/errors.ts`'s `reportError` with
a fixed operation name. Real-time query subscription latency is not measured as
an HTTP request; this does not instrument execution inside Convex.

Clerk supplies only its opaque account ID, cleared on sign-out/unmount. Default
PII stays disabled. Replay masks all text, images, and vectors. Screenshots and
view hierarchy attachments are disabled. JavaScript event hooks remove request
bodies, headers, query strings, extras, and stack-frame locals; redact common
credentials and email addresses; and discard console breadcrumbs. Do not add
workout/nutrition payloads to messages, tags, logs, or custom contexts. User
feedback remains explicitly user-submitted content.

## Configuration

The app defaults to Foundry’s public DSN (organization `appelent`, project `foundry`, ID
`4512164168663040`). Configure these values in
the EAS environment used by the build (development, preview, or production):

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional override for a different Sentry project |
| `SENTRY_AUTH_TOKEN` | Secret build token with source-map upload access |

The optional entries in `env.manifest.ts` route `sentry-dsn` and
`sentry-auth-token` from Infisical to EAS. The DSN also
routes to the mobile local environment. For local native builds, set the
build-only values in `apps/mobile/.env.local`; never prefix the auth token
with `EXPO_PUBLIC_` or put it in `app.json`.

The public DSN is safe to commit; upload credentials are not. For a local native build
without upload credentials, set `SENTRY_DISABLE_AUTO_UPLOAD=true` in the build
environment. Configured release builds should upload source maps normally.
The Expo plugin targets `appelent/foundry` for source-map uploads.

Sync from the checkout containing these manifest entries after `pnpm install`:

```sh
pnpm env:plan preview --only eas
pnpm env:apply preview --only eas
```

The environment engine requires the repo's `eas-cli` dev dependency; a global
EAS installation alone is not enough. Use `pnpm exec eas login` if needed.

Sentry's environment follows the EAS Update channel, falling back to
`development` for a dev bundle and `production` otherwise. Default PII
collection is disabled.

## Build and verify

This adds a native dependency: install a **new native build**, following
[mobile releases](mobile-releases.md). An OTA update to an older binary cannot
add native error reporting. Changing the Sentry native SDK version also
requires a new binary. Verify on a standalone preview/TestFlight build
rather than Expo Go.

1. Open the app and verify normal navigation and workout use.
2. Shake the device and verify the feedback form opens and can be dismissed.
   On an iOS simulator, use Device → Shake. Submit a clearly labeled test
   report when checking delivery, then confirm it in Sentry User Feedback.
3. Verify error reporting with a temporary
   `Sentry.captureException(new Error("Mobile Sentry verification"))` in a
   local test build; confirm its stack is symbolicated and remove the test code.

Native builds upload symbols/source maps through the Expo plugin. Publish OTA
updates from `apps/mobile` with `pnpm preview:ios:update`, or
`pnpm update:publish --platform ios --channel production --environment production`.
These commands require a local `SENTRY_AUTH_TOKEN` before publishing and upload
the exported `dist` maps after EAS Update. An EAS secret available only during
native builds does not populate your local shell. If the upload fails after EAS
published successfully, preserve `dist` and retry
`SENTRY_ORG=appelent SENTRY_PROJECT=foundry pnpm exec sentry-expo-upload-sourcemaps dist`;
do not republish just to retry the upload. Direct `eas update` bypasses this guard.
If overriding the DSN, align the Expo plugin's organization/project and local
`SENTRY_ORG`/`SENTRY_PROJECT` with that project, and use the same DSN for build and update.

4. Confirm a navigation transaction and profile appear in Sentry Performance.
   Production sampling means an individual navigation might not be selected.
5. Trigger a caught mutation failure and a route render failure in a test build;
   confirm both arrive with operation/account/release/update context, and that
   the error toast or retry still works. Sign out and confirm later events have
   no account ID.
6. Inspect a replay and event payload: text/images must be masked; credentials,
   request bodies, and nutrition/workout values must not appear. Native controls
   need device verification as well as React Native views.

In the Sentry dashboard, configure production alerts for new/regressed issues,
crash-free sessions, and `expo.updates.emergency_launch:true`. Link the project to
EAS to show issues/replays in its deployment dashboard. These are dashboard
configuration steps, not repository settings.

Expo SDK 57's compatibility list still recommends Sentry 7.11.x. We explicitly
select Sentry 8 for its documented Expo support and built-in shake-to-report
(introduced in 8.5.0). Only `@sentry/react-native` is listed in
`expo.install.exclude`; Expo's other dependency checks remain enabled.
Review this exception when upgrading Expo and validate Sentry changes with
typechecks, tests, a bundle export, and a native build.

Sentry 8 requires iOS 15+ and Xcode 16.4+, which Expo SDK 57's iOS target
and our build environment satisfy. Android requires AGP 7.4+ and Kotlin 1.8+;
keep Expo's generated toolchain defaults. We use hosted Sentry, so the
Sentry CLI 3 minimum server version for self-hosted installations does not apply.

`@sentry/cli` is an explicit mobile development dependency at the version
required by the Sentry SDK (3.8.0). This keeps CLI resolution from the app
directory predictable under pnpm's isolated layout. Sentry 8 also provides a
pnpm fallback in its Xcode upload scripts. Keep the CLI version in sync with
the SDK when upgrading.

References: [Sentry Expo setup](https://docs.sentry.io/platforms/react-native/guides/expo/),
[Sentry 8 migration](https://docs.sentry.io/platforms/react-native/migration/v7-to-v8/),
[user feedback](https://docs.sentry.io/platforms/react-native/user-feedback/), and
[Expo dependency validation](https://docs.expo.dev/more/expo-cli/#configuring-dependency-validation).

## Optional screenshots and reporting

Profile → Report a problem opens the same form as shake-to-report. The form is
localized in English/Dutch, hides name/email fields, and offers an optional image
picker. Native builds also offer Take screenshot: the form hides, the user takes
the app screenshot through Sentry's control, and the form returns with a preview.
The user can remove the image before submitting. Images are user-submitted
content and are not covered by replay masking. The description reminds users to
remove personal information before sending. Automatic error screenshots and
view hierarchies stay disabled; no OS screenshot listener is installed.

The root tracks a `screen` tag from Expo Router's file segments (including dynamic
placeholders rather than actual record IDs). This also provides context for
shake-to-report on the affected screen. Replay remains independently sampled.
Test attachment delivery in a compatible release/test build and inspect the
feedback event in Sentry; local development still disables delivery. Native
feedback capture is fire-and-forget, so its confirmation alone does not prove
server receipt.
