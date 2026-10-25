---
type: runbook
description: Read when building a development client, shipping to TestFlight, or publishing an OTA update.
version: 1.2.0
---

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

## Install variants

Each EAS profile builds its own app, so all three install side by side on one
device. `app.config.ts` picks the identity from `APP_VARIANT`, which
`eas.json` sets per profile:

| Variant | Profiles | Bundle ID / package | Home screen | Scheme | Distribution |
|---|---|---|---|---|---|
| Production | `production` | `com.appelent.foundry` | Foundry | `foundry` | App Store |
| Preview | `preview`, `preview-internal` | `com.appelent.foundry.preview` | Foundry Preview | `foundry-preview` | TestFlight (own ASC app) |
| Development | `development` | `com.appelent.foundry.dev` | Foundry Dev | `foundry-dev` | Internal dev client |

An unset `APP_VARIANT` means development, so local `expo run` builds never
replace the App Store install. Preview and development icons carry a coloured
PREVIEW / DEV band. `pnpm update:publish` derives `APP_VARIANT` from
`--channel`; a raw `eas update` must set it explicitly, or the update carries
the development scheme and bundle ID.

Each bundle ID needs its own App ID (with Sign in with Apple, grouped under
`com.appelent.foundry`) and Clerk registration: see
[social sign-in](social-sign-in.md#install-variants). Account deletion revokes
the Apple grant against the bundle ID of the build that asks.

## Build and install

From macOS (zsh), in `apps/mobile`:

```sh
EXPO_NO_DOTENV=1 pnpm exec eas build --platform ios --profile preview --clear-cache --auto-submit
```

The environment setting prevents local `.env.local` values from entering the
release configuration. EAS supplies `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and
`EXPO_PUBLIC_CONVEX_URL` from its `preview` environment.

The first submission may ask for Apple credentials and the App Store Connect
app. After Apple processes the build, install it through TestFlight.
`eas submission:view` does not reliably report whether the upload arrived. Check
App Store Connect instead with `asc builds list --app 6811609419 --limit 1`.
Allow about 30 minutes before re-submitting. Apple rejects a second upload of
the same build number, so an early retry fails as a duplicate. Native
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

Prebuild rewrites `apps/mobile/package.json` (the `ios`/`android` scripts and
its indentation). Restore it with `git checkout -- package.json`.

Expo Device Hub is the standard local simulator/emulator dashboard. Start Metro
with `pnpm start:dev-client` from `apps/mobile`, then open the Device Hub URL
printed in the terminal (`http://localhost:<port>/_expo/plugins/expo-device-hub`).
It registers automatically and uses Metro's selected port. Use host device tools when available, or this dashboard to
view and control local devices; Android requires the Android SDK's `emulator`
and `adb`. The workspace explicitly allows `node-datachannel`'s native install
script for Android streaming. Application device acceptance still follows the
[verification workflow](verification.md).

Keep durable native settings in `app.json`, `app.config.ts` (per-variant
identity) and config plugins; `ios/` and
`android/` remain generated and ignored. Disabling Sentry uploads is only for
local development without upload credentials; EAS preview builds use their
configured `SENTRY_AUTH_TOKEN` and upload source maps normally.

Use EAS cloud builds for the TestFlight flow above. Local `eas build --local`
is optional and additionally needs Fastlane and locally supplied EAS secrets;
it is not required for simulator development.

## CI builds

`.github/workflows/mobile-build.yml` runs `eas build --local` on GitHub-hosted
runners (`macos-26` for iOS, Ubuntu for Android). This spends no EAS Build
credits. The repository is public, so runner minutes are free too.

| Trigger | Builds |
|---|---|
| PR label `build:ios` | iOS `development` profile when labelled, then on every push |
| PR label `build:android` | Android `development` profile (APK), same rules |
| Actions → Mobile Build → Run workflow | Chosen platform, branch and profile (`development` or `preview-internal`) |

Remove the label to stop rebuilding. Forked PRs never build. The `.ipa` or
`.apk` is a workflow artifact for 14 days, linked from the run summary. Nothing
is submitted to a store; TestFlight stays on the cloud flow above.

The `EXPO_TOKEN` repository secret authenticates with EAS. It is needed for the
project, the profile's EAS environment variables and managed credentials. The
runner cannot answer signing prompts, so the iOS ad hoc credentials for the
profile's bundle ID must already exist on EAS, with your device registered
(`pnpm devbuild:ios:eas` once, or `eas credentials`). Install the unzipped
`.ipa` with `xcrun devicectl device install app --device <id> <file>.ipa` or
Apple Configurator. EAS variables with Secret visibility do not reach local
builds, and Sentry source-map upload is disabled in CI.

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

`app.json` uses the `fingerprint` runtime policy. Variants have different
native identities, so each gets its own fingerprint and needs its own build. Native dependencies, Expo SDK
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
EXPO_NO_DOTENV=1 pnpm exec eas env:exec preview 'APP_VARIANT=preview pnpm exec expo export --platform ios --output-dir dist/ios-preflight' --non-interactive
```

Check the native runtime against the intended binary using the shared
[mobile release boundaries](../standards/mobile-baseline.md#build-and-release-boundaries).
