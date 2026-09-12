# C — Add several foods in one visit

## Read

Current `nutrition-food-browser.tsx` after B, route `apps/mobile/app/(app)/nutrition-food.tsx`, mobile navigation tests, barcode/import tests, and the existing log mutation contract. A and B are prerequisites.

## User flow

The browser shows its selected date and four explicit meal choices near the header. Initialize meal from route params; changing it changes the next submission. Keep date fixed to the route's selected diary date for this release. Include Done to leave the browser through its existing onClose callback. Search and barcode stay peers. Preserve existing creation/online controls.

The serving footer has primary “Add & continue” and secondary “Add & close.” Both log the identical snapshot once. Continue dismisses only the serving sheet, preserves search text, selected meal/date, result scope, loaded result count and scroll position, and shows inline “Added [food] to [meal]” feedback. Close returns to the diary after success. Do not remount the browser to reset only a selection.

Keep the existing log snapshot construction and provenance branches in one submission function. Pass the desired outcome as a value, for example `continue` or `close`. The mutation returns before success navigation/feedback. Announce success accessibly and reuse the existing entryLogged haptic once. The browser remains mounted between continued additions.

### Submit lifecycle

| State/event | Required result |
| --- | --- |
| Idle, valid quantity, choose either action | Lock submission synchronously; capture snapshot and outcome; call existing mutation once |
| Pending, another button tap | Ignore; both actions disabled/loading as appropriate |
| Pending, close/swipe/back attempt | Prevent dismissal of this serving sheet while the submission is unresolved; keep “Adding…” visible |
| Success + continue | Release pending lock; close serving sheet; preserve browser context; show inline confirmation |
| Success + close | Release pending lock; close via existing browser callback |
| Failure | Release lock; retain sheet, portion and selection; show error; allow retry and normal dismissal |
| Idle dismissal | Close sheet normally; preserve results/context |

Use a ref guard if needed to cover two events before React rerenders. Tie every dismiss path to pending state, including native swipe dismissal, onRequestClose, explicit close and route back where applicable. If a platform can unmount anyway, avoid late state updates/navigation; do not imply the underlying mutation was canceled. Do not invent a timeout that marks an unresolved write as failed and invites duplicate retry. An offline save may stay pending under the existing contract; record that limit accurately.

When selecting the next food, reset quantity and serving state to that food's defaults. Ensure React does not retain another food's state through component reuse (use a stable selection key or explicit initialization strategy). Keep provider review/correction flows working.

## Acceptance tests

Use deferred mutation promises to test races, not immediate mocks only:

1. Set query and expanded scope, choose food, Add & continue, resolve mutation: browser remains, sheet closes, query/scope/page count/meal/date remain.
2. Add second and third foods the same way. Three intended additions produce three mutations with correct snapshots. Done causes no extra mutation.
3. Add & close resolves once and closes once.
4. Click both actions before resolution: exactly one request and the first outcome wins.
5. Reject submission: sheet and amount remain; an error is visible; retry can succeed.
6. During pending submission, explicit close and native dismissal callbacks cannot lose the form. After failure they work again.
7. Change browser meal from breakfast to lunch on a historical date: every snapshot uses lunch and that unchanged date.
8. Switch between foods with different serving sets; no quantity/serving leaks.
9. Barcode/import accepted food supports both outcomes and preserves provenance.

Test scroll preservation with native interaction where the test renderer cannot model it. Keep the same list instance and avoid changing its key after a continued log.

## Finish integration

Return to RELEASE-1.md's integration checks. Update implementation status with A/B/C results and unresolved native checks. Update the existing product spec's day-layout and successful-log sections to describe this release's intentional UX changes, following its documentation instructions. Do not rewrite unrelated v1 decisions.

Release success: a person opens a meal once, adds three foods with correct portions, and returns to a diary whose totals match those three snapshots. A failed fourth addition remains editable and does not silently appear as saved.
