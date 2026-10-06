# Design inventory

[Project design decisions](../docs/guidelines/project/design.md) and the
[mobile design system](../docs/guidelines/project/mobile-design.md) own implementation
rules. Runtime tokens own shipped values. These artifacts support exploration and
review; a mockup named `final` records design selection, not completed implementation.

| Area | Artifacts | Status / related evidence |
| --- | --- | --- |
| Foundry | [Design kit](foundry/readme.md), component prompts, token references, and [original bundle](<Foundry Design System.zip>) | Supporting design assets; use runtime tokens and project guidelines for shipped choices |
| Nutrition | [Initial study](nutrition/index.html) and ongoing diary/log iterations | Ongoing studies; [nutrition verification](../docs/verification/nutrition/README.md) records implementation coverage |
| Exercise library | [Interactive study and handoff](exercise-library/README.md) | [Native implementation and device evidence](../docs/verification/exercise-library/README.md) |
| Entry editor | [Initial study](entry-editor/index.html), [combined study](entry-editor/combined.html), rounds 3–5 | Exploration; approval and implementation status are not recorded here |
| App | [App study](app/index.html) | Reference study; approval and implementation status are not recorded here |
| Shell | [Shell study](shell/index.html) | Reference study; historical native experiments are in the archive |

Keep new studies in `designs/<area>/`, with iterations and the selected design
clearly identified in the area’s documentation. Keep implementation
reports and their assets under [verification](../docs/verification/README.md).
Superseded [Mobile V1 artboards](../docs/archive/design/mobile-v1/canvas.json) and
[native shell experiments](../docs/archive/prototypes/46-shell/README.md) are archived.
