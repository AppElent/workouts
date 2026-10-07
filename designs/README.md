# Design inventory

[Project design decisions](../docs/guidelines/project/design.md) and the
[mobile design system](../docs/guidelines/project/mobile-design.md) own implementation
rules. Runtime tokens own shipped values. These artifacts support exploration and
review; a mockup named `final` records design selection, not completed implementation.

| Area | Artifacts | Status / related evidence |
| --- | --- | --- |
| Foundry | [Design kit](foundry/readme.md), component prompts, token references, and [original bundle](<Foundry Design System.zip>) | Supporting design assets; use runtime tokens and project guidelines for shipped choices |
| Nutrition | [Initial study](nutrition/index.html) and ongoing iterations; selected: [diary](nutrition/diary_final.html), [log food](nutrition/log_final.html), [weekly overview](nutrition/week_final.html), [goals editor](nutrition/goals_final.html), [personal food](nutrition/personal-food_final.html), [food library](nutrition/library_final.html), [combo editor](nutrition/combo_final.html), [one-off log](nutrition/one-off_final.html), [my measures](nutrition/measures_final.html) | Ongoing studies; [nutrition verification](../docs/verification/nutrition/README.md) records implementation coverage |
| Exercise library | [Interactive study and handoff](exercise-library/README.md) | [Native implementation and device evidence](../docs/verification/exercise-library/README.md) |
| Entry editor | [Initial study](entry-editor/index.html), [combined study](entry-editor/combined.html), rounds 3–5 | Exploration; approval and implementation status are not recorded here |
| App | [App study](app/index.html); strength session: [round 1](app/session_round1.html), [round 2](app/session_round2.html), [round 3](app/session_round3.html) (in review); training: [round 1](app/training_round1.html), [round 2](app/training_round2.html), selected: [training](app/training_final.html); profile: [round 1](app/profile_round1.html), [round 2](app/profile_round2.html), selected: [profile](app/profile_final.html) | Training and profile finals record design selection, not implementation |
| Shell | [Shell study](shell/index.html) | Reference study; historical native experiments are in the archive |
| Start activity | [Round 1](app/start-activity_round1.html), [round 2](app/start-activity_round2.html), selected: [final design](app/start-activity_final.html) | Approved single-sheet design with keyboard, dismissal, navigation, and recovery states; native implementation and device acceptance remain pending |

Keep new studies in `designs/<area>/`, with iterations and the selected design
clearly identified in the area’s documentation. Keep implementation
reports and their assets under [verification](../docs/verification/README.md).
Superseded [Mobile V1 artboards](../docs/archive/design/mobile-v1/canvas.json) and
[native shell experiments](../docs/archive/prototypes/46-shell/README.md) are archived.
