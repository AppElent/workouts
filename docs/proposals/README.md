# Proposals and open decisions

These items await agreement or a separate migration. They do not override current
[project guidelines](../guidelines/project/README.md).

- [Mobile folder structure](mobile-folder-structure.md): proposed organization; existing code has not been migrated.

Open choices retained from the previous docs index:

- Whether Convex + Clerk become cross-project defaults or remain feature choices. Workouts uses both; shared baselines leave the provider choice open.
- How to retire legacy runtime packages and wrappers. Each needs import, configuration, test, and runtime verification beyond a guidance sync.
- How to replace public-build test-login credentials with a server-side or locally controlled mechanism. The current placement remains a project exception.

On acceptance, move the resulting rules into their authoritative guideline or
contract and link the implementation evidence. Archive the superseded proposal.
