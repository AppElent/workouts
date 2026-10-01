---
version: 1.0.0
description: Add authenticated app feedback that creates GitHub issues through a server boundary.
---

# In-app issue reporter

Copy the [validation model](templates/issue-reporter.ts), [server adapter](templates/submit-issue.ts), and optional [React form](templates/IssueReporter.tsx) together into an app-owned feature directory. Their relative imports assume those three files stay together. The server module must never enter a browser bundle.

The app supplies an authenticated server endpoint/server function. Derive the user ID from the actual server session and pass it to submitIssueToGitHub; never accept a client-provided user ID as authentication. Require authorization to use the reporter and add app-appropriate rate limiting, CSRF/origin protection, and request-size limits at the boundary. Validate input before contacting GitHub.

Provide GITHUB_ISSUES_TOKEN and GITHUB_ISSUES_REPOSITORY only through server configuration. Use a fine-grained token scoped to issue creation in the selected repository. On Workers, adapt environment access to the app's verified binding mechanism; never move the token into VITE_ variables. The server adapter returns redacted failures rather than provider diagnostics.

Mount the form in an authenticated shell, wire its submit callback to that server boundary, translate copy, and integrate the app's own modal/notification components. Confirm loading, duplicate-submit prevention, preserved text after failure, and dismissal behavior. The validator removes URL user information, query parameters, and fragments before including a page URL in a report. Review whether the pathname itself contains private data and redact it at the app boundary when needed. Do not attach arbitrary credentials, logs, or personal data.

Test missing session, unauthorized user, malformed type/text/URL, missing server configuration, rejected GitHub request, network failure, and success with a mocked fetch. Then verify one intentionally authorized report in the app if live acceptance is requested. Generating this template or syncing this guide does not authorize creating an issue.

## Migration

This feature creates product feedback in the app's configured repository. Reusable toolkit improvements go through the developer-tools skill to AppElent/developer-tools; do not confuse the two destinations. For an existing reporter preserve its route, authenticated boundary, repository choice, and UI. Replace only the behavior covered by the migration and verify it.
