---
type: record
kind: verification
description: Read for account-data implementation checks, migration results, and measured Convex usage.
version: 1.0.0
date: 2026-10-08
---

# Issue 89: account data implementation and usage

## Current status

The implementation is now merged into local main and deployed to regular dev.
See the [2026-10-08 dev rollout](dev-rollout.md) for merged checks, complete dev
migration results, simulator acceptance and pending user testing. Production and
preview are pending. The evidence below records the earlier isolated branch run.

## Original isolated verification

Verified 2026-10-07/08 on `t3code/offline-behavior-decision`, against task-start
`c59d8fb` plus this commit's working tree. Backend: isolated cloud development
`earnest-cobra-841`, project `workout-tracker`, worktree
`ericjansen-t3code/3be9d410`. This is branch evidence, not a production rollout.
The [migration release gate](../../runbooks/nutrition-account-migration.md) must
complete on the release deployment before the new client is distributed.

Personal Foods, Combos and explicit saved Capture Drafts now belong to the
authenticated account. Ordinary Nutrition writes await server acknowledgement;
failed input stays in its open editor. Legacy journals retain durable retry and
automatic preservation of conflicting versions. Disposable caches and in-flight
results are account-isolated. Food photos remain device-only conveniences.
Latest/best Set queries use bounded indexes after backfill. No TanStack Query or
generic offline engine was added. Durable active Strength Session recovery is
deferred by the [accepted contract](../../contracts/account-data.md).

## Checks

| Gate | Result |
| --- | --- |
| `pnpm test` | 60 suites, 427 tests pass |
| `pnpm typecheck` | Pass |
| `pnpm build` | Client, server and service-worker build pass |
| `pnpm check` | Biome and mobile architecture pass |
| Mobile typecheck | Pass |
| Mobile Jest | 89 suites, 583 tests pass |
| Final rename keyboard adjustment | Mobile types/check pass; 18 focused Combo tests pass |
| `convex dev --once` | Isolated deployment schema/functions generated and deployed |

Tests use the agreed public Convex APIs and mobile save/repository interfaces.
They cover ownership, validation, last acceptance, deduplication, tombstones,
preserved input before ACK, ambiguous retry, known-owner migration, explicit
claims, interruption, conflicting versions and late responses. Regression tests
include a delayed barcode response and cached correction deletion when 100
shortcuts fill the primary request. The test transport lives in test support;
production has no mock-detection or undefined-ACK success path.

The operator dry-run on the isolated deployment scanned its first 100 library
rows with zero changes and returned a continuation cursor. This does **not** prove
a complete backfill. Public internal-API tests cover old rows, derived-field
changes, dry-run, repeat safety and payload preservation.

## Runtime coverage

Dedicated iPhone 18 Pro simulator, iOS 27.0, bundle `com.appelent.foundry`, native
runtime fingerprint `3720fa5dde1b2d8bf1948b572edf25e2bb1f2f41`; this checkout's
Metro on 8189. Dutch/light appearance, documented development account, verified
isolated backend before writes. No dependency/native-runtime changes were needed.

- Fresh online Nutrition loaded with empty account content. Explicit Save of
  `Issue 89 retry soup` produced an account-owned note without intake totals.
  A native process termination and relaunch reloaded it from the server. After the
  final direct-backend restart, both notes and the acknowledged food reloaded;
  see [restart state](after-native-restart.png).
- Entered `Offline retry 89`, then severed this checkout's Convex HTTP/WebSocket
  transport using a temporary localhost proxy. Save failed visibly, retained the
  text, and kept the editor open. After reconnect, retry saved exactly one note.
  See [failed note](offline-note.png) and [retried note](retried-note.png).
- Selected Appel × 1, 130 g while online; disconnected; Save reported failure
  with the selection intact. Reconnected and retried: the diary showed one item,
  73 kcal, alongside both notes. See [failed food save](offline-food.png) and
  [acknowledged food](retried-food.png).
- Native Log Food search/amount presentation was exercised with keyboard open,
  portion sheet opened/closed, parent interaction and return to diary. iOS 26+
  expanded search hides the toolbar menu, so explicit Save as note is also
  available inline while search is expanded.
- Existing web training on port 5199 added Barbell Back Squat, saved 60 kg × 5
  at RPE 8, edited to 65 kg, duplicated/deleted the duplicate, then finished the
  session. See [completed web session](web-completed-session.png).
- Created an account Combo from the logged Apple. Native rename initially hid
  below the keyboard; its modal now owns keyboard avoidance and bottom safe-area
  padding. Repeated focus/edit, keyboard completion, acknowledged save, reopen
  with the new name and Cancel dismissal on the corrected bundle. See
  [visible rename](combo-rename-keyboard.png) and flow recording (video not kept).

The temporary network proxy was stopped and the ignored mobile environment
restored to the direct isolated URL. The Expo floating tools button intercepted
the native Save during setup; disabling that **development-only** overlay made
the actual failure/retry check possible. No product workaround was introduced.

Limits: Android, physical haptics, large Dynamic Type, dark mode,
all historical legacy-device fixtures and offline
cold launch were not runtime-verified here. Unsent ordinary input is deliberately
not promised after editor dismissal/process termination. These screenshots do
not establish acceptance of unrelated native flows.

## Measured Convex workload

Real isolated-deployment run at `2026-10-07T21:10:53.789Z`, using
[measure-account-data.mjs](../../../scripts/measure-account-data.mjs).
The script refuses a non-scoped/non-development/mismatched target and imports
synthetic fixtures under a unique identity; do not run it on shared/production.
Full sanitized results: [usage-results.json](usage-results.json).

5,000 Foods averaged 590.778 payload bytes and 996.556 imported row bytes.
10,000 Sets averaged 260.5782 imported row bytes. These are UTF-8 JSON means
across all fixture rows, excluding Convex system fields and index storage.

| Scenario | Completed calls (cached) | DB read B | DB write B | Client response B |
| --- | ---: | ---: | ---: | ---: |
| Cold library page, 50 Foods | 2 (0) | 52,830 | 0 | 43,214 |
| 20 unchanged focus/unfocus visits | 21 (21) | 0 | 0 | 883,639 |
| Retained subscription, 20 unchanged visits | 1 (1) | 0 | 0 | 44,173 |
| Indexed text search | 1 (0) | 46,560 | 0 | 43,204 |
| Food edit + ten identical receipt retries | 11 (0) | 22,329 | 3,846 | 9,207 |
| Fresh client reconnect | 1 (0) | 52,840 | 0 | 44,387 |
| Restart with empty cache | 1 (1) | 0 | 0 | 44,387 |
| Latest Set, 1,000 historical rows | 1 (0) | 449 | 0 | 373 |
| Best estimate after edit, 1,000 rows | 1 (0) | 1,104 | 1,772 | 33 |
| Latest Set, 10,000 historical rows | 1 (0) | 449 | 0 | 376 |
| Best estimate after edit, 10,000 rows | 1 (0) | 1,702 | 1,772 | 33 |

Database bytes/calls come from real function completion usage statistics. Client
bytes are HTTP response bodies and received WebSocket message bodies, excluding
headers/framing/TCP/TLS. The first cold phase includes an overlapping empty-app
browse completion with zero DB read; results are reported as observed.
The visits/reconnect/restart in this table are **SDK lifecycle scenarios**, not
20 physical taps or 20 app-process restarts. The native process check above is
separate. Imports, index construction, operator backfill, unrelated app queries
and the picker’s additional fork/shortcut hydration are outside this table.

Convex's server cache avoided repeated database I/O for the unchanged visits,
but each renewed subscription transferred the page again. Retaining a live
subscription reduced measured transfer about 20-fold. The mobile policy retains
stable subscriptions while focused/foreground and stops them when unused:
this accepts renewed page transfer while avoiding indefinitely subscribed
screens and unused updates. It does not promise cache hits after mutations or
across devices. TanStack Query is not needed to obtain the demonstrated DB
savings; a retained-result policy remains a targeted option if transfer becomes
material. Paging caps visible library pages at 50 and identity/fork requests at
100; bundled catalog display extends in 100-item steps rather than truncating
fresh-install correction lookup to the first 100 Foods.

### Allowances, current consumption and limits

Authenticated management reads on 2026-10-07 found no paid subscription for team
74539 (Free), billing period October 1–31, and default usage state. Actual
entitlements: 1,000,000 function calls/month, 512 MiB DB storage, 1 GiB DB I/O,
512 MiB search storage and 3,000 search query-GB. These are the target team's
observed entitlements; compare [current pricing](https://www.convex.dev/pricing)
and [usage limits](https://docs.convex.dev/production/state/limits) before release.

The management rollup sample reported 235,514 calls (23.55% of allowance),
7,562,274 DB I/O bytes (about 7.21 MiB), and 11,293,699 DB storage bytes
(about 10.77 MiB). It includes **all team deployments/projects**, earlier usage
and fixtures, and may lag; it is not a clean workload baseline or per-user cost.
The reported search storage was 17,033 bytes and search query usage zero at that
sample. These immediate values cannot establish post-index billing.

Function logs reported zero `textIndexQueryBytes` and `networkEgressBytes` even
when client response bytes were nonzero. Do not infer free search or free client
transfer. [Convex text-search documentation](https://docs.convex.dev/search/text-search)
bills searches based on the entire text index regardless of result count/filter;
account filters and 50-result pages bound returned records, not that search cost.
Verify delayed search rollups against the release deployment's global index.

### Regression budget and capacity estimates

For the measured target workload (all rows above except the retained-subscription
alternative): observed **41 completions, 178,263 DB read bytes, 7,390 DB write
bytes and 1,068,853 client bytes**. Regression ceilings are **45 completions,
256 KiB DB reads, 16 KiB DB writes and 1.2 MiB client bodies**. Latest-Set at
10,000 rows must remain below 1 KiB read/response; best-estimate edit after
backfill below 4 KiB each DB read/write. Re-run the script after changing these
query shapes. These ceilings are not a whole-app budget; fork/shortcut queries,
draft summaries, diary queries, external APIs and import/backfill traffic must
be measured separately for a release-wide projection.

Illustrative estimates, assuming 30 active days per device and no other traffic:
20 cold 50-Food page visits cost about 1 MiB DB reads/device/day, or 30 MiB/month;
about 33 such devices would consume 1 GiB. The warm measured workload reads
about 174 KiB/day, but its cache hits cannot be guaranteed in a multi-device
projection. A 5,000-Food fixture is about 4.75 MiB raw row JSON per large account,
so roughly 100 such accounts approach 512 MiB **before** system fields, indexes,
receipts, other data and headroom. At a hypothetical 512 MiB global text index,
an uncached search is about 0.5 query-GB; 3,000 query-GB permits roughly 6,000
such searches. Actual index size/workload must replace this worst-size scenario.
Calls are currently the most-used reported allowance; caching/paging must not
be described as unlimited usage or a promise that this Free plan serves a given
number of users.

## Code review

### Standards

Two material findings and one minor finding were resolved: stale barcode/fork
cache confirmation, duplicate Combo creation after grouping failure, and the
duplicate Settings item. Follow-up review found no remaining material Standards
finding; public test transport has no production bypass.

### Spec

Four initial material findings and two follow-up findings were resolved:
lower-schema legacy preservation, delayed ACK regression, deleted cached fork
lookup, lookup beyond 100 shipped candidates, delayed barcode regression and
cached correction identity overflow. Each behavior has a regression test.
Follow-up source review found no remaining material Spec finding. Runtime and
usage limitations above remain explicit.

Review totals: Standards 0 remaining material findings; Spec 0 remaining material
findings. Production rollout and untested platform acceptance remain separate.
