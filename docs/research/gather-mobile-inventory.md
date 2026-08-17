# Inventory: `AppElent/gather` `apps/mobile`, `packages/core`, ADRs

Research output for [workouts#42](https://github.com/AppElent/workouts/issues/42),
child of the mobile wayfinder map [workouts#41](https://github.com/AppElent/workouts/issues/41).

Read remotely from the public `AppElent/gather` repo (default branch) via `gh api`.
Everything below is quoted or paraphrased from real files; file paths are gather-relative
unless stated. Nothing here is a decision for workouts — findings only. The final section
("Extraction candidates") is the direct input to [#43](https://github.com/AppElent/workouts/issues/43).

---

## 0. Shape at a glance

`apps/mobile/package.json` is `@gather/mobile`, `private: true`, `main: "expo-router/entry"`.
Notable scripts:

```json
"start": "expo start",
"start:dev-client": "expo start --dev-client",
"deploy:development": "eas build --platform ios --profile development",
"lint": "expo lint",
"typecheck": "tsc --noEmit",
"eas-build-pre-install": "echo \"//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\" >> ~/.npmrc"
```

Dependencies (the load-bearing ones): `expo ~57.0.11`, `react-native 0.86.2`,
`react 19.2.3`, `expo-router ~57.0.11`, `@clerk/expo ^4.2.3`, `convex ^1.42.3`,
`@gather/core workspace:*`, `expo-secure-store`, `expo-sqlite`, `expo-constants`,
`expo-localization`, `expo-splash-screen`, `expo-system-ui`, `expo-status-bar`,
`lucide-react-native ^1.31.0`, `react-native-svg 15.15.4`,
`react-native-safe-area-context`, `react-native-screens`, `react-native-reanimated`,
`react-native-gesture-handler`, `react-native-worklets`. Dev: `eas-cli`, `eslint` +
`eslint-config-expo`, `typescript ~6.0.3`.

**There is no `metro.config.js` and no `babel.config.js`** in `apps/mobile` — SDK 57's
defaults resolve the pnpm workspace and the raw-`.ts` workspace package without extra
config. `tsconfig.json` is four lines: `extends: "expo/tsconfig.base"`, `strict: true`.

There is **no Vitest/Jest in `apps/mobile`**. Its CI gate is typecheck + lint only:

```yaml
- run: pnpm run typecheck                        # root web + convex
- run: pnpm --filter @gather/core typecheck
- run: pnpm --filter @gather/mobile typecheck
- run: pnpm --filter @gather/mobile lint
- run: pnpm test                                 # root vitest (web + convex + core projects)
```

Pure logic that *needs* asserting is therefore deliberately pushed down into
`packages/core` (or into `apps/mobile/src/availability/state.ts`, whose `state.test.ts`
is, notably, unrunnable by any configured project — the root vitest globs don't cover
`apps/`).

---

## 1. Clerk wiring

### Versions, and the generation split

| | package | Clerk generation |
| --- | --- | --- |
| gather web | `@clerk/clerk-react ^5.61.3` (via `@appelent/auth` peer) | **Core 2** |
| gather mobile | `@clerk/expo ^4.2.3` → depends on `@clerk/react ^6.14` | **Core 3** |

workouts today is `@clerk/clerk-react ^5.61.8` — the same Core 2 side of the split, with
an extra wrinkle gather doesn't have: `pnpm-workspace.yaml` pins
`overrides: { "@clerk/clerk-react": ">=5.61.6" }` for GHSA-w24r-5266-9c3c. That override
is on the *web* package and is unaffected by adding `@clerk/expo`, but it means any future
Core 3 convergence has to re-establish the advisory floor on the new package name.

`@clerk/expo` is also listed in `app.json` `plugins`, alongside `expo-secure-store`.

### Provider composition (`apps/mobile/app/_layout.tsx`)

The nesting order is the decision, and gather documents it as enforcement rather than
convention:

```tsx
<AppearanceProvider>          {/* local: survives Clerk/Convex being unreachable */}
  <LocaleProvider>            {/* local: same */}
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AppConvexProvider>     {/* above the router: one websocket, follows the session */}
        <AvailabilityProvider>
          <SafeAreaProvider>
            <NativeChrome>
              <RootNavigator />
```

Rationale, quoted from the file's header comment:

- Appearance and language sit **outside** Clerk "so the Unavailable gate remains locally
  usable" — the offline/error screen is drawn in the scheme and language its reader chose.
- Convex sits **above the router** "like Clerk itself: the client holds one websocket and
  its authentication follows the session, so it must not be torn down and rebuilt as
  screens come and go. Signed-out screens simply never query."

### The token cache is not hand-rolled

```tsx
import { ClerkProvider } from '@clerk/expo'
import { tokenCache } from '@clerk/expo/token-cache'
```

That's the whole implementation. `@clerk/expo` v4 ships a `expo-secure-store`-backed
cache at the `/token-cache` subpath; gather writes no `SecureStore.getItemAsync`/
`setItemAsync` wrapper of its own. `expo-secure-store` is a direct dependency and an
`app.json` plugin because the cache needs the native module, not because gather calls it.

**This is the single biggest "don't reimplement" finding in the Clerk section.** Every
older tutorial (and `@clerk/clerk-expo`, the deprecated predecessor) has you write a
15-line `createTokenCache()`. v4 does not.

### Cold start: hold the splash, mount nothing

`SplashScreen.preventAutoHideAsync()` runs at module scope. `RootNavigator` renders
`null` while `mode === 'splash'`. Reason, quoted:

> On a cold start Clerk has to read the session token out of the keychain and exchange it
> before it can say whether anyone is signed in. […] for the whole of it
> `useAuth().isSignedIn` is `undefined`. Mount the router into that window and the first
> thing a person with a perfectly good session sees is the welcome screen, which then
> vanishes.

The splash is hidden **by the first screen that mounts**, via `useHideSplash()` — an
`onLayout` handler, not an effect, because "an effect fires when the component has
committed and a layout callback fires when it has actually been measured and positioned.
The difference is one frame of blank background."

Two other production details in the same file:

```tsx
LogBox.ignoreLogs(['Clerk: Clerk has been loaded with development keys'])

if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  SplashScreen.setOptions({ duration: 220, fade: true })   // Expo Go refuses setOptions
}
```

### Route groups and the signed-out path

```
app/
  _layout.tsx            root: providers + splash gate + Stack of two groups
  (auth)/                signed-out half
    _layout.tsx  index.tsx  sign-in.tsx  sign-up.tsx  verify-email.tsx
    welcome-catalogue.tsx  reset/
  (app)/                 signed-in half
    _layout.tsx  (tabs)/  account.tsx  groups.tsx  settings.tsx
    switch-group.tsx  deep-link.tsx
  g/[groupSlug]/         deep-link address space
```

Both halves guard with **Clerk's `isSignedIn`, redirecting with `<Redirect>`**, and both
carry the same warning:

`(app)/_layout.tsx`:
> The guard is Clerk's `isSignedIn`, not Convex's `isAuthenticated`, and that is not
> interchangeable: the two disagree for the length of the JWT handshake after a sign-in,
> and guarding on the Convex side produces an infinite bounce between the two halves of
> the app. The web learned this the hard way; the phone starts on the right side of it.

`(auth)/_layout.tsx` redirects the other way: `if (isSignedIn) return <Redirect href={...} />`.

The rule gather distils: **guards follow the session (Clerk), writes follow the token
(Convex)** — see `useEnsureUser` below.

### Auth screens are hand-built, and the web is a trap

`src/auth/` is four files:

- `config.ts` — env reads + dev-login gate
- `clerkErrors.ts` — Clerk error code → localized message
- `usePasswordSignIn.ts` — email+password → active session
- `useSignOut.ts` — sign out + clear the retained group

`config.ts` carries two rules worth copying verbatim:

> **Static dot access is load-bearing.** Metro inlines `EXPO_PUBLIC_*` by textually
> substituting `process.env.EXPO_PUBLIC_NAME` at build time. It is not an object at
> runtime: `process.env[name]`, destructuring, or a helper that takes the name as an
> argument all yield `undefined` in a release build while appearing to work in dev.

> **The dev-login gate is the key's prefix, not `__DEV__`.** A release build pointed at
> the test instance — which is exactly what a PR preview is — should offer the shortcut;
> a dev build someone has pointed at production must not.

```ts
export const devLogin: { email: string; password: string } | null =
  PUBLISHABLE_KEY.startsWith('pk_test_') && TEST_USER_EMAIL && TEST_USER_PASSWORD
    ? { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }
    : null
```

That is exactly the rule `@appelent/auth` uses on the web (`pk_test_` + both creds),
re-expressed for Expo. A missing publishable key or Convex URL **throws at import**, on
purpose: "failing at import is louder […] than a websocket that quietly never connects."

`usePasswordSignIn.ts` is the Core 3 shape, and the two easy-to-miss parts are:

```ts
const attempt = await signIn.password({ identifier: email.trim(), password })
if (attempt.error) { … }
if (signIn.status !== 'complete') { /* explicit "unhandled status" branch, warns in dev */ }
const finalized = await signIn.finalize()      // <- without this, "success" but not signed in
```

> in Core 3 a successful `password()` leaves the sign-in `'complete'` but **not** signed
> in. `finalize()` is what promotes it to the active session, and skipping it produces a
> flow that reports success and leaves the person exactly where they were.

`clerkErrors.ts` documents the other Core 3 gotcha:

> The `{ error }` a method resolves with is a **wrapper**: a wrong password comes back as
> `api_response_error`, not `form_password_incorrect`. The machine-stable code is on the
> hook's `errors` signal instead (`errors.fields.password.code`) […] Reading only the
> returned error — the obvious thing to write — turns every real, mappable failure into
> "Something went wrong."

Hence `pickError(errors, returned, t)` = signal first, returned wrapper as fallback, and
it must be called **during render** (the async closure holds a stale signal).

The Core 2 → Core 3 delta table lives once, in `docs/research/mobile-clerk-expo.md` §7:

| | Web (Core 2) | Expo (Core 3) |
| --- | --- | --- |
| Hook result | `{ isLoaded, signIn, setActive } = useSignIn()` | `{ signIn, errors, fetchStatus } = useSignIn()` |
| Sign in | `signIn.create({ identifier, password })` | `signIn.password({ emailAddress, password })` |
| Errors | thrown, `try/catch` | returned `{ error }`; field errors on `errors.fields.*` |
| Loading | `isLoaded` | `fetchStatus === 'fetching'` |
| Completing | `setActive({ session: result.createdSessionId })` | `signIn.finalize({ navigate })` |
| Sign-up verify | `prepareEmailAddressVerification` → `attemptEmailAddressVerification` | `signUp.verifications.sendEmailCode()` → `.verifyEmailCode({ code })` |
| Password reset | `signIn.create({ strategy: 'reset_password_email_code' })` + `attemptFirstFactor` | `signIn.create({ identifier })` then `resetPasswordEmailCode.sendCode()` / `.verifyCode()` / `.submitPassword()` |

### Availability: splash vs signed-out vs offline

`src/availability/` is the piece most likely to be overlooked and most likely to be
wanted. `state.ts` is a **pure function** — deliberately, so it can be unit-tested off a
device — resolving five modes:

```ts
export type AvailabilityMode =
  | 'splash' | 'unavailable' | 'signed-out' | 'connected' | 'connection-lost'
```

from `{ clerkLoaded, clerkStatus, signedIn, splashExpired, serviceConnected, serviceEverConnected }`.
Its purpose in one line: "Resolve the outer app state without conflating a connection
failure with a confirmed signed-out identity."

`AvailabilityProvider.tsx` feeds it from `useAuth()`, `useClerk().status`,
`useConvexAuth()` and `useConvexConnectionState()`, adds a `SPLASH_TIMEOUT_MS = 4000`
escape hatch ("a held splash with no escape hatch is a hang"), and exposes
`retry()` which calls `getClerkInstance({ publishableKey }).load()` then
`session.reload()`. Convex owns the socket reconnect from there.

---

## 2. Convex wiring

`apps/mobile/src/convex/provider.tsx`, in full substance:

```tsx
import { useAuth } from '@clerk/expo'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL
if (!CONVEX_URL) throw new Error('EXPO_PUBLIC_CONVEX_URL is not set. …')

const convex = new ConvexReactClient(CONVEX_URL, { unsavedChangesWarning: false })

export function AppConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
```

Four findings:

1. **`convex/react-clerk`'s `ConvexProviderWithClerk` works unchanged on native**, and it
   is the seam where the Core 2/Core 3 split stops: "Convex only ever calls the hook and
   reads a token off it, so the generation split stops here." You pass `@clerk/expo`'s
   `useAuth` where the web passes `@clerk/clerk-react`'s.
2. **`unsavedChangesWarning: false` is mandatory, not cosmetic.** It is opt-*out*; left
   unset the client reaches for `window.addEventListener` on a runtime that may not have
   one.
3. **The URL comes from `process.env.EXPO_PUBLIC_CONVEX_URL`, not `app.json` `extra` and
   not `expo-constants`.** `app.json` `extra` holds only `{ router: {}, eas: { projectId } }`.
   `expo-constants` is imported in `_layout.tsx` solely to detect Expo Go
   (`ExecutionEnvironment.StoreClient`). Same static-dot-access rule as the Clerk key.
4. **No separate JWT template or auth config on the mobile side.** Quoted: "There is no
   mobile backend and no mobile schema: this is the deployment the web app talks to,
   reached with the same Clerk identity through the same JWT template
   (`applicationID: 'convex'` in `convex/auth.config.ts`)."

`.env.example` (copied to `.env.local`):

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
EXPO_PUBLIC_TEST_USER_EMAIL=
EXPO_PUBLIC_TEST_USER_PASSWORD=
EXPO_PUBLIC_CONVEX_URL=
```

### Crossing the workspace boundary to `convex/_generated`

**By deep relative path, not by package specifier.** `src/convex/useEnsureUser.ts`:

```ts
import { api } from '../../../../convex/_generated/api'
```

ADR-0016 states the rule as two boundaries:

- **Hand-written shared logic crosses only via `@gather/core`.**
- **Generated backend stubs cross by relative path.**

with the justification that `convex/_generated/api` cannot be a bare specifier (it
collides with the npm package `convex`), the web already does it at 41 sites, and "a
generated API stub is not web code: it is a machine-written client for a backend both
clients talk to over the wire, and it cannot accidentally drag in Tailwind." **Therefore
`convex/` does not move** — gather explicitly rejected the Convex monorepo template's
`packages/backend` layout as out of proportion.

### The one write the phone makes by arriving

`useEnsureUser.ts` — worth reading in full for the pattern even though workouts has no
`users.ensureUser`:

```ts
const { isAuthenticated } = useConvexAuth()
const ensureUser = useMutation(api.users.ensureUser)
useEffect(() => { if (isAuthenticated) void ensureUser({}) }, [isAuthenticated, ensureUser])
```

> It is deliberately keyed on **Convex's** `isAuthenticated` rather than Clerk's
> `isSignedIn`. The two disagree for the length of the JWT handshake, and this is a call
> the backend would refuse during it. […] guards follow the session, writes follow the token.

Called from `(app)/_layout.tsx`, the same place the web calls it from `_app.tsx`.

---

## 3. Theme layer (`apps/mobile/src/theme`, 4 files)

No NativeWind, no Unistyles, no styling library at all. ADR-0017 calls it "a typed token
module consumed by `StyleSheet`".

### `tokens.ts` — token shape

```ts
const BASE = {
  light: { bg:'#faf9f7', surface:'#ffffff', tile:'#f1f2f0', fg:'#1f2421',
           muted:'#79807b', border:'#e8e7e3', onAccent:'#ffffff' },
  dark:  { bg:'#121413', surface:'#1a1d1b', tile:'#222623', fg:'#eef0ed',
           muted:'#a2a8a4', border:'#2f3431', onAccent:'#121413' },
} as const

export interface Tokens {
  scheme: 'light' | 'dark'
  bg; surface; tile; fg; muted; border
  accent: string      // ink on a group-less screen; the group's tint where there is one
  onAccent; danger: string
  tintOf(group: ModuleGroup): { bg: string; fg: string }
}

export function useTokens(group?: ModuleGroup): Tokens { … }

export const RADIUS = { tile: 13, card: 16, control: 12 }
```

Seven neutrals + `danger` + a resolved `accent` + a `tintOf()` helper. **That's the entire
palette API.** No spacing scale, no typography scale — font sizes and weights are written
literally in each `StyleSheet.create` call (see `AuthField`, `ModulePlaceholder`).

The design rule quoted from the file: **"Colours, not conditions: a call site never
branches on the scheme, and never learns why its accent is teal."** Consumers call
`useTokens()` (or `useTokens(module.group)`) and get resolved hex strings.

`MODULE_TINTS` — the only shared colour — lives in `@gather/core/module-tints`, keyed
`Record<ColorScheme, Record<ModuleGroup, readonly [bg, fg]>>`.

**The web's `oklch()` tokens are unportable**: `@react-native/normalize-colors@0.86.2`
accepts rgb/rgba/hsl/hsla/hwb/#hex/named colours — not `oklch()`. gather sidesteps this by
not porting the web palette at all.

### `appearance.tsx` — three-state dark mode without a cascade

State is `'light' | 'system' | 'dark'`, read **synchronously before the first paint**:

```tsx
const [preference, setStored] = useState(() =>
  appearancePreference(readPreference(PREFERENCE_KEYS.appearance)))
const system = useColorScheme()
const scheme = resolveScheme(preference, system)

useEffect(() => {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference)
}, [preference])
```

Two rules worth transferring:

- **Push the choice into the platform too**, not just React context: "the keyboard, the
  text-selection handles, the native sheet's grabber and the tab bar are drawn by the
  platform […] Leave that idea alone and somebody who chose dark on a light phone gets a
  dark app with a white keyboard." `'system'` is expressed as `'unspecified'`.
- **Context stays the source of truth**, because `setColorScheme` lands a frame late "and
  the frame it lands after is the cold start that has to already be dark."
- `app.json` must set `userInterfaceStyle: "automatic"` "without which none of it works."

The *rule* (`appearancePreference`, `resolveScheme`, `APPEARANCE_PREFERENCES`) is hoisted
into `@gather/core/appearance` — 4 lines of logic — explicitly because mobile has no test
runner and core does.

Persistence is `src/prefs/localPreference.ts` over **`expo-sqlite/kv-store`**
(synchronous `getItemSync`/`setItemSync`), one store, three namespaced keys:

```ts
export const PREFERENCE_KEYS = {
  group: 'gather:group:retained',
  appearance: 'gather:appearance',
  locale: 'gather:locale',
} as const
```

All reads/writes are `try`-wrapped and best-effort: "a store that will not open is a phone
that forgets a preference, which is a fallback, not an error." Warning recorded: the
`try` blocks don't cover the *import* — `expo-sqlite` is native, so **the dev client must
be rebuilt** when this dependency is added (Expo Go already bundles it).

### `NativeChrome.tsx` — the three surfaces React doesn't style

```tsx
export function navigationTheme(tokens: Tokens): Theme {
  const base = tokens.scheme === 'dark' ? DarkTheme : DefaultTheme
  return { ...base, colors: { ...base.colors,
    primary: tokens.accent, background: tokens.bg, card: tokens.surface,
    text: tokens.fg, border: tokens.border, notification: tokens.danger } }
}
```

Wraps children in expo-router's `ThemeProvider`, renders `<StatusBar style={dark?'light':'dark'} />`,
and calls `SystemUI.setBackgroundColorAsync(tokens.bg)`. Rationale: expo-router mounts its
own `ThemeProvider` with `DefaultTheme` and never consults the device — "without this
every pushed screen's header is white in dark mode." The window background otherwise
"shows through as a pale band under a dark app while a keyboard dismisses or the device
rotates."

### `icons.ts` — deep imports, not the barrel

```ts
import Apple from 'lucide-react-native/icons/apple'
// … 21 more
export const MODULE_ICONS = { Apple, Baby, … } satisfies Record<ModuleIconName, LucideIcon>
export const UI_ICONS = { Check, ChevronDown, …, Settings } satisfies Record<string, LucideIcon>
```

> The web's `Icon.tsx` reaches lucide with `import * as Icons`. Doing that here would hand
> Metro a 24.8 MB, 9,131-file package it does not tree-shake […] **A named import off the
> barrel would be no better than the star**: the barrel is still one module that imports
> all 9,131. The deep path is the whole point.

Measured cost of getting this wrong: ~1,500 extra modules on a bundle of 1,392.

### How a component consumes it

`ModulePlaceholder.tsx` is the canonical shape — **layout in `StyleSheet.create`, colour
applied inline**, which ADR-0017 calls "the React Native idiom and not a compromise":

```tsx
const tokens = useTokens(module.group)
const tint = tokens.tintOf(module.group)
…
<View style={[styles.hero, { backgroundColor: tint.bg }]}>
  <Icon size={46} color={tint.fg} strokeWidth={1.6} />
  <Text style={[styles.title, { color: tint.fg }]}>{text.label}</Text>
…
const styles = StyleSheet.create({
  hero: { minHeight: 196, borderRadius: RADIUS.card, alignItems: 'center', … },
  title: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
})
```

**Type is the platform's** — San Francisco / Roboto, no `@expo-google-fonts`, no
`expo-font` load, no splash hold. Reason beyond cost: `@expo/ui` components use the system
face regardless, so a custom body face gives Settings one typeface and every other screen
another.

Chrome is **not** hand-styled: `@expo/ui`'s Universal components (`Host`, `List`, `Switch`,
`Picker`) for settings-shaped surfaces, `expo-router`'s `Stack`/`NativeTabs` for navigation
chrome. **Auth text fields are the named exception** and stay on RN's own `TextInput`
(`src/components/AuthField.tsx`), because `@expo/ui`'s input runs `onChangeText` as a
UI-thread worklet — a second mental model on the one v1 flow with real state to get wrong.

---

## 4. Shell (`src/shell`, 5 files) and `app/(app)` navigation

### `tabs.ts` — the tab set is a constant

```ts
export interface ShellTab {
  name: 'home' | 'recipes' | 'tasks' | 'nutrition' | 'all'
  sf: { default: SFSymbolName; selected: SFSymbolName }   // iOS
  md: MaterialSymbolName                                   // Android
  label: (messages: Messages) => string
}

export const SHELL_TABS = [ … ] as const satisfies readonly ShellTab[]
```

The critical constraint, stated once here:

> A native tab bar cannot take [a lucide glyph]: `NativeTabs` renders a real
> `UITabBarItem` / `BottomNavigationView`, whose icon is an SF Symbol on iOS and a bitmap
> on Android, and lucide-react-native draws SVG in React. Handing it a React tree is not an
> option the platform offers.

So the bar takes SF Symbol + Material Symbol names, **typed from `expo-router`'s own props**
(`SFSymbolIcon['sf']`, `MaterialIcon['md']`) rather than from `sf-symbols-typescript` /
`expo-symbols`, "because the bar accepts the symbols of one catalogue version each, and
borrowing either union from anywhere else would put the failure at the layout instead of
here." Android's symbol font is one `NativeTabs` already loads; `@expo/vector-icons` would
add a second 357 KB font.

Five slots is Android's ceiling and matches the web's `DOCK_SLOTS`.

### `(tabs)/_layout.tsx` — the entire tab layout

```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs'

export default function TabsLayout() {
  const { t } = useI18n()
  return (
    <NativeTabs labelVisibilityMode="labeled">
      {SHELL_TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
          <NativeTabs.Trigger.Label>{tab.label(t)}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  )
}
```

Note the import path: `expo-router/unstable-native-tabs`.

### `(app)/_layout.tsx` — a Stack with the tabs inside it

```tsx
export const unstable_settings = { anchor: '(tabs)' }
```

> `anchor` is the part that is not obvious. A `Stack` takes its initial route from the
> first screen it is *told* about, so without this the app opens on the switcher sheet.
> Found on the emulator, not by reading.

Structure: `<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.bg } }}>`
containing `(tabs)`, `deep-link`, a `switch-group` form sheet, and three `headerShown: true`
pushed screens whose titles come from `t.*`:

```tsx
<Stack.Screen name="switch-group" options={{
  presentation: 'formSheet',
  sheetAllowedDetents: [0.55, 1],
  sheetGrabberVisible: true,
}} />
<Stack.Screen name="settings" options={{ headerShown: true, title: t.settings.title }} />
```

Header rule: pushed screens get the native header (they need the platform back
affordance); tabs do not (each draws its own heading, and a native header "would title the
same thing twice"). Colours come from `NativeChrome`'s navigation theme, never from the
screen.

### Other `src/shell` files

- `ModuleTab.tsx` — one component so the three fixed Module tabs render the *identical*
  placeholder as a Module opened from Home or All.
- `ModuleRoute.tsx` (476 B) — the dynamic `/all/[moduleId]` equivalent.
- `groupLink.ts` — maps a web `/g/<slug>/…` deep link onto a native destination,
  deliberately strict: unsupported → `null`, "an unimplemented detail page is not 'close
  enough' to a tab root, because accepting it would make an invalid link change the ambient
  Group."
- `pendingGroupLink.ts` — a deep link parked across the sign-in round trip; `(auth)/_layout`
  redirects to `/deep-link` instead of `/home` when one is waiting.

### ADR-0018's future shape (decided, **not yet implemented**)

The shipped bar is still Home / Recipes / Tasks / Nutrition / All. ADR-0018 replaces it
with Home / Search / **Add** / Profile / All, and the mechanism is worth recording:

> **`NativeTabs.Trigger` accepts `disabled`**, which keeps the item visible in the bar and
> suppresses the native selection while the navigator *still emits* `tabPress` (with
> `isPrevented: true`).

so "Add" is a real `UITabBarItem` that opens a sheet and never navigates. A screen must
still exist behind the slot because the navigator requires one, and reaching it is treated
as a bug. Rejected alternatives: an Add destination screen, `NativeTabs.BottomAccessory`
(iOS 26+ only), a floating pill (retained as fallback), a hand-drawn bar with a raised
centre button (loses `UITabBarItem`, and with it iOS 26 minimise-on-scroll, Android ripple,
Dynamic Type, automatic content insets, scroll-to-top, pop-to-top, and tab accessibility
semantics).

ADR-0018 also establishes a rule gather had been mis-attributing to ADR-0015: **a tab that
owns utility screens must own its own stack**, or "a slot whose entire content ejects you
from the bar you just used is a slot that punishes being used." Named cost: "nesting a
screen means re-pointing every link inside it."

---

## 5. `packages/core`

`package.json` in full:

```json
{
  "name": "@gather/core", "version": "0.0.0", "private": true, "type": "module",
  "exports": {
    "./appearance": "./src/appearance.ts",
    "./domain":     "./src/domain.ts",
    "./groups":     "./src/groups.ts",
    "./i18n":       "./src/i18n.ts",
    "./messages":   "./src/messages.ts",
    "./module-tints": "./src/moduleTints.ts",
    "./modules":    "./src/modules.ts",
    "./pins":       "./src/pins.ts"
  },
  "dependencies": {},
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

Raw `.ts`, no build step, no wildcard subpath. Enforcement mechanisms, per ADR-0016:
`dependencies: {}` under pnpm's isolated linker (an import of `react`/`convex`/Tailwind
does not resolve — "not discouraged, **absent**"); an explicit-subpath `exports` map so
widening the surface is a reviewable line; a `tsconfig.json` with `lib: ["ES2022"]` and
`types: []` typechecked in CI (the only thing that catches a *type-level* DOM reach); and a
third Vitest project `core` on `environment: 'node'` so DOM-freedom is continuously tested.

### Export-by-export: app-agnostic vs gather domain

| Export | LoC-ish | Contents | Verdict |
| --- | --- | --- | --- |
| `./appearance` | ~35 real | `APPEARANCE_PREFERENCES = ['light','system','dark']`, `AppearancePreference`, `ColorScheme`, `appearancePreference(saved: unknown)`, `resolveScheme(pref, systemScheme)` | **Fully app-agnostic.** Zero gather nouns. Verbatim-reusable. |
| `./i18n` | ~40 | `SUPPORTED_LOCALES`, `Locale`, `isLocale`, `resolveLocale(locales, fallback, saved?, requested?)`, `fmt(template, values)`, `plural(locale, count, {one,other})` | **Agnostic except `SUPPORTED_LOCALES = ['en','nl']`**, which is a gather value in an otherwise generic module. All four helpers are generic over `Locales extends readonly string[]`. |
| `./module-tints` | ~20 | `MODULE_TINTS: Record<ColorScheme, Record<ModuleGroup, [bg, fg]>>` | **Shape agnostic, values gather.** The *pattern* (a per-scheme tint record `satisfies` a domain union) transfers; the four hex pairs do not. |
| `./messages` | 5 + trees | re-exports `en`/`nl` message trees (~2,536 lines) and `type Messages` | **Gather domain.** The *convention* (English at the source, translations as typed dicts, ADR-0011) transfers; the content does not. |
| `./modules` | ~140 | `MODULE_GROUPS`, `ModuleGroup`, `ModuleIconName` (13-name union), `ModuleDef`, `MODULES` (13 entries), `ModuleId`, `moduleById`, `modulesByGroup`, `moduleText` | **Gather domain**, as the map already assumed. |
| `./pins` | ~45 | `DEFAULT_PINS`, `pinnedModuleIds`, `pinnedModules`, `isPinned`, `togglePin`, `movePin` | **Gather domain.** `togglePin`/`movePin` are generic array ops but too trivial to package. |
| `./groups` | ~90 | `LandingGroup`, `landingGroupSlug`, `GroupSelection` (`pending`/`none`/`ready`), `selectGroup(retained, groups)` | **Gather domain.** But the *pattern* — a three-state `pending | none | ready` selection so a caller never confuses "not loaded" with "empty" — is a genuinely transferable idea. |
| `./domain` | ~30 | `BABY_EVENT_TYPES`, `NUTRIENT_KEYS`, `NutritionSource`, `MEAL_NAMES`, `QUANTITY_UNITS` | **Gather domain.** Hoisted out of `convex/lib` *only* so `dependencies: {}` stays true by declaration rather than by file location; `convex/lib/*` re-exports them so validators are untouched. |

**The rule core states about itself**, and the sentence most worth carrying over:

> **Core holds what two clients must agree on and cannot diverge safely.**
>
> A module name drifts **invisibly** — the web works perfectly and the phone quietly lacks
> a Module. A colour drifts **on screen**, immediately, where a human sees it.

Two structural constraints that bind anything proposed for core later: it has **no
dependencies and no build step**, so only plain data with zero imports can live there (a
styling library's config file structurally cannot); and the web's tokens are CSS custom
properties, so a TypeScript module in core is a *second* source of truth for anything the
web already expresses in CSS unless something generates one from the other.

### The accepted cost, and it is directly relevant to #43

ADR-0016 records that gather's web **stopped using part of `@appelent/i18n`**:

> `@appelent/i18n` exports no `core` subpath — only `.`, `./server`, `./clerk-sync` and
> `./test-utils` — so the only way to reach its pure helpers is through an entry that also
> carries the DOM path plus `react-dom` and `@tanstack/react-start` peers. There was never
> a clean seam […]
>
> Stated plainly: **gather's web stops using part of a shared Appelent package, diverging
> from other Appelent apps, for no web-side benefit.**

And separately: **`@appelent/i18n`'s unguarded `Intl.PluralRules` is a real bug for any app
that meets Hermes** — tracked as AppElent/appelent-packages#16. That is why gather mobile
reimplements `plural()` as `count === 1 ? one : other`.

---

## 6. The four ADRs — and whether they transfer

### ADR-0014 — "The phone is a Clerk generation ahead of the web" (accepted 2026-08-13)

**Summary.** gather web is `@clerk/clerk-react` ^5.61 (Core 2); `@clerk/expo` depends on
`@clerk/react` ^6.14 (Core 3). Two clients of one Clerk instance on two API generations,
**accepted rather than fixed**. The phone had no choice — there is no Core 2 Expo package,
and `@clerk/clerk-expo` → `@clerk/expo` *is* the Core 3 move. Converging means upgrading
`@appelent/auth` (its `@clerk/clerk-react ^5.61.0` **peer dependency**), which is a
breaking change for every Appelent app, made in a repo gather does not own — tracked as
AppElent/appelent-packages#15. Not a free ride: `@clerk/clerk-react` is **deprecated on
npm** ("This package is no longer supported"), so this is an unpatched auth library, which
is why the ADR has explicit end conditions. The named trap: `@appelent/auth`'s form logic
"reads exactly like a reference implementation for the mobile screens. It is not one."
Divergence rule: **"divergence in layout is fine; divergence in vocabulary is not."**
Concrete allowed divergences: 3-screen password reset (for *atomicity* — Core 3's
`verifyCode()` can succeed and `submitPassword()` be rejected, spending the code), per-field
errors, and `getToken()` throwing `ClerkOfflineError` offline where Core 2 returned `null`.

**Transfers to workouts: yes, almost verbatim.** workouts is on `@clerk/clerk-react ^5.61.8`
via `@appelent/auth ^0.1.0` — the identical Core 2 position, the identical shared-package
constraint, the identical deprecation exposure. The map's open question "whether
`@clerk/expo` v4 forces a Clerk version bump on the web app" is answered by this ADR: it
does not, because the split stops at `ConvexProviderWithClerk`'s `useAuth` prop. The one
workouts-specific addition: the `overrides: { "@clerk/clerk-react": ">=5.61.6" }` security
pin in `pnpm-workspace.yaml` will need an equivalent floor if/when the web moves to
`@clerk/react`. Also note workouts inherits a *second* dependency on the split — the
dev-test-login button is rendered by `@appelent/auth` on the web but must be hand-built on
the phone (gather's `auth/config.ts` + `usePasswordSignIn`).

### ADR-0016 — "Shared code crosses as a package with no dependencies" (decided 2026-08-13)

**Summary.** A workspace package `@gather/core`, raw `.ts`, `dependencies: {}`, narrow
`exports`. Rejected: an `exports` map on the root package (cheaper, and it lost) —
"An `exports` map can only *describe* an intended boundary […] The map documents a rule;
`dependencies: {}` **is** the rule." Shape: `convex → core`, `web → core`, `mobile → core`,
**`core → nothing`**. Two boundaries, one rule each: hand-written shared logic crosses via
the package; **generated backend stubs cross by relative path**. Therefore `convex/` does
not move (the Convex monorepo template's `packages/backend` was rejected as
disproportionate: 77 relative import sites, deploy/seed scripts, two workflows).
Enforcement is four mechanisms (isolated linker, wildcard-free exports, a `lib: ES2022` /
`types: []` tsconfig typechecked in CI, a node-environment Vitest project). Known risk:
if React Native ever forces `nodeLinker: hoisted`, `dependencies: {}` silently stops
meaning anything and only the declined Biome `noRestrictedImports` rule would survive.
Verified 2026-08-14 that `convex dev --once` accepts a `workspace:*` package in both its
bundle and typecheck paths.

**Transfers to workouts: the mechanism yes, the instance needs a decision.** The
`convex/_generated` relative-import rule and "don't move `convex/`" both transfer directly
and match constraint 1 on the map (`src/` and `convex/` stay put). The pnpm-isolated-linker
argument is exactly as valid here. **But the map's constraint 4 is the sharp edge**: a
private in-repo `packages/core` can never reach gather or any other Appelent app, and
ADR-0016 is explicitly about sharing *within one repo*. The verified fact that Convex
accepts a `workspace:*` package is a free de-risking for workouts. Note also the ADR's
warning that the isolated linker is what makes the whole thing work — workouts'
`pnpm-workspace.yaml` currently has **no `packages:` key at all**, so adding
`packages: ["apps/*", "packages/*"]` is a prerequisite for either option.

### ADR-0017 — "The phone owns its look and shares its words" (accepted 2026-08-13)

**Summary.** The phone defines its own visual identity: own palette, own type, own layout;
shared words, shared domain unions, shared tints. Styling is a typed token module consumed
by `StyleSheet` (option A of four surveyed). **Unistyles 3** lost on delivery path (needs
Nitro Modules → no Expo Go → every iOS install via EAS from a Windows machine that cannot
build iOS) — "the right library for a different machine." **NativeWind v5** lost on
stability: its own docs say not for production, and 5 of `MobileDock`'s 19 utilities fail
*silently* — "A class string that transfers 74% of the time with no diagnostic is a worse
foundation than one that transfers 0% and says so." `@expo/ui` Universal components for
settings chrome; RN `TextInput` for auth fields. Platform type only. Three-state
light/dark/system via `Appearance.setColorScheme()` + `expo-sqlite/kv-store`, requiring
`userInterfaceStyle: "automatic"`. `useTokens()` returns colours, not conditions. lucide via
deep imports; `expo-symbols` and `@expo/vector-icons` dropped. Token split: tints in core,
neutrals/radii/accent/icon-map on the phone. Reopening triggers: NativeWind 5 going stable,
a Mac or routine EAS builds, or the web adopting the tinted catalogue.

**Transfers to workouts: strongly, with one substitution.** Every mechanism transfers —
the `useTokens()` shape, the `StyleSheet`-layout/inline-colour idiom, the
`Appearance.setColorScheme` + synchronous-kv-store dark mode, the `NativeChrome` triple,
the lucide deep-import rule, the platform-type decision. Two caveats. (a) The **library
choice** was decided by facts that may differ here: workouts should re-check whether
NativeWind v5 has reached a stable `latest`, and whether the delivery path is still
Expo-Go-from-Windows. If both facts hold, the same answer follows for the same reasons.
(b) The **accent rule** ("the accent is the colour of what you are looking at") is
gather-specific — it exists because gather's identity *is* a 13-Module tinted catalogue.
workouts has one accent (`#1DB954`) and no module groups; `useTokens()` should just return
it, and `tintOf()` has no analogue. The `oklch()` finding does transfer directly: workouts'
`src/styles.css` custom properties cannot be ported to RN as-is either.

### ADR-0018 — "Mobile tabs are app destinations, and one of them is a verb" (decided 2026-08-16, not yet implemented)

**Summary.** The bar stops promoting three Modules and names five app-level destinations:
Home / Search / **Add** / Profile / All. Add is a verb, so it is a `NativeTabs.Trigger`
with `disabled` — visible, native selection suppressed, `tabPress` still emitted — opening
a sheet over wherever you were. Load-bearing empirical fact: on device the disabled item
does **not** read as dimmed; if a future SDK dims it, the decision reopens and the fallback
is a floating pill. Each Module declares the *kind* of its own quick action —
`row` (grows a field in place) / `sheet` (body swaps) / `handoff` (closes and pushes the
Module's create surface) — "Without `kind` the shell picks one behaviour, every action is
dragged to the slowest one's, and Add stops being a quick add." And: Profile owns its own
stack, because utility screens that eject you from the bar punish using the bar. Five is
Android's ceiling; a sixth destination is not an option.

**Transfers to workouts: partially — the mechanism transfers, the information architecture
does not.** gather is a 13-Module catalogue with a Group-scoped shell; workouts is a
single-purpose app. The `kind`-per-Module registry has no analogue. What *does* transfer,
and is directly on the critical path for map constraint 2 (start session → add exercise →
log sets → finish):

- **The `disabled`-trigger technique** is exactly how a "Start workout" verb could sit in
  the bar without being a destination — and the map's V1 loop is verb-shaped.
- **"Profile owns its own stack"** generalises to: any tab with pushed screens under it
  needs its own stack, and retrofitting one means re-pointing every link inside the screens
  that move.
- **"A screen still sits behind the slot… landing on it is a bug"** is a trap worth knowing
  in advance.
- **The rejected alternatives are pre-paid research** — do not re-evaluate a hand-drawn
  bar; the list of what you lose with the real `UITabBarItem` is enumerated.

Given ADR-0018 is *not yet implemented* in gather, workouts cannot copy shipped code for
it — only the reasoning.

---

## 7. EAS setup and private-registry workarounds

`apps/mobile/eas.json` in full:

```json
{
  "cli": { "version": ">= 16.0.1", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal",
                     "autoIncrement": true, "environment": "development",
                     "env": { "SHARP_IGNORE_GLOBAL_LIBVIPS": "1" },
                     "android": { "buildType": "apk" } },
    "preview":     { "distribution": "internal", "autoIncrement": true,
                     "environment": "preview",
                     "env": { "SHARP_IGNORE_GLOBAL_LIBVIPS": "1" } },
    "production":  { "autoIncrement": true, "environment": "production",
                     "env": { "SHARP_IGNORE_GLOBAL_LIBVIPS": "1" } }
  }
}
```

There is no `submit` block — consistent with the map's "store release is out of scope".
`appVersionSource: "remote"` + `autoIncrement` on all three profiles means EAS owns build
numbers. `environment: development|preview|production` selects an **EAS-hosted** env-var
set, which is where `EXPO_PUBLIC_*` values come from for cloud builds (`.env.local` is
local-only).

`SHARP_IGNORE_GLOBAL_LIBVIPS: "1"` on every profile is a **monorepo artefact**: EAS installs
the whole workspace, and gather's root devDependencies include `sharp` (for the web's
icon generation). It is not mobile's dependency; the env var stops EAS's build image from
trying to link a global libvips.

### The private-`@appelent`-scope workaround, in two halves

**Half 1 — the hook**, an `apps/mobile/package.json` script EAS runs by convention:

```json
"eas-build-pre-install": "echo \"//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\" >> ~/.npmrc"
```

with `NODE_AUTH_TOKEN` supplied as an EAS secret. (Identical line to the one gather's
`ci.yml` runs, and the one workouts' `CLAUDE.md` documents for local installs.)

**Half 2 — `verifyDepsBeforeRun: false`** in the root `pnpm-workspace.yaml`, with the
comment that is the whole reason it exists:

> pnpm 11 auto-installs before running any script when `node_modules` looks stale. That is
> convenient locally and fatal on EAS Build: EAS authenticates to our private `@appelent`
> scope from an `eas-build-pre-install` hook, and the auto-install fires *before* the hook
> body, so the install that needs the token runs without one. Under pnpm 11.8 the resulting
> 401 is then reported as `ERR_PNPM_TARBALL_URL_MISMATCH` — it accuses the lockfile of
> tampering rather than naming the auth failure (pnpm/pnpm#12489, fixed in 11.9).
> Retire this when the pin reaches 11.9+ *and* EAS auth no longer depends on a pre-install
> hook; until both hold, turning it off is what makes iOS builds possible at all. The cost
> is that `pnpm run <script>` no longer installs for you when dependencies are stale — run
> `pnpm install` yourself.

**workouts is on `pnpm@11.8.0`, the exact affected version.** Both halves will be needed.

Third, smaller item: gather's `allowBuilds` gained `browser-tabs-lock: false` — "postinstall
just prints a SuperTokens plug, no native binary (**pulled in by `@clerk/expo`**)" — plus
`bufferutil`, `utf-8-validate` and `dtrace-provider` (all `false`; optional native
accelerators pulled in by `ws`/EAS CLI). workouts' `allowBuilds` will need the same entries
or `pnpm install --frozen-lockfile` fails non-interactively with `ERR_PNPM_IGNORED_BUILDS`.

`app.json` items worth copying: `scheme: "gather"` (deep links),
`userInterfaceStyle: "automatic"` (required by the dark-mode mechanism),
`experiments: { typedRoutes: true }`, `owner: "appelent"`, `extra.eas.projectId`,
`ios.infoPlist.ITSAppUsesNonExemptEncryption: false` (skips the export-compliance prompt),
and plugins `["expo-router", "expo-system-ui", "expo-font", "expo-web-browser",
"expo-image", ["expo-splash-screen", {…}], "@clerk/expo", "expo-secure-store",
"expo-localization", "expo-sqlite"]`.

Recorded operational fact: **`expo-sqlite` and `expo-secure-store` are native modules — the
dev client must be rebuilt when either is added.** Expo Go bundles both.

---

## Extraction candidates

Everything below is something gather has that workouts will also want. The tag is a
finding about *where the thing can live*, given that `packages/core` is `private: true` and
therefore structurally unable to cross repos, while published `@appelent/*` can. **These
are candidates, not decisions — #43 decides.**

### Belongs in a published `@appelent/*` package

| Thing | gather location | Why published, not local |
| --- | --- | --- |
| **Appearance rule** (`APPEARANCE_PREFERENCES`, `appearancePreference()`, `resolveScheme()`) | `packages/core/src/appearance.ts` | 35 lines, zero imports, zero gather nouns, and it must agree with `@appelent/auth`'s web `ThemeMode` (`'light'\|'dark'\|'auto'` vs `'light'\|'system'\|'dark'`). gather already flagged that mismatch and shrugged because the values never meet; a third app makes it meet. This is the cleanest single extraction in the whole repo. |
| **Pure i18n helpers** (`isLocale`, `resolveLocale`, `fmt`, `plural`) | `packages/core/src/i18n.ts` | ADR-0016 documents gather's web *leaving* `@appelent/i18n` for these because the package has no DOM-free entry. That's a package defect, not a gather quirk. A `@appelent/i18n/core` subpath (or an `@appelent/i18n-core`) fixes it for gather, workouts mobile, and anything else that meets Hermes — and closes AppElent/appelent-packages#16 (unguarded `Intl.PluralRules`) in the same move. Highest-leverage item on this list. |
| **Expo Clerk wiring conventions** — the `pk_test_` dev-login gate, the static-dot-access `EXPO_PUBLIC_*` reads, `clerkErrors.ts`'s code→message map, and `pickError`'s signal-over-wrapper rule | `apps/mobile/src/auth/*` | `@appelent/auth` already owns exactly these three things for the web (`clerkErrorMessage()`, the dev-login button, the test-key gate) and is Core 2 / React-DOM-only. An `@appelent/auth-expo` (or a `/expo` subpath) is where the Core 3 twin goes. Without it, every Appelent app that ships a phone rewrites the same error map and re-learns the `finalize()` and wrapper-error traps. Note ADR-0014's end condition already anticipates this via appelent-packages#15. |
| **`AvailabilityMode` resolver** (`resolveAvailability`, the five modes, the splash timeout) | `apps/mobile/src/availability/state.ts` + `AvailabilityProvider.tsx` | Pure function over `{clerkLoaded, clerkStatus, signedIn, splashExpired, serviceConnected, serviceEverConnected}` — no gather nouns anywhere. It encodes the genuinely hard-won distinction between "still starting", "confirmed signed out" and "the service went away", which every Clerk+Convex app has and most get wrong. Also: it currently has a `state.test.ts` no configured Vitest project runs — publishing it gets it tested for free. |
| **The Clerk-guard-vs-Convex-guard rule** (guards follow the session, writes follow the token) | comments in `(app)/_layout.tsx` + `useEnsureUser.ts` | Not code — a documented trap that already bit gather's web ("the web learned this the hard way"). Belongs as prose in whichever `@appelent/*` package owns the auth wiring, or in the Appelent feature catalog, so it is not re-learned per app. |
| **`eas-build-pre-install` + `verifyDepsBeforeRun: false`** | `apps/mobile/package.json` script + root `pnpm-workspace.yaml` | Two lines and a paragraph, but they are the difference between iOS builds working and an `ERR_PNPM_TARBALL_URL_MISMATCH` that accuses the wrong thing. Not a *package* — it belongs in the Appelent **feature catalog** (an `expo` or `eas` feature), which is the mechanism that reaches every app the way a package reaches every dependency. Same for the `allowBuilds` entries `@clerk/expo` drags in. |

### App-specific, reimplement

| Thing | gather location | Why not shared |
| --- | --- | --- |
| **Theme tokens** (`BASE` neutrals, `RADIUS`, `useTokens`, `Tokens`) | `apps/mobile/src/theme/tokens.ts` | ADR-0017's entire point: the phone owns its look. gather's warm greys are gather's; workouts is a Spotify-dark app with a green accent. The ~60-line *shape* is worth copying by hand; the values must not be shared. Also: a colour that drifts drifts on screen, where a human sees it — the low-risk half of gather's own core criterion. |
| **`NativeChrome` / `navigationTheme()`** | `apps/mobile/src/theme/NativeChrome.tsx` | It's ~40 lines that map *your* palette onto expo-router's six-colour `Theme`. Genuinely generic in structure and entirely determined by the app's tokens — a package would take a token object and return a theme, which is not worth a dependency. Copy the file, keep the header comment (it names three bugs). |
| **`icons.ts` deep-import map** | `apps/mobile/src/theme/icons.ts` | The *rule* ("deep import `lucide-react-native/icons/<kebab>`; the barrel is as bad as the star") is a one-line convention for CLAUDE.md. The map itself is a list of the icons this app uses. |
| **`MODULE_TINTS`** | `packages/core/src/moduleTints.ts` | Keyed by `ModuleGroup`, a gather union. workouts has no module groups. The pattern (`satisfies Record<ColorScheme, Record<DomainUnion, Tint>>`) is worth remembering if workouts ever tints by muscle group; the data is not. |
| **`SHELL_TABS` + `(tabs)/_layout.tsx`** | `apps/mobile/src/shell/` | The 25-line `NativeTabs` layout is boilerplate worth copying verbatim; the tab set is an IA decision per app. The transferable part is the *type discipline*: derive `SFSymbolName`/`MaterialSymbolName` from `expo-router`'s own props so a bad symbol fails at the table, not at the layout. |
| **`packages/core/src/{modules,pins,groups,domain,messages}`** | `packages/core` | gather domain, as the map already assumed. `groups.ts`'s `pending \| none \| ready` selection shape is a good idea to steal; `landingGroupSlug`/`selectGroup` are about Groups, which workouts does not have. |
| **`localPreference.ts`** (`expo-sqlite/kv-store`, namespaced keys, best-effort try/catch) | `apps/mobile/src/prefs/` | 40 lines wrapping three calls. Not package-worthy on its own — but the *choice* (synchronous kv-store over AsyncStorage/MMKV, because the first frame after cold start must be correct) is a decision to record, and the namespacing convention (`app:key`) is worth keeping. If the appearance rule above gets published, this stays the app-side adapter behind it. |
| **`useHideSplash` + the hold-the-splash cold-start dance** | `apps/mobile/src/useHideSplash.ts` + `app/_layout.tsx` | Ten lines each and entangled with the app's specific first-screen set. The reasoning (`onLayout` not `useEffect`; every possible-first screen calls it; `hideAsync()` twice is a no-op) is documentation, not a package. |
| **Auth screens and `AuthField`/`AuthScreen`/`AuthButton`/`AuthError`/`AuthLink`** | `apps/mobile/src/components/` | These are styled with the app's own tokens, so they cannot cross without dragging the palette with them — the same seam that stops `@appelent/auth`'s DOM components from crossing. The *logic* underneath (`usePasswordSignIn`, `clerkErrors`) is the publishable half; the views are not. |
| **ADR-0018's Add-tab launcher and `kind` registry** | ADR only, unimplemented | Per-Module quick-action kinds presuppose a Module registry. workouts has one verb ("start a workout"), so the `disabled`-trigger technique transfers and the registry does not. |

### Cross-cutting note for #43

The two options are not symmetric in one respect worth stating: gather's `packages/core`
exists to serve **two clients in one repo**, and `dependencies: {}` is what makes that
boundary real. A published `@appelent/*` package gets the boundary for free (it is a
different repo), but pays a release cycle per change and — per ADR-0014's reasoning about
`@appelent/auth`'s peer dependency — a breaking change there is a breaking change for
every consuming app. gather chose local for things that change with gather's domain
(modules, pins, messages) and would have chosen published for things that don't
(the appearance rule, the i18n helpers) had a published home existed. The list above is
sorted on exactly that criterion.
