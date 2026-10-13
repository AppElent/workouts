---
version: 2.0.0
description: Find AppElent feature implementation guides and portable scripts.
---

# Features

Guides not yet migrated to `docs/standards/`; migrated capabilities (baselines, auth, i18n, environments, workspaces, previews, Sentry) are standards now. All guides and supporting files are distributed. Read only what the task needs; installation does not enable features or provision services. Small samples stay in the guide, substantial examples/templates alongside it. Copied application source becomes project-owned.

| Task | Guide |
| --- | --- |
| Update toolkit files or install the skill | [Toolkit](toolkit/FEATURE.md) |
| App-user commands and browser login | [Application CLI](app-cli/FEATURE.md) |
| Browser installability and service worker | [PWA](pwa/FEATURE.md) |
| GitHub requests and investigation maps | [Issue tracking](issue-tracking/FEATURE.md) |
| Authenticated in-app GitHub feedback | [Issue reporter](issue-reporter/FEATURE.md) |
| Local/remote protocol tools | [MCP](mcp/FEATURE.md) |

Run scripts from the project root (or use --path). Baselines preview by default; --apply writes configuration. env/workspace command names retain their existing effect boundaries. Read the owning standard before running provider operations.

Existing runtime packages remain until their import, configuration, and behavior migrations are verified. Capture reusable improvements in the canonical toolkit with applicability and evidence.
