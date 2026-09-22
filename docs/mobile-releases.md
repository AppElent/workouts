# iOS test builds and OTA updates

Run these commands from `apps/mobile`. Use the `preview` profile for a
standalone TestFlight app. It uses the EAS `preview` environment and update
channel. The `development` profile is a Metro development client; it does not
provide the same automatic update flow.

## Build and install

From PowerShell:

```powershell
Set-Location D:\Dev\workouts\apps\mobile
$env:EXPO_NO_DOTENV = "1"
pnpm exec eas build --platform ios --profile preview --clear-cache --auto-submit
```

The environment setting prevents local `.env.local` values from entering the
release configuration. EAS supplies `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and
`EXPO_PUBLIC_CONVEX_URL` from its `preview` environment. Its `NODE_AUTH_TOKEN`
secret lets the build pre-install hook authenticate to GitHub Packages.

The first submission may ask for Apple credentials and the App Store Connect
app. After Apple processes the build, install it through TestFlight. Native
compilation, signing, and submission are verified by that cloud build; local
TypeScript checks and bundle exports cannot verify them.

The clean cache is intentional for the first rebuild: the previous failed iOS
build used Expo Modules Core 57.0.10 and lacked symbols required by Expo UI.
The current lockfile resolves 57.0.18, whose source includes those symbols.
Subsequent builds can omit `--clear-cache` unless troubleshooting build caches.

## Publish subsequent OTA updates

From the same directory:

```powershell
$env:EXPO_NO_DOTENV = "1"
pnpm exec eas update --platform ios --channel preview --environment preview --message "Describe the changes"
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

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm typecheck
pnpm test
pnpm --filter @workouts/mobile typecheck
pnpm --filter @workouts/mobile test --runInBand
pnpm build
```

Then from `apps/mobile`:

```powershell
$env:EXPO_NO_DOTENV = "1"
pnpm dlx expo-doctor
pnpm exec eas env:exec preview 'pnpm exec expo export --platform ios --output-dir dist/ios-preflight' --non-interactive
```

See Expo's [EAS Update setup](https://docs.expo.dev/eas-update/getting-started/)
and [runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/)
documentation.
