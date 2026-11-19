---
type: runbook
description: Read when enabling, configuring, or debugging Apple, Google, or Microsoft sign-in on the shared Appelent Clerk application.
version: 2.3.4
---

# Social sign-in

Web and mobile offer "Continue with Apple / Google / Microsoft". The code is
always on; whether a provider works depends on the Clerk instance.

All Appelent apps share **one Clerk application** on `appelent.nl`. Provider
credentials, sign-up requirements, and the redirect URI are therefore
instance-wide: configure each provider once, brand it as Appelent, and add
only the per-app entries (bundle ID, mobile redirect) when a new app joins.
Provider settings live in Clerk, not `env.manifest.ts`. The one exception is
the Apple revocation key below.

## Prerequisites

- Admin access to the Appelent Clerk application (development and production
  instances).
- Apple Developer account, Google Cloud project, Microsoft Entra tenant.

## Project facts

| Fact | Value |
| --- | --- |
| Clerk redirect URI, production (all providers, all apps) | `https://clerk.appelent.nl/v1/oauth_callback` |
| Clerk redirect URI, development | `https://calm-cricket-82.clerk.accounts.dev/v1/oauth_callback` |
| Consent-screen branding | `Appelent` |
| Provider availability | `socialSignInProviders` in `packages/core/src/auth.ts` |
| Web provider buttons | `SOCIAL_PROVIDERS` in `src/lib/auth/SocialButtons.tsx` |
| Web callback route | `/sso-callback` (`src/routes/sso-callback.tsx`) |
| Mobile provider buttons | `apps/mobile/src/auth/social-buttons.tsx` |
| Foundry bundle IDs | `com.appelent.foundry`, `.preview`, `.dev` ([install variants](#install-variants)) |
| Foundry mobile redirects | `foundry://`, `foundry-preview://`, `foundry-dev://` + `sso-callback` |
| Apple primary App ID | `com.appelent.foundry` (other apps group under it) |
| Apple Services ID | `nl.appelent.web` |
| Apple on iOS | Native sheet; Android and web use the browser OAuth flow |
| Web PR preview deploys | Clerk development instance (Infisical `staging` references the `dev` values); unaffected |
| EAS builds → Clerk instance | `development` → development; `preview` and `production` → production |

Google is offered only by builds on the development Clerk instance (a
`pk_test_` publishable key), because only that instance has working Google
credentials. Web and mobile share the rule through `socialSignInProviders`;
add Google to its production list once production has its own Google OAuth
client.

Email-code sign-in ("Email me a sign-in code") needs **Email verification code**
enabled as a sign-in option under **User & authentication → Email**; it is on
for both instances.

Foundry's web app must be served from a subdomain of `appelent.nl`. Any other
domain needs a Clerk satellite domain first.

## Steps

Shared setup happens once per Clerk instance. Development instances can skip
steps 2–4 by leaving **Use custom credentials** off (Clerk's shared
credentials); production needs them.

### 1. Clerk instance

1. **Configure → SSO connections → Add connection → For all users**: add
   Google, Microsoft, and Apple.
2. **Configure → User & authentication**: keep every sign-up field providers
   do not supply (username, phone, legal acceptance) optional. A required one
   blocks first-time social sign-up in every app; mobile then shows "Finish
   signing up on the web".

### 2. Google

1. Google Cloud → **APIs & Services → OAuth consent screen**: External, app
   name `Appelent`, support and developer emails, authorized domain
   `appelent.nl`, default scopes (`openid`, `email`, `profile`). **Publish**
   it; in Testing mode only listed test users can sign in.
2. **Credentials → Create credentials → OAuth client ID**: type Web
   application, name `Appelent (Clerk)`, authorized redirect URI = the Clerk
   redirect URI.
3. Paste the Client ID and Client secret into Clerk's Google connection.

### 3. Microsoft

1. Entra → **App registrations → New registration**: name `Appelent`,
   account types **any organizational directory and personal Microsoft
   accounts**, redirect URI platform Web = the Clerk redirect URI.
2. Copy the **Application (client) ID** from Overview.
3. **Certificates & secrets → New client secret**, 24-month expiry. Copy the
   **Value** (shown once), not the Secret ID. Record the expiry date with a
   reminder: an expired secret silently breaks Microsoft sign-in in every app.
4. **Token configuration → Add optional claim → ID**: `email` and `xms_edov`,
   so Clerk can trust the email as verified.
5. Paste the Client ID and secret into Clerk's Microsoft connection.

### 4. Apple

In **Certificates, Identifiers & Profiles**:

1. Note the 10-character **Team ID** (Membership details).
2. **Identifiers → `com.appelent.foundry`**: enable Sign in with Apple as the
   **primary App ID**.
3. **Identifiers → + → Services IDs**: `nl.appelent.web`, description
   `Appelent Web`. Enable Sign in with Apple → Configure: primary App ID
   `com.appelent.foundry`. Add both instances to the same Services ID:
   domains `clerk.appelent.nl` and `calm-cricket-82.clerk.accounts.dev` (no
   scheme), and both redirect URIs from Project facts as return URLs. Save.
4. **Keys → +**: `Appelent Sign in with Apple`, enable Sign in with Apple
   against the primary App ID. Note the **Key ID** and download the `.p8`
   (one download only).
5. Clerk's Apple connection: Services ID `nl.appelent.web`, Team ID, Key ID,
   and the full `.p8` contents including the BEGIN/END lines.

Optional: to deliver mail to "Hide My Email" addresses
(`@privaterelay.appleid.com`), register the sending domain under **Services →
Sign in with Apple for Email Communication**.

### 5. Register Foundry's native app (both instances)

**Configure → Native applications** in Clerk, for each
[install variant](#install-variants) that uses the instance:

1. iOS: App ID Prefix = Team ID, Bundle ID. Native Apple sign-in needs this
   even with shared development credentials.
2. Android: package name.
3. Allowlist for mobile SSO redirect: `<scheme>://sso-callback`.

### Install variants

Production, preview and development builds are separate apps
([mobile releases](mobile-releases.md#install-variants)). Each needs:

| Variant | Bundle ID / package | Redirect | Clerk instance |
| --- | --- | --- | --- |
| Production | `com.appelent.foundry` | `foundry://sso-callback` | production |
| Preview | `com.appelent.foundry.preview` | `foundry-preview://sso-callback` | production |
| Development | `com.appelent.foundry.dev` | `foundry-dev://sso-callback` | development |

In Apple Developer, register `com.appelent.foundry.preview` and
`com.appelent.foundry.dev` with Sign in with Apple, **grouped with**
`com.appelent.foundry`. EAS registers missing App IDs on the first build, but
does not group them. The preview variant has its own App Store Connect app, "Foundry Preview"
(`6824221239`, `submit.preview.ios.ascAppId` in `eas.json`); development
needs none. TestFlight testers must accept that app's invite separately.

### 6. Ship a native build

The Apple entitlement and SSO packages change the runtime fingerprint; an OTA
update does not carry them.

```sh
cd apps/mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

Repeat with the `production` profile through the normal release flow.

### Adding another Appelent app

Only these are per app; everything above is already shared:

1. Its App ID: enable Sign in with Apple, **Group with an existing primary App
   ID** → `com.appelent.foundry`. Grouping keeps one Apple identity and relay
   email per person across apps.
2. Clerk → Native applications: its iOS bundle ID and its
   `<scheme>://sso-callback` redirect.
3. Its web app on an `appelent.nl` subdomain, or a satellite domain.

## Apple token revocation

Apple requires apps that offer Sign in with Apple to revoke the user's Apple
grant when the account is deleted. Clerk does not do this, so Foundry does,
only for Delete my whole AppElent account; Delete Foundry data only keeps the
AppElent login and never touches Apple:

1. On iOS, Delete account opens the native Apple sheet once more for an
   Apple-linked account (`apps/mobile/src/features/profile/apple-revocation.ts`).
   Dismissing the sheet cancels the deletion.
   On the web, it opens an Apple JS popup for the Services ID
   (`src/lib/auth/appleRevocation.ts`), but only from an origin whose
   `<origin>/account` is in `APPLE_WEB_RETURN_URLS`
   (`packages/core/src/auth.ts`). Closing the popup cancels the deletion.
2. Convex `account.revokeAppleSignIn` exchanges the code at Apple's
   `/auth/token` (a web code with its return URL) and revokes the refresh
   token at `/auth/revoke`. For a web code it first refuses while the
   deletion blocker applies, then reads the caller's Apple accounts from
   `appleSignInLinks`, which Clerk's signed `user.created`/`user.updated`
   webhook (`POST /clerk/webhook`) keeps in sync; it revokes only when the
   `sub` of Apple's ID token is one of them. Otherwise nothing is revoked,
   the action fails with `appleAccountMismatch`, and the card stops the
   deletion.
3. Any other failure is reported to Sentry, and the account is deleted anyway.

The action signs Apple's client secret with the Sign in with Apple key from
Infisical (`apple-team-id`, `apple-sso-key-id`, `apple-sso-key-value`).
`pnpm env:apply <environment> --only convex` lands them as `APPLE_TEAM_ID`,
`APPLE_SIGN_IN_KEY_ID` and `APPLE_SIGN_IN_PRIVATE_KEY`. Without them the action
fails with `unavailable`. No Clerk admin key is on Convex: without a mirrored
Apple link a web code is never exchanged and the action fails with
`appleAccountMismatch`.

Native codes are issued to the requesting build's bundle ID, so the app sends
it and Convex uses it as `client_id` after checking it against
`APPLE_CLIENT_IDS` in `convex/lib/appleSignIn.ts`.
Android has no native sheet, so an Apple-linked account deleted there is not
revoked.

### Enabling web revocation

Apple JS shows its popup only for a domain and return URL registered on the
Services ID, so web revocation is off until both are added. For each web
origin (production `https://foundry.appelent.nl`, optionally staging):

1. Apple Developer → Identifiers → `nl.appelent.web` → Sign in with Apple →
   Configure: add the host (for example `foundry.appelent.nl`) under Domains
   and `https://foundry.appelent.nl/account` under Return URLs. Keep the Clerk
   entries. Save.
2. Add the same URL to `APPLE_WEB_RETURN_URLS` in `packages/core/src/auth.ts`
   and deploy web and Convex together.

No new secret should be needed if the existing Sign in with Apple key is valid
for the Services ID's primary App ID. Check this first: `nl.appelent.web` is
shared by every Appelent web app, and Apple groups consent by the primary App
ID. Revoking from Foundry ends the grant for that whole group. That could sign
the person out of Sign in with Apple in other Appelent apps, or leave
Foundry's iOS grant in place if the Services ID is grouped under another app.
Confirm the grouping in Apple Developer and decide whether that reach is
acceptable before adding a return URL. Web Apple sign-in on the development
Clerk instance with Clerk's shared credentials has another Apple team's user
ID, so the popup's account never matches and nothing is revoked there.

The browser checks the popup's `state` and Apple account. Convex checks again
before it exchanges or revokes anything: the caller is signed in, the return
URL is registered, the deletion blocker does not apply, and the code's Apple
user (`sub` of the ID token from Apple's token endpoint, with Apple as issuer
and the Services ID as audience) is one of the caller's mirrored Apple links.
Native codes are not bound to the caller yet: installed apps would refuse
every account whose link is not mirrored.

Before the return URL goes live:

1. Clerk (production) → Webhooks → the Foundry endpoint
   `<convex-site-url>/clerk/webhook` (the one `user.deleted` uses): also
   subscribe `user.created` and `user.updated`.
2. Backfill logins linked before that, since signing in does not send
   `user.updated`. Locally, with the production Clerk secret key given to this
   one command only:
   `CLERK_SECRET_KEY=sk_live_… node scripts/backfill-apple-links.mjs` (dry
   run, counts only), then the same with `--apply -- --prod`. It is safe to
   repeat; a newer webhook delivery always wins.
After deploying, test in Safari that the card asks for one more click before
Apple's popup opens, and that Clerk asks to confirm the sign-in again when
Apple's step takes longer than the card's 5-minute sign-in check. The dev
Clerk instance cannot test this end to end (see above), so the first full run
is on production.

## Verify

- Web: each button lands on `/dashboard`; an unknown email creates an
  account; the consent screen says Appelent.
- iOS build: Apple shows the system sheet and returns signed in.
- Google and Microsoft on mobile: in-app browser opens, closes, signed in.
- Cancelling any flow returns to the form without an error.
- Account deletion (iOS, Apple-linked account): after Delete account, Foundry
  disappears from Settings → Apple ID → Sign in with Apple.
- Account deletion (web, production, once `APPLE_WEB_RETURN_URLS` lists it):
  Delete account opens the Apple popup; afterwards Foundry disappears from
  account.apple.com → Sign in with Apple. Closing the popup keeps the account.

## Troubleshooting

- Web button errors immediately, e.g. "oauth_microsoft does not match one of
  the allowed values for parameter strategy": provider not enabled on that
  Clerk instance (check development and production separately).
- Apple shows "invalid_request — Invalid web redirect url": that instance's
  domain and redirect URI are missing from the Services ID.
- Google "access blocked" or limited to test users: consent screen still in
  Testing mode.
- Microsoft rejects personal accounts: registration's account types exclude
  personal Microsoft accounts.
- Web Delete account says the Apple account is not the one linked, though
  it is: Convex has no mirrored Apple link for that login. Check that the
  Clerk webhook subscribes `user.created` and `user.updated` and delivers
  (Clerk → Webhooks → attempts), then rerun the backfill. Nothing was
  deleted or revoked.
- Web Delete account says "Allow pop-ups for this site": the browser blocked
  Apple's revocation popup, often in Safari when the Account page was opened
  moments before. Allowing pop-ups or retrying once Apple JS has loaded fixes
  it; nothing was deleted.
- Microsoft stops working everywhere: client secret expired; create a new one
  and update Clerk.
- Mobile button fails at once with "Redirect url mismatch" (often on a
  `preview` build, which uses production): step 5 was skipped on that
  instance.
- Mobile browser returns but stays signed out, or opens another Foundry
  variant: that variant's `<scheme>://sso-callback` is missing from the
  mobile redirect allowlist, or an OTA update was published without its
  `APP_VARIANT`.
- Mobile shows "Finish signing up on the web": a required sign-up field the
  provider does not supply; make it optional.
- Apple sheet fails on iOS: build predates `usesAppleSignIn`, or the bundle ID
  is not under Clerk's Native applications.
- Same person gets a different Apple relay email per app: the app's App ID is
  not grouped under the primary App ID.
