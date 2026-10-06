---
version: 1.1.1
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
| Authenticated in-app GitHub feedback | [Issue reporter](issue-reporter/FEATURE.md) |
| Local/remote protocol tools | [MCP](mcp/FEATURE.md) |

Run scripts from the project root (or use --path). Baselines preview by default; --apply writes configuration. env/workspace command names retain their existing effect boundaries. Read their guide before running provider operations.

Stages 3–4 provide guides and portable scripts. Existing apps still need deliberate import, configuration, and runtime migrations before removing old packages. Updating a guide is not evidence an application was fixed. Capture reusable improvements through the developer-tools skill with source evidence and migration steps.
