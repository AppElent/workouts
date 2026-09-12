# QA Engineering Handoff

## Tested flow

Visual review of VirtuaFood: guided profile setup, personalized nutrition plan, diary dashboard, PRO interruption, and food logging/search. Audio contained only background noise and was ignored.

## Priority order

1. QA-001 — Daily nutrition summary hierarchy
2. QA-003 — Unified food-logging fast paths
3. QA-002 — Guided first-run nutrition setup
4. QA-004 — Faster food-browser rows
5. QA-005 — Selective visual refresh
6. QA-006 — Preserve advantages over competitor regressions

## Issue index

| ID | Priority | Evidence |
|---|---|---|
| QA-001 | high | `sample-12.png`, `sample-14.png` |
| QA-002 | high | `sample-01.png`, `sample-02.png`, `sample-04.png`, `sample-10.png` |
| QA-003 | high | `sample-16.png`, `sample-18.png` |
| QA-004 | medium | `sample-18.png`, `sample-20.png` |
| QA-005 | polish | `sample-10.png`, `sample-14.png` |
| QA-006 | medium | `sample-16.png`, `sample-22.png`, `sample-24.png` |

## Engineering review instructions

Review `apps/mobile/src/screens/nutrition-day.tsx`, `nutrition-food-browser.tsx`, `nutrition-goals.tsx`, and the existing nutrition data helpers before implementation. Prefer composition of existing `GoalSection`, meal sections, food browser, personal-food, barcode, and combo routes. Do not replace the explicit provenance, confirmation, skeleton, error, or accessibility behavior already present.
