---
version: 1.0.0
description: Add an app-owned manifest and post-build service worker for a web application.
---

# Progressive Web App

PWA support is optional and browser-specific. It does not make the Expo/native app ready. Confirm installability and offline-shell requirements before adding a service worker.

1. Adapt the [manifest template](templates/manifest.webmanifest) with the real app name, theme, start URL, and icon paths. Supply actual 192px/512px/maskable production artwork; placeholders are not release-ready assets.
2. Copy [generate-sw.mjs](templates/generate-sw.mjs) into the app's scripts directory and install a compatible workbox-build as a development dependency. Run it after the production client build; verify the actual client output directory rather than assuming dist/client for every framework version.
3. Link the webmanifest in the root route/document. Copy and mount [PwaRegistration](templates/PwaRegistration.tsx) in browser content. It registers only in a production build.
4. Keep runtime API and Convex traffic out of precaching and runtime cache rules. The supplied script precaches build assets; it does not make server-rendered or authenticated data available offline.
5. Review update UX: skipWaiting/clientsClaim activates updates promptly but can replace code during an open session. Preserve unsaved user input and use an explicit update prompt when the application needs coordinated refresh.

The inherited baseline uses post-build Workbox to avoid relying on Vite service-worker hooks across TanStack environments. Validate this against the actual framework/output structure when changing versions rather than treating an old plugin incompatibility as permanent.

Verify production build output, manifest loading, icons, service-worker scope, install flow, refresh, update activation, and network/offline behavior in a browser. Ensure authenticated data is not accidentally cached. Unregister obsolete development workers before diagnosing stale pages.

## Migration

Compare existing manifest/worker generation/registration and remove duplicate registration or obsolete plugins deliberately. Never overwrite production artwork or delete an active worker configuration without an upgrade/removal plan. Updating the toolkit template alone does not update an installed browser worker.
