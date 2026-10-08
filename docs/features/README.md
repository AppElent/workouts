---
version: 1.2.0
description: Find AppElent feature implementation guides and portable scripts.
---

# Features

All guides and supporting files are distributed. Read only what the task needs; installation does not enable features or provision services. Small samples stay in the guide, substantial examples/templates alongside it. Copied application source becomes project-owned.

| Task | Guide |
| --- | --- |
| Update toolkit files or install the skill | [Toolkit](toolkit/FEATURE.md) |
| Common stack standards and repository/pnpm/tooling setup | [Shared baseline](baseline/FEATURE.md) |
| TanStack web stack standards, setup, and UI states | [Web baseline](web-baseline/FEATURE.md) |
| Expo mobile stack standards, setup, and release boundaries | [Mobile baseline](mobile-baseline/FEATURE.md) |
| Clerk/Convex authentication | [Auth](auth/FEATURE.md) |
| Web/native localization | [i18n](i18n/FEATURE.md) |
| App-user commands and browser login | [Application CLI](app-cli/FEATURE.md) |
| Canonical environment routing | [Environments](environments/FEATURE.md) |
| Isolated worktree resource lifecycle | [Workspaces](workspaces/FEATURE.md) |
| PR backend/Worker deployments | [Previews](previews/FEATURE.md) |
| Browser installability and service worker | [PWA](pwa/FEATURE.md) |
| Sentry reporting, privacy, environment boundaries, and artifact uploads | [Sentry](sentry/FEATURE.md) |
| GitHub requests and investigation maps | [Issue tracking](issue-tracking/FEATURE.md) |
| Authenticated in-app GitHub feedback | [Issue reporter](issue-reporter/FEATURE.md) |
| Local/remote protocol tools | [MCP](mcp/FEATURE.md) |

Run scripts from the project root (or use --path). Baselines preview by default; --apply writes configuration. env/workspace command names retain their existing effect boundaries. Read their guide before running provider operations.

Existing runtime packages remain until their import, configuration, and behavior migrations are verified. Capture reusable improvements in the canonical toolkit with applicability and evidence.
