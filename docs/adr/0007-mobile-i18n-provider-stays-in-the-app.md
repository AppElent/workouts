# Keep the phone's i18n provider in the app, and share only the pure helpers

`apps/mobile` had no internationalization at all: every string in every screen was an English literal. Nutrition ships bilingual chrome in v1, so the phone needed a provider. The pure helpers — `isLocale`, `resolveLocale`, `fmt`, `plural` — come from `@appelent/i18n/core`, the DOM-free subpath of the package the web app already depends on. Everything React Native about the mechanism stays in `apps/mobile/src/i18n`: the message trees, the locale state, the device-locale resolution, and the persistence.

We chose this split because the helpers are the part with a single correct implementation and the provider is the part that is entirely about the platform. `@appelent/i18n`'s package root reaches for `document.cookie` and `navigator.language` and throws on React Native, but `/core` is DOM-free and already carries the guard that keeps `plural` working on a Hermes build without `Intl.PluralRules`. Reimplementing those four functions in the app, or copying them into `@workouts/core`, would duplicate code the organization already ships and would leave two places for the Hermes guard to be forgotten.

**A publishable `@appelent/i18n/native` is deliberately not built here.** Issue #49 asked for that question to be answered rather than implemented, and the answer is *not yet*: one app is not enough evidence to fix an API, and the provider is about a hundred lines that a second app would want to disagree with in at least two places. Revisit when a second React Native app in the organization needs the same provider — that is the point at which the shared shape is knowable.

The locale is persisted with `expo-sqlite/kv-store`, read synchronously through `getItemSync` during the first render. This is the load-bearing detail: the first frame after a cold start has to be in the language the person chose, and any awaited read paints one frame in a language they have already rejected. It is also why `expo-secure-store`, which the app already depends on for Clerk's token cache, cannot be used — it offers no synchronous read.

The provider is mounted outside Clerk and Convex, and the switch itself lives behind Profile → Preferences → Language rather than on the sign-in screen. Language is a property of the phone, not of the account: it has to apply while the session is still resolving and while the backend is unreachable, and a signed-out person has stated no preference, so the device decides for them.

## Considered options

- **Copy the four helpers into `@workouts/core`** — rejected: it duplicates a package the organization already publishes and uses, and `@workouts/core`'s single-entry tsup build would need a new subpath to carry them.
- **Reimplement the helpers inside `apps/mobile`** — rejected: cheapest to start and worst to maintain; the Hermes plural guard is exactly the kind of detail that gets lost in a private copy.
- **Publish the provider as `@appelent/i18n/native` now** — rejected for this spec: one consumer is not enough to fix an API, and the decision is reversible in either direction later.
- **Persist the locale in `expo-secure-store`** — rejected: it has no synchronous read, which makes a wrong-language first frame unavoidable.
- **Put the language switch on the sign-in screen** — rejected: it is an app-wide setting, and the front door is not where settings live.
