# Mobile Sentry

The mobile app uses `@sentry/react-native` 8.28.0 with Expo SDK 57 for
JavaScript and native errors, following Sentry's Expo integration guide.
Shaking the device opens Sentry's feedback form through
`feedbackIntegration({ enableShakeToReport: true })` and `Sentry.wrap`.
The setup does not enable tracing, profiling, session replay, or log ingestion.

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

Native builds upload symbols/source maps through the Expo plugin. After an
EAS Update, upload that update's exported maps from `apps/mobile` with
`pnpm exec sentry-expo-upload-sourcemaps dist` using the same Sentry build
credentials. If overriding the DSN, use the same override for the build and update.

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
