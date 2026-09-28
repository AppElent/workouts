# Mobile Sentry

The mobile app uses `@sentry/react-native` for JavaScript/native errors and
shake-to-report. Shaking opens Sentry's feedback form; submitting creates an
item in the project's **User Feedback** section. No prior crash is required.
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
collection is disabled; users may voluntarily enter contact details in the
feedback form.

## Build and verify

This adds a native dependency: install a **new native build**, following
[mobile releases](mobile-releases.md). An OTA update to an older binary cannot
add shake detection. Verify on a standalone preview/TestFlight build rather
than Expo Go or the development client's competing shake menu.

1. Open the app and shake the phone. Confirm that the feedback form opens.
2. Cancel once and confirm the current screen/workout remains intact.
3. Shake again, enter a recognizable test report, and submit it.
4. Confirm the report arrives in Sentry's User Feedback section with the
   expected environment and release. Delete the test report when finished.
5. Verify error reporting separately with a temporary
   `Sentry.captureException(new Error("Mobile Sentry verification"))` in a
   local test build; confirm its stack is symbolicated and remove the test code.

Native builds upload symbols/source maps through the Expo plugin. After an
EAS Update, upload that update's exported maps from `apps/mobile` with
`pnpm exec sentry-expo-upload-sourcemaps dist` using the same Sentry build
credentials. If overriding the DSN, use the same override for the build and update.

Sentry is pinned to 8.28.0 because built-in shake-to-report requires 8.5.0+;
Expo SDK 57's suggested 7.11.x does not include it. Do not let
`expo install --fix` downgrade this dependency. The version recommendation
may appear in Expo's dependency checks; it is not suppressed.

References: [Sentry Expo setup](https://docs.sentry.io/platforms/react-native/guides/expo/)
and [user feedback](https://docs.sentry.io/platforms/react-native/user-feedback/).
