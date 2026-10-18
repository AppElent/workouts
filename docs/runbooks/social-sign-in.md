---
type: runbook
description: Read when enabling, configuring, or debugging Apple, Google, or Microsoft sign-in on the shared Appelent Clerk application.
version: 2.1.0
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
| Web provider list | `AUTH_CONFIG.socialProviders` in `src/routes/__root.tsx` |
| Web callback route | `/sso-callback` (`src/routes/sso-callback.tsx`) |
| Mobile provider list | `SOCIAL_PROVIDERS` in `apps/mobile/src/auth/useSocialSignIn.ts` |
| Foundry iOS bundle ID | `com.appelent.foundry` |
| Foundry mobile redirect | `foundry://sso-callback` |
| Apple primary App ID | `com.appelent.foundry` (other apps group under it) |
| Apple Services ID | `nl.appelent.web` |
| Apple on iOS | Native sheet; Android and web use the browser OAuth flow |
| Preview deploys | Separate Clerk test instance; unaffected |

Google is gated to local development (`import.meta.env.DEV` on web, `__DEV__`
on mobile) because only the development instance has working Google
credentials. Remove both gates once production has its own Google OAuth client.

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

**Configure → Native applications** in Clerk:

1. iOS: App ID Prefix = Team ID, Bundle ID = `com.appelent.foundry`. Native
   Apple sign-in needs this even with shared development credentials.
2. Allowlist for mobile SSO redirect: `foundry://sso-callback`.

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
grant when the account is deleted. Clerk does not do this, so Foundry does:

1. On iOS, Delete account opens the native Apple sheet once more for an
   Apple-linked account (`apps/mobile/src/features/profile/apple-revocation.ts`).
   Dismissing the sheet cancels the deletion.
2. Convex `account.revokeAppleSignIn` exchanges the code at Apple's
   `/auth/token` and revokes the refresh token at `/auth/revoke`.
3. Any other failure is reported to Sentry, and the account is deleted anyway.

The action signs Apple's client secret with the Sign in with Apple key from
Infisical (`apple-team-id`, `apple-sso-key-id`, `apple-sso-key-value`).
`pnpm env:apply <environment> --only convex` lands them as `APPLE_TEAM_ID`,
`APPLE_SIGN_IN_KEY_ID` and `APPLE_SIGN_IN_PRIVATE_KEY`. Without them the action
fails with `unavailable`.

Native codes are issued to the bundle ID, so `client_id` is
`com.appelent.foundry` (`APPLE_CLIENT_ID` in `convex/lib/appleSignIn.ts`).
Android has no native sheet, so an Apple-linked account deleted there is not
revoked.

## Verify

- Web: each button lands on `/dashboard`; an unknown email creates an
  account; the consent screen says Appelent.
- iOS build: Apple shows the system sheet and returns signed in.
- Google and Microsoft on mobile: in-app browser opens, closes, signed in.
- Cancelling any flow returns to the form without an error.
- Account deletion (iOS, Apple-linked account): after Delete account, Foundry
  disappears from Settings → Apple ID → Sign in with Apple.

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
- Microsoft stops working everywhere: client secret expired; create a new one
  and update Clerk.
- Mobile browser returns but stays signed out: `foundry://sso-callback` is
  missing from the mobile redirect allowlist.
- Mobile shows "Finish signing up on the web": a required sign-up field the
  provider does not supply; make it optional.
- Apple sheet fails on iOS: build predates `usesAppleSignIn`, or the bundle ID
  is not under Clerk's Native applications.
- Same person gets a different Apple relay email per app: the app's App ID is
  not grouped under the primary App ID.
