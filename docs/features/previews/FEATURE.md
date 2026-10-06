---
version: 1.0.0
description: Create isolated pull-request previews with explicit backend and Worker ownership.
---

# Pull-request previews

Use the [workflow template](templates/preview.yml) as app-owned source after adapting APP_NAME, seed function, provider secret/variable names, build output, and deployment environments. Keep an existing customized preview workflow as the starting point; never replace it merely because the template changed.

The template uses a Convex preview-kind deploy key to create an isolated PR backend, runs a configured seed function, passes its URL into the web build, and deploys a per-PR Worker. Closing the PR deletes that Worker. The seed function must be safe for a fresh disposable backend and must not write production resources.

Configure PREVIEW_CONVEX_DEPLOY_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and a public preview Clerk key under the names used in the workflow. Route their values through [environments](../environments/FEATURE.md). Keep development/preview auth distinct from production. If private package dependencies remain, preserve their registry authentication and minimum package-read permissions separately.

Only same-repository PRs receive the deployment workflow. Never change this to pull_request_target with untrusted PR checkout to make fork secrets available. Review deploy-token permissions and branch trust. The template deliberately does not install or execute itself during toolkit sync.

## Lifecycle and verification

Run an isolated PR pilot: verify distinct Convex/Worker identities, seeded data, public build URL, auth redirects, refresh, and close-event Worker cleanup. The current workspace/preview contract does not assume a safe Convex deployment deletion command: configure provider expiry/retention and verify absence separately. Worker cleanup alone is not full backend cleanup.

Existing custom staging/production environment names and routes must survive. If build/deploy flags differ in the installed provider CLI, inspect its actual help and adapt the project template before execution.

## Migration

Replace the baseline.preview recipe procedure with this guide and the app's committed workflow. Compare changes and verify a fresh preview; a template/version update is not proof an existing workflow deployed or cleaned up successfully.
