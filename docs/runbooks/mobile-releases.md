# iOS test builds and OTA updates

For error reporting configuration, see
[mobile Sentry](sentry.md). New builds need the Sentry environment
values there; OTA updates also need their source maps uploaded.

Run these commands from `apps/mobile`. Use the `preview` profile for a
standalone TestFlight app. It uses the EAS `preview` environment and update
channel. The `development` profile is a Metro development client; it does not
provide the same automatic update flow.

The EAS profile name does not determine the backend environment. As verified
on 2026-09-29, `preview` points to the live Convex deployment `fine-akita-444`,
also used by the production web app. Check the target before deploying backend
changes. This release requires the completed
[exercise-history migration](exercise-migration.md) before client distribution.

## Build and install

From macOS (zsh), in `apps/mobile`:

```sh
EXPO_NO_DOTENV=1 pnpm exec eas build --platform ios --profile preview --clear-cache --auto-submit
```

The environment setting prevents local `.env.local` values from entering the
release configuration. EAS supplies `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and
`EXPO_PUBLIC_CONVEX_URL` from its `preview` environment. Its `NODE_AUTH_TOKEN`
secret lets the build pre-install hook authenticate to GitHub Packages.

The first submission may ask for Apple credentials and the App Store Connect
app. After Apple processes the build, install it through TestFlight. Native
compilation, signing, and submission are verified by that cloud build; local
TypeScript checks and bundle exports cannot verify them.

## Local iOS development on macOS

Use Xcode with an installed iOS simulator runtime and CocoaPods. Run from
`apps/mobile` with the development values in `.env.local`:

Clerk enables Sign in with Apple, so Expo's local build command requires a
development signing identity even when selecting a simulator. Add your Apple
Developer account under Xcode → Settings → Accounts and create an Apple
Development certificate through Manage Certificates before the first run.

```sh
SENTRY_DISABLE_AUTO_UPLOAD=true pnpm devbuild:ios --device
```

This compiles and installs the development client and starts Metro. JavaScript
changes then use Fast Refresh. If another checkout already uses port 8081,
append `--port 8084` (or another free port).

After native dependency or config-plugin changes, regenerate the ignored iOS
project first. Preserve any manual native changes before using `--clean`:

```sh
pnpm exec expo prebuild --platform ios --clean
```

Expo Device Hub is the standard local simulator/emulator dashboard. Start Metro
with `pnpm start:dev-client` from `apps/mobile`, then open the Device Hub URL
printed in the terminal (`http://localhost:<port>/_expo/plugins/expo-device-hub`).
It registers automatically and uses Metro's selected port. Use host device tools when available, or this dashboard to
view and control local devices; Android requires the Android SDK's `emulator`
and `adb`. The workspace explicitly allows `node-datachannel`'s native install
script for Android streaming. Application device acceptance still follows the
[verification workflow](verification.md).

Keep durable native settings in `app.json` and config plugins; `ios/` and
`android/` remain generated and ignored. Disabling Sentry uploads is only for
local development without upload credentials; EAS preview builds use their
configured `SENTRY_AUTH_TOKEN` and upload source maps normally.

Use EAS cloud builds for the TestFlight flow above. Local `eas build --local`
is optional and additionally needs Fastlane and locally supplied EAS secrets;
it is not required for simulator development.

## Publish subsequent OTA updates

From `apps/mobile`, with the local Sentry upload token configured:

```sh
EXPO_NO_DOTENV=1 pnpm preview:ios:update --message "Describe the changes"
```

Publish JavaScript and asset changes this way after validation. The app checks
for updates on launch, downloads a compatible update in the background, and
uses it on a subsequent launch. To test delivery, open the app with a network
connection, allow the download to finish, then fully close and reopen it.
An already-running workout is not forcibly reloaded.

`app.json` uses the `fingerprint` runtime policy. Native dependencies, Expo SDK
upgrades, and native configuration changes can change the runtime fingerprint
and require a new TestFlight build. An OTA update cannot add native modules or
permissions to an existing binary. Publish from the same dependency lockfile
and EAS environment as the target build. Backend changes must be deployed to
the matching Convex environment separately.

Keep `virtualStoreDirMaxLength: 60` in the root `pnpm-workspace.yaml`. Expo's
fingerprint includes dependency paths from native autolinking. pnpm otherwise
uses different directory lengths on Windows (60) and EAS macOS (120), causing
the build to fail with a local/EAS runtime-version mismatch even when every
package version matches. After changing pnpm layout settings, run
`pnpm install --frozen-lockfile` at the repository root before building or
publishing updates. Keep the fingerprint policy enabled.

## Local preflight

Run the applicable [project checks](verification.md), then Expo dependency
validation and a preview-environment bundle export from `apps/mobile`:

```sh
pnpm dlx expo-doctor
EXPO_NO_DOTENV=1 pnpm exec eas env:exec preview 'pnpm exec expo export --platform ios --output-dir dist/ios-preflight' --non-interactive
```

Check the native runtime against the intended binary using the shared
[mobile release boundaries](../features/mobile-baseline/FEATURE.md#build-and-release-boundaries).
