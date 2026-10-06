---
version: 1.0.0
description: Implement typed application-owned localization across web and native targets.
---

# Internationalization

Keep dictionaries, glossary, supported languages, and UI controls in the app. Use the [core helpers](examples/core.ts) and only the adapters needed by the target: [web provider](examples/index.tsx), [TanStack SSR](examples/server.ts), [optional Clerk sync](examples/clerk-sync.tsx), or [native provider](examples/native.tsx). Copy selected files together into an app-owned runtime directory, preserving their relative imports. No @appelent/i18n dependency is required.

## Dictionaries and provider

Small dictionaries can remain inline initially; split by feature when they grow:

```ts
const en = { actions: { save: 'Save' }, welcome: 'Hello {name}' };
const nl = { actions: { save: 'Opslaan' }, welcome: 'Hallo {name}' } satisfies typeof en;
const locales = ['en', 'nl'] as const;
const messages = { en, nl };
```

Do not freeze the dictionary with `as const` if using literal values as the target-language type. Initialize the copied createI18n factory once:

```tsx
const { LocaleProvider, useI18n, readClientLocale } = createI18n({
  locales, fallback: 'en', messages,
});
// In a component:
const { messages: copy } = useI18n();
return <button>{copy.actions.save}</button>;
```

Use fmt for placeholders and plural for count forms. Add translated accessible names, placeholders, titles, toasts, empty/error states, and canvas labels. Keep user-authored content distinct from application UI copy. Pure domain modules accept needed messages as arguments; they must not import React hooks.

## Web and native

For SSR resolve the request's explicit language cookie, Accept-Language, then fallback using the server adapter. Pass that same locale to the initial provider and html lang to avoid hydration mismatch. On browser navigation use the client resolver without an unnecessary server round trip. Keep server adapter imports out of client-only modules. Put the provider around app content; preserve the framework's document/scripts placement.

The language control is app-owned. Use explicit labels for each available language rather than a hardcoded two-language toggle when more locales are supported. Optional Clerk metadata sync must not override an explicit local choice; inspect the copied adapter's contract.

Native code imports only the native/core examples, supplies device locales and storage adapters, and starts with a synchronously available locale. Verify persistence, startup hydration, and user switching. Keep DOM/SSR/Clerk-web imports out of native bundles.

## Verification

Copy [message-parity test support](examples/test-utils.ts) into test-only code and call it from a Vitest test:

```ts
assertMessageParity({ en, nl });
```

It checks key sets, empty values, and placeholder parity. Do not import it into production code. Run types and tests after every extraction, then verify layouts, long translations, language persistence, SSR refresh, and supported native targets. A new locale requires a complete dictionary and language-control label.

## Migration

Inventory @appelent/i18n and subpath imports, copy the needed runtime adapters, redirect imports locally, and keep the app's existing dictionary shape and cookie/storage names. Port its parity tests before removing the package. Existing apps can keep their tested implementation; compare fixes in these examples deliberately rather than overwriting it during toolkit sync.

For advanced pluralization, translator/TMS workflows, or richer formatting requirements, evaluate an established localization library. This small dictionary approach is an explicit app choice, not a requirement for every project.
