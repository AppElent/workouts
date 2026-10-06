---
version: 1.1.0
description: Implement app-owned web and native authentication with Clerk and Convex.
---

# Authentication

Clerk owns sessions; Convex verifies tokens and authorizes backend access. Preserve app-owned navigation, provisioning, and credential routing. No @appelent/auth dependency is required.

## Web wiring

Follow [Convex's Clerk integration](https://docs.convex.dev/auth/clerk). Validate public configuration through the app's environment schema; keep server keys server-only. For existing @clerk/clerk-react apps:

```tsx
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

const convex = new ConvexReactClient(publicConvexUrl);
// publicClerkKey/publicConvexUrl come from app-validated public configuration.
<ClerkProvider publishableKey={publicClerkKey}>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <App />
  </ConvexProviderWithClerk>
</ClerkProvider>;
```

Use the installed SDK's adapter; preserve its generation and app-specific router options.

## Session readiness and protected data

On web and native, navigation follows loaded Clerk session state; protected data follows Convex. Clerk's isSignedIn/userId does not establish backend readiness. Never redirect solely because Convex authentication is pending.

- Keep ClerkProvider and ConvexProviderWithClerk mounted above the data gate. Mount protected query providers and screens only beneath an Authenticated component or a gate checking useConvexAuth().isAuthenticated. Hooks in the gate itself or ancestors remain unprotected.
- Outside that boundary, pass "skip" to protected useQuery/usePaginatedQuery calls until Convex authenticates. Guard imperative queries, mutations, and actions separately and handle rejections.
- Distinguish pending authentication from failure using isLoading and app-owned recovery behavior. After bounded waiting, reveal recovery controls; never use elapsed time to authorize requests or leave an indefinite blank screen. Normal token refresh need not make isAuthenticated false.
- Authentication loss unmounts gated children. Choose the boundary deliberately; preserve drafts according to app policy and clear or partition account-specific state on logout/account switching.
- Recover from throwing query hooks with an error boundary. Retain server identity and resource-permission checks on every protected operation; gating cannot guarantee later calls succeed.

See [Convex's startup-race guidance](https://docs.convex.dev/auth/debug).

## Account flows

Use supported Clerk UI or custom flows covering verification, MFA, password reset, incomplete sessions, and activation/finalization. A successful password request is not a completed session. Preserve failed input, prevent duplicate submissions, and translate provider codes.

## Native and headless behavior

Copy needed [native helper](examples/native.ts) behavior into app-owned code. Use the installed @clerk/expo version's official token cache and session finalization. Keep provisioning, sign-out cleanup, navigation, and theming app-owned.

Never put login credentials in public build variables; a test-instance key does not prove non-production deployment.

## Verification and migration

Verify zero protected requests while Clerk is signed in and Convex is delayed, including provider-level subscriptions. Test authentication gained/lost/regained, account switching, draft handling, stalled-handshake recovery without redirect loops, new/existing accounts, incomplete/MFA flows, expired sessions, and unauthorized calls. Exercise cold launch and background/resume on a native device/build; report runtime verification separately from helper tests.

Inventory @appelent/auth imports before migration; preserve customized routes/forms/branding. Remove dependencies only after imports, styles, types, build, and runtime flows pass. Guide updates alone do not fix applications.
