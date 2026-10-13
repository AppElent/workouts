---
version: 1.0.1
description: Iterate on interactive screen studies and promote decisions to their owners.
---

# Design studies

## Orient

Read the affected design system, tokens, existing studies, and component APIs.
Inventory the current screen's actions, menus, gestures, and states; a redesign
retains them unless their removal is agreed. Use realistic data and the product's
chosen language.

## Iterate

Show one screen at a time in the host's shared browser/preview. Serve local studies
when needed; use a reachable address when the user is on another machine.
Inspect the rendered result before presenting it.

Keep each round as a self-contained HTML file with inline assets/code and a link
to the preceding round. Start with a numbered critique ranked by impact. Offer
1–5 alternatives where choices remain open; identify the recommendation and why.
Label states and alternatives distinctly. Make important interactions operable:
menus, scrolling, selection, theme, and keyboard-related compositions where feasible.

Before finalizing, show applicable navigation/header states, the complete action
inventory, gestures and visible alternatives, bulk actions, follow-up forms,
empty/loading/error/offline/draft states, long text, larger text, and themes.
Summaries need routes to detail and the data that explains them.

## Finalize

After approval, write a final artifact containing the selected states and links
to the deciding rounds. Include actual component/API bindings, installed-version
constraints, and remaining runtime questions. Keep earlier rounds as history.
HTML studies establish design intent, not native acceptance. Follow the shared
[verification procedure](../general/verification.md) for implementation comparison.

Classify each accepted decision using [documentation standard](../../../standards/documentation.md).
Extract reusable patterns into their canonical toolkit source; product standards
retain identity, bindings, domain behavior, and explicit exceptions. If shared
adoption is unresolved, label it proposed with applicability and evidence.
Publishing or filing upstream proposals follows the user's authorized scope.
