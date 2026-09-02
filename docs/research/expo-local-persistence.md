# Local persistence on Expo 57 — what holds personal foods on the device

Research for [#53](https://github.com/AppElent/workouts/issues/53), a child of the Fuel
wayfinder map [#51](https://github.com/AppElent/workouts/issues/51).

**Question.** Personal foods are device-only (#51). `apps/mobile` has no local
persistence at all today. What holds them, and what does that choice cost
downstream in #56 (data placement), #58 (Combos) and #59 (OFF import)?

**Answer, up front.** `expo-sqlite`, with the personal food store as a real table
and `expo-sqlite/kv-store` available for the incidental single values. Runner-up:
`expo-sqlite/kv-store` alone holding one JSON blob. `react-native-mmkv` and
`@react-native-async-storage/async-storage` are both rejected, for different
reasons. The cases against all of these are at the bottom.

---

## The app this lands in

Read off `apps/mobile/` at `origin/main` (`7bd842e`):

| | |
|---|---|
| Expo SDK | `expo` `~57.0.11` |
| React Native | `0.86.2`, React `19.2.3` |
| New Architecture | `newArchEnabled: true` in `app.json` — on, not opt-in |
| Config plugins | `expo-router`, `@clerk/expo`, `expo-secure-store` |
| Storage today | `expo-secure-store` only — Clerk's token store |
| Native dirs | none — no `ios/`, no `android/`; CNG / prebuild-on-demand |
| `eas.json` | **absent** |
| Navigation | `NativeTabs` from `expo-router/unstable-native-tabs` |
| Theme | `userInterfaceStyle: "dark"`, pinned |

Two consequences worth stating before comparing anything:

- **The dev-client barrier is already paid.** `NativeTabs` is native surface, so
  this app cannot run in Expo Go regardless. A new native dependency does not
  cross a line that has not already been crossed.
- **There is no OTA pipeline to break yet.** With no `eas.json`, no `expo-updates`
  and no runtime-version policy, nothing about this decision can currently strand
  an installed build. That is a reprieve, not an exemption — see *Fingerprint*.

### Precedent in the house

`AppElent/gather`'s `apps/mobile` is the same stack (SDK 57, RN 0.86, New Arch) and
already ships `expo-sqlite ~57.0.1`. It uses it through the `kv-store` subpath for
the three preferences the first frame depends on
(`gather/apps/mobile/src/prefs/localPreference.ts`, chosen in gather#140), explicitly
as *"one mechanism, three keys, rather than a persistence library per preference."*
It has no `react-native-mmkv` and no `async-storage`. Different repo, not
authoritative — but it is the only local-persistence decision this house has made,
and it went this way.

### What the house rules say

`toolbox:mobile`'s stack-defaults table (house rule 3) names a default for
framework, auth, backend, package manager, lint, builds and styling — and **names
none for local storage**. `toolbox:mobile-rules` contains no storage rule at all
(grepped: no `mmkv`, no `sqlite`, no `async-storage`, no `persist`). So the house
rules do not prescribe an answer here. What they do prescribe, and what bears on it:

- *"install Expo packages with `npx expo install`, never `pnpm add`, so
  SDK-compatible versions are picked"* — trivially satisfied by an `expo-*`
  package, an extra step for a third-party one.
- House rule 2: **`expo-*` beats `mobile-rules` on *which library*.** The tie-break
  in this codebase's own skill set points at the first-party package when one exists.
- *"If the repo already does something else, follow the repo."* The repo does
  nothing yet, so this is the decision that sets the precedent.

---

## The options

### `expo-sqlite` (~57.0.x)

- **New Architecture:** supported; it is a first-party Expo module shipped in SDK 57
  and the docs record no New-Arch limitation.
- **Config plugin:** *optional.* The plugin exists only to change build flags —
  `enableFTS`, `useSQLCipher`, `useLibSQL`, `withSQLiteVecExtension`,
  `customBuildFlags`. Installing without any `plugins` entry gives the defaults, and
  **`enableFTS` defaults to `true`**, so FTS3/4/5 are compiled in with nothing added
  to `app.json`. ([Expo SQLite docs](https://docs.expo.dev/versions/latest/sdk/sqlite/))
- **Fingerprint:** it is a native module, so it moves the hash. `@expo/fingerprint`
  hashes *"app dependencies, custom native code, native project files, and
  configuration"*, where app dependencies means `node_modules` with native code
  reached through Expo autolinking; config plugins are hashed too.
  ([Expo fingerprint docs](https://docs.expo.dev/versions/latest/sdk/fingerprint/))
  Adding it therefore requires a fresh native build — which, with no `eas.json` and
  no installed builds in the field, costs one `npx expo prebuild` + `expo run:*`
  today and nothing at all in the field.

### `react-native-mmkv`

- **Current major is v4**, rebuilt on **Nitro Modules**. Requires RN 0.76+, requires
  the New Architecture, and requires `react-native-nitro-modules` as a peer
  dependency. Install is `npx expo install react-native-mmkv
  react-native-nitro-modules` followed by `npx expo prebuild`; it is not usable in
  Expo Go. There is no config plugin — the native side arrives through autolinking.
  ([mrousavy/react-native-mmkv](https://github.com/mrousavy/react-native-mmkv))
- **Fingerprint:** two native packages instead of one; same rebuild requirement.
- **Storage:** `$(Documents)/mmkv/` by default, overridable via `path`; optional
  AES-128/AES-256 encryption via `encryptionKey`.

### `@react-native-async-storage/async-storage`

- Actively maintained, MIT, RN 0.76+ / Android SDK 24+ / iOS 13+.
  **On Android, iOS and macOS it is itself backed by SQLite**; web is IndexedDB.
  ([react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage))
- A third-party native module: same rebuild, same fingerprint move as the others,
  for a strictly weaker API than the SQLite already under it.

### `expo-sqlite/kv-store`

Not a fourth library — a subpath of `expo-sqlite` presented by Expo as a *drop-in
replacement for AsyncStorage*, with both async and **synchronous** methods
(`Storage.setItemSync`, `getItemSync`). Same native dependency, same install, no
extra fingerprint cost over plain `expo-sqlite`. This is the shape gather adopted.

### Anything else current

`op-sqlite` (fast SQLite, third-party) and `expo-secure-store` are the two other
things that come up. `op-sqlite` is a performance play this app has no volume to
justify. `expo-secure-store` is already installed but is the wrong tool twice over:
it is Keychain/Keystore-backed for small secrets, not a bulk store, and it is
Clerk's.

---

## Query shape — prefix search over name + brand

The target is a few hundred to a few thousand local rows, searched as somebody types.

**SQLite handles this two ways, both fine at this size.**

1. `LIKE 'term%'` on `name` and `brand`, with an index on each. A left-anchored
   `LIKE` can use a B-tree index; a few thousand rows answer in single-digit
   milliseconds even when it cannot.
2. FTS5 with a prefix `MATCH 'term*'` over a `name, brand` virtual table. Available
   with no configuration because `enableFTS` defaults on. This is what earns its keep
   if the search should be word-boundary aware ("chicken" matching *Free-range
   chicken breast*) rather than only front-anchored — which is exactly what gather's
   Convex full-text index gives today and what the key-value options cannot.

**MMKV and AsyncStorage cannot search at all.** They store bytes under a key. The
only way to search is to load the whole set into JS and filter it in memory. At a
few thousand small rows that is genuinely fine — a `.filter()` over 2,000 objects is
sub-millisecond — but it means the entire food list is resident in JS memory, is
re-parsed on cold start, and re-serialised in full on every single edit. The cost is
not the search; it is that *every write is a whole-collection write.*

---

## Schema change across app updates

The shipped standard food list is a code constant in `@workouts/core` and changes
with every release (#51). The personal store has to outlive that.

**SQLite** has the mechanism built in, and Expo documents it: read
`PRAGMA user_version`, apply the incremental steps from that number to the current
`DATABASE_VERSION`, then `PRAGMA user_version = N` — normally inside the
`SQLiteProvider` `onInit` handler, with `withTransactionAsync` around each step.
Two properties matter more than the ergonomics:

- **A failed migration rolls back.** Wrapped in a transaction, a migration that
  throws leaves the database exactly as it was. The user loses the app-launch, not
  the data.
- **A *wrong* migration is still destructive**, and it runs at launch before anyone
  can intervene. A `DROP COLUMN` that should have been a rename is gone on every
  device that opened the app once. The mitigation is the same one every SQLite app
  uses: forward-only, additive steps; never drop or rewrite in the same release that
  stops reading a column.

**MMKV / AsyncStorage** have no migration mechanism whatsoever. You hand-roll one:
store a `schemaVersion` alongside the blob, and on read, if it is behind, transform
the parsed object and write it back. A bug there is worse than the SQLite case in
one specific way — the whole collection is one value, so a serialisation that throws
half-way, or a write interrupted by the app being killed, can leave the single key
holding truncated JSON, and *the entire personal food list is that key*. There is no
row-level blast radius to fall back on.

---

## What survives what

This is the whole risk of device-only, so it is worth being exact. Note that all
three options end up in the same two directories, so the answers barely differ
between them — the risk belongs to the *device-only decision*, not to the library.

| Event | Personal foods survive? |
|---|---|
| **App update** (JS or native) | Yes, all options. Updating an app does not touch its data container. |
| **OS update** | Yes, all options. |
| **OTA update** (once `expo-updates` exists) | Yes — but a JS-level schema expectation can arrive without the migration having run in the order you assumed. Version the store, not the build. |
| **Uninstall + reinstall** | **No, all options, both platforms.** Uninstall deletes the app container. This is the primary loss path. |
| **iOS "Offload App"** | Yes — offloading deliberately preserves documents and data; reinstalling restores them. |
| **iOS device restore / migration** | **Yes, by default.** `expo-sqlite`'s default database directory is the app Documents directory, which iCloud Backup and encrypted local backups include. MMKV's `$(Documents)/mmkv/` is likewise included. Files are only excluded if something sets `isExcludedFromBackup`, and nothing here does. Note Apple's own caveat that the flag is fragile and can be reset by ordinary file operations — a reason not to reach for it, not a reason to worry. On tvOS `expo-sqlite` uses the caches directory instead, per Apple guidance; irrelevant here. |
| **Android device restore / migration** | **Yes, with a ceiling.** Expo's generated manifest leaves `android:allowBackup` at its default `true`, and Auto Backup covers the app's files directory. But **Auto Backup stops at 25 MB per app** — past that the app sends nothing further to the cloud. A few thousand food rows is well under a megabyte, so this ceiling is theoretical here; it stops being theoretical if photos ever join them. Direct device-to-device transfer is not subject to the same cloud cap. |
| **User clears app data (Android)** | No. Nothing survives that, anywhere. |
| **"Log in on my other phone"** | **No, all options.** There is no server copy. This is the honest cost of device-only and no library changes it. |

The two failure modes worth naming for #56: **reinstall** and **second device**.
Neither is exotic. Both argue for the export hatch below, and both are why the
identity question is not academic.

Sources: [Apple — excluding files from
backup](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup),
[Android — Back up user data with Auto
Backup](https://developer.android.com/identity/data/autobackup),
[Expo SQLite docs](https://docs.expo.dev/versions/latest/sdk/sqlite/).

---

## Identity — ids that could reconcile later

#51 leaves eventual sync of personal foods in fog, and flags this as the one open
question that bears on today's decision.

**Mint UUIDs now. It is nearly free, and the alternative is not.**

- *How.* Hermes does not implement Web Crypto, so `crypto.randomUUID()` is not
  there. `expo-crypto` provides `randomUUID()` and `getRandomValues()` as Web
  Crypto-compliant equivalents. It is another native module, so it moves the
  fingerprint — but it rides in the same rebuild as the storage choice, so the
  marginal cost is one line in `package.json`. (A monotonic
  `${installId}:${counter}` string would avoid even that, at the cost of needing an
  install id you would then have to generate randomly anyway.)
- *What it costs now.* One column, one dependency, no schema complexity. A UUID
  primary key in SQLite is a `TEXT PRIMARY KEY`; the row is a few dozen bytes wider.
- *What it costs later if you don't.* Autoincrementing local integers collide across
  devices by construction. Two phones both have food `7`. A later sync then has to
  invent identity retroactively — which means either fuzzy-matching on name+brand
  (wrong, silently, for the two yoghurts a person deliberately keeps separate) or
  minting new ids at sync time and rewriting every diary entry that referenced the
  old one. Diary entries snapshot their nutrition figures (#51), which softens this a
  great deal — a diary entry does not break if its food's id changes — but "which of
  these two rows is the same food" still has no answer.

Also mint a **stable fork id**: fork-on-edit (#51) copies a standard food into the
personal store, and that copy should record which constant it forked from. That is a
second `TEXT` column, decided now, unavailable cheaply later.

---

## Export / backup — the escape hatch

There is no server copy, so "get my foods off this phone" has to exist as a
deliberate feature or not at all. It is cheap in every option:

- **Read rows → JSON → `expo-file-system` → share sheet.** `expo-sharing` (or a
  `Share` call) hands the file to Files / Drive / mail. Works identically for SQLite
  rows and for a key-value blob — in the key-value case the blob *is already* the
  export, which is the one place that shape wins outright.
- Copying the `.db` file itself is possible with `expo-file-system` but is a worse
  export: opaque to the person, coupled to a schema version, and useless as an import
  into anything else. JSON is the right currency.
- `expo-sqlite` exposes no `serialize`/`deserialize` in the SDK 57 docs, so do not
  plan on a one-call database dump.

Import is the harder half and is not this ticket's question — but note that an
export with UUIDs in it is re-importable idempotently, and one with local integers
is not. Another vote for the previous section.

---

## Recommendation

### `expo-sqlite`, with personal foods as a table

Add `expo-sqlite` via `npx expo install expo-sqlite`. No `app.json` plugin entry —
the defaults already compile FTS in. Personal foods become a table with a
`TEXT PRIMARY KEY` UUID, a `forked_from` column, and indexes on `name` and `brand`;
`PRAGMA user_version` carries the schema forward. Use `expo-sqlite/kv-store` for any
incidental single values (last-used meal, diary defaults) rather than adding a second
storage library for them — gather's *"one mechanism"* rule.

**Why it wins:** it is the only option that answers the query-shape question with a
real index instead of an in-memory scan, the only one with a migration mechanism the
platform maintains, and the only one that is first-party — which the house's own
tie-break rule (`expo-*` beats third-party on *which library*) and the only existing
precedent in the house both point at. It carries #58 (Combos — a second table, a
join) and #59 (OFF import — bulk insert of rows you did not author) without a
rethink, and those are the tickets most likely to make a key-value store regret
itself.

**The case against it.** It is the heaviest answer to what is, today, a list of a few
hundred rows — a JSON blob would genuinely work, and every SQL statement is
hand-written string SQL with no compile-time schema behind it, in a codebase whose
whole character is typed constants in `@workouts/core`. Migrations are real code that
runs at launch on somebody's only copy of their data, and getting one wrong is
unrecoverable in a way that no amount of care fully removes. It also invites scope:
once there is a local database, "just cache the diary locally too" becomes a
one-hour idea, and the #51 premise that the diary lives in Convex is a decision, not
an accident.

### Runner-up: `expo-sqlite/kv-store`, one JSON blob

Same dependency, same install, same fingerprint — but the personal food list is one
key holding a JSON array, loaded into memory at startup and filtered in JS.
Migrations are a `schemaVersion` field and a transform function. Export is the blob.

**Why it is the runner-up and not the answer:** it is the smallest thing that could
possibly work, it keeps the food list as a plain typed array in TypeScript — which
is exactly the shape `@workouts/core` already speaks — and it upgrades to the
recommendation later without changing dependencies, because the storage library is
the same one.

**The case against it.** Every edit rewrites the whole collection, so a write
interrupted mid-flight can truncate the one key that holds everything, and there is
no row-level recovery. Search is a full scan by construction, which is fine at 2,000
rows and stops being fine the moment #59's OFF import lets somebody accumulate
20,000. It has no migration mechanism, only the one you write. And it defers the
same decision rather than making it — the second table (#58 Combos) is the point
where it has to be revisited, and that ticket is already on the map.

### Rejected

- **`react-native-mmkv` (v4).** Two native dependencies (`react-native-mmkv` +
  `react-native-nitro-modules`) instead of one, third-party rather than first-party
  and therefore outside `npx expo install`'s SDK-compatibility guarantee, no search,
  no migrations. Its entire selling point is read/write speed on a hot path, and a
  food list is not one. *In fairness:* it is excellent software, it is fully New-Arch
  native, and its synchronous API is the nicest of the lot — if this app already had
  it, following the repo would be the right call. It does not.
- **`@react-native-async-storage/async-storage`.** A third-party native module that
  is *implemented on top of SQLite* on both platforms this ships to. Taking it means
  paying the same rebuild to get a key-value API over a database, while Expo ships
  the database itself with a key-value API (`kv-store`) already on the side. *In
  fairness:* it is the most widely deployed option by a wide margin, so every answer
  to every problem is already written down somewhere — which is worth something, but
  not this.

---

## Questions this raised that are not on the map

- **Nothing sets `android:allowBackup` explicitly.** The app relies on the platform
  default being `true`. That is fine, and it is also the only thing standing between
  a person's device-only foods and an Android upgrade wiping them. If device-only
  ships, the manifest should say so on purpose.
- **What happens on reinstall is a product question, not a storage one.** "Your
  personal foods were on your old phone" needs a screen, or an import, or an
  accepted silence. #56 places the data; nobody has decided what the app *says* when
  it isn't there.
