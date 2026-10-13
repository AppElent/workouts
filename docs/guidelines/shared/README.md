---
version: 1.3.0
description: Select shared guidelines by the task and target platform.
---

# Shared guidelines

All platforms are installed; read only the relevant files.

- All code: [general coding](general/coding.md).
- All UI: [general design](general/design.md).
- Browser UI: [web design](web/design.md).
- Native UI: [mobile design](mobile/design.md), plus [iOS](ios/design.md) or [Android](android/design.md).
- Documentation: [documentation standard](../../standards/documentation.md).
- Verification: [acceptance contract](general/verification.md).
- Native code: [mobile architecture](mobile/coding.md).
- Interaction patterns: [pattern index](patterns/README.md).
- Specialist tasks: [external skill routing](general/specialist-skills.md).

These files are toolkit-owned. Record project decisions outside the managed blocks in [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) and [DESIGN_SYSTEM.md](../../../DESIGN_SYSTEM.md). Update with `node scripts/sync-devtools.mjs` from the project root. Capability, platform, and pattern standards live in `docs/standards/`; read those whose description matches the task. Features not yet migrated to standards remain in [the feature index](../../features/README.md).

Shared guidelines define cross-project behavior; the shared, web, and mobile baselines in the feature index define stack choices and setup. Project standards select the applicable baselines and name any deliberate exceptions. Keep current domain vocabulary and durable architectural trade-offs in their own app-owned documents; dated plans and reviews are historical evidence, not additional standards.
