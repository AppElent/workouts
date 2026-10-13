---
type: runbook
description: Read when creating or adopting a design study.
version: 1.0.0
---

# Workouts design studies

Follow the shared [design study procedure](../standards/design-studies.md)
with these bindings:

- Location: `designs/<area>/`. `<screen>_round<n>.html` records an iteration;
  `<screen>_final.html` records the approved design with implementation notes.
  List both in the [design inventory](../../designs/README.md).
- Mobile studies use runtime tokens (`apps/mobile/src/theme/tokens.ts`) and Dutch
  example copy.
- A final study records design selection, not implementation acceptance. Approved
  interaction decisions update the affected contract in `docs/contracts/`;
  runtime results and captures go in a verification record under `docs/records/`.
