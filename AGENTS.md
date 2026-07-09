

<!-- appelent-managed:start -->
## Appelent Managed Project

Read `CLAUDE.md` first.

Primary local source:
- `C:\Users\ericj\.claude\appelent`
- `C:\Users\ericj\.claude\skills`

Web/browser fallback committed in this repo:
- `.claude\appelent`
- `.claude\skills`

When adding generic functionality, prefer existing `@appelent/*` packages, bootstrap conventions, or capability skills before creating a new local-only pattern.

If global and repo-local instructions differ, prefer the global source locally. In web/browser environments, use the repo-local mirror and flag the drift.
<!-- appelent-managed:end -->
