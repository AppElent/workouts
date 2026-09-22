# Android SQLite lifecycle regression

The emulator intermittently rejected `NativeDatabase.prepareSync` with
`java.lang.NullPointerException` after development refresh, while reading library
settings. Restarting Expo Go recovered the app.

An isolated native check reproduced the same exception without any application
tables or network requests. Two default Expo SQLite opens of `:memory:` create
distinct JS wrappers. Explicitly releasing the first wrapper invalidated the
second wrapper's native handle. Before release, `SELECT 42 AS answer` succeeded;
after release, it threw the exception above.

Repeating the check with `{ useNewConnection: true }` passed. Repeating it using
the actual `openNutritionDatabase` helper also passed:

```text
Same JS native handle: false
Before release: {"answer":42}
After release: {"answer":42}
```

[Captured result](android-sqlite-lifecycle-pass.png). The temporary probe route
was removed before the final typecheck, tests and iOS export. It never accessed
the diary, library or preference databases.

All Nutrition repository factories now use the helper, giving each repository
an independent connection while preserving its existing database file and data.
The legacy Recipe migration already requested an independent connection and now
uses the same helper.

The installed SDK 57 Android implementation caches native databases but closes
the binding in `sharedObjectDidRelease`. This matches the mechanism described in
[Expo issue #48999](https://github.com/expo/expo/issues/48999).
[Expo documents the connection option](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#sqliteopenoptions).
The local experiment demonstrates the release failure and the workaround; it
does not establish the exact GC timing of every earlier refresh failure.

## Native regression seam

Run this body from a temporary button in the Android app. For the failing
comparison, use `openDatabaseSync` from `expo-sqlite` with no options for the two
opens. Restart Expo Go between failing comparisons because the default cache
can retain the invalid handle. Never run the release experiment on a real data
file.

```tsx
const first = openNutritionDatabase(":memory:");
const second = openNutritionDatabase(":memory:");
const before = second.getFirstSync<{ answer: number }>("SELECT 42 AS answer");
(first.nativeDatabase as unknown as { release(): void }).release();
const after = second.getFirstSync<{ answer: number }>("SELECT 42 AS answer");
if (before?.answer !== 42 || after?.answer !== 42) {
  throw new Error("SQLite connection invalidated by another wrapper's release");
}
second.closeSync();
```

This deliberately invokes native release rather than waiting for GC. A mocked
Jest assertion about open options would not exercise the failing native seam.

The [device reload check](check-android-reload.ps1) verifies the original app path:
it reloads only emulator-5556 through Expo Go's menu, waits for app content, then
opens Nutrition and requires the diary to render. It dismisses the known Clerk
development-key warning, but fails on a native database/render error or timeout.
It does not reload another connected device or modify diary entries.

```powershell
& docs/prototypes/nutrition/check-android-reload.ps1 -Iterations 10
```

Result: **10/10 consecutive reloads passed**, each followed by a visible Nutrition
diary. The final mobile run also passed all 57 suites / 391 tests, TypeScript,
Biome (232 files), and the iOS JS/Hermes export. A clean run is finite regression
evidence, not a guarantee against every native runtime teardown problem.
