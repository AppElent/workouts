# Shipped food library — initialization, search and memory

Ticket [#71](https://github.com/AppElent/workouts/issues/71) requires the shipped NEVO library to be
benchmarked before the internal search strategy is fixed. This is the first measurement.

**Status: Node only.** These numbers come from V8 on a developer machine, not from a phone. Hermes
parses JSON and allocates objects differently, and a mid-tier Android device is several times slower
than this. Treat the table as an order-of-magnitude floor and a regression guard. **The strategy is
not fixed yet** — the follow-up UI work re-measures on the Android emulator and on a real device
before anything is settled.

Reproduce with:

```bash
pnpm --filter @workouts/core bench:foods
# with heap figures:
node --expose-gc ./node_modules/tsx/dist/cli.mjs packages/core/scripts/benchmark-shipped-foods.ts
```

## Measured — Node v26.7.0 (V8), Windows 11, 2026-09-05

### Artifact

| | |
| --- | --- |
| `shipped-foods.json` | **553 KB** on disk, **132 KB** gzipped |
| Records | 2,328 foods, 172 promoted |
| `JSON.parse` | median **2.7 ms**, worst 6.7 ms |
| Decode to `ShippedFood[]` | median **4.4 ms**, worst 7.2 ms |
| Cold open (parse + decode) | **~7 ms** |
| Heap held by the decoded library | **~15.5 MB** |
| Search index (built lazily on first search) | **~18.5 ms**, ~2.0 MB |

### Search, warm, 50 runs each

| Scope | Query | Median | Worst |
| --- | --- | ---: | ---: |
| promoted | `banaan` | 0.115 ms | 0.168 ms |
| promoted | `brood` | 0.107 ms | 0.181 ms |
| promoted | `chicken` | 0.123 ms | 0.359 ms |
| promoted | `yog` | 0.120 ms | 0.232 ms |
| promoted | `kaas 30` | 0.190 ms | 0.294 ms |
| promoted | `e` (worst case, 50 hits) | 0.168 ms | 1.72 ms |
| all | `banaan` | 0.720 ms | 1.83 ms |
| all | `brood` | 0.733 ms | 1.06 ms |
| all | `chicken` | 0.702 ms | 1.01 ms |
| all | `yog` | 0.686 ms | 1.31 ms |
| all | `kaas 30` | 0.922 ms | 1.15 ms |
| all | `e` (worst case) | 1.81 ms | 4.24 ms |

## What this implies

1. **Eager in-memory filtering is very likely enough.** Sub-millisecond promoted search and ~2 ms
   worst-case "search all" leave roughly a 50× margin against the ~100 ms budget for
   feels-instant keystroke response. Even if Hermes is 10× slower than V8, per-keystroke search over
   all 2,328 rows still lands inside budget. No index, no SQLite FTS, no precomputed trie is
   justified by these numbers — build the simple thing and re-measure.
2. **Memory, not latency, is the number to watch.** ~15.5 MB of heap for the decoded library is the
   only figure close to uncomfortable on a low-end phone. Three mitigations are available without
   changing the public API, in increasing order of effort:
   - decode nutrients lazily (they are already a compact array on the wire, and most foods are never
     opened);
   - keep only the promoted subset decoded and decode the rest on the first "search all";
   - move the artifact out of the JS bundle into an Expo asset read with `expo-file-system`.
3. **The first search pays ~18.5 ms** to build the index. That is fine hidden behind the food-search
   screen's transition, but it should not happen while the day view is painting. Warm the index when
   the search sheet opens, not on app start.
4. **Cold open is dominated by parse, and parse is dominated by size.** The artifact gzips to 132 KB,
   so if it ever moves over the network, ship it compressed.

## What to measure on device, and what would change the answer

Re-run the same queries in the app on the Android emulator (`Pixel 9 Pro 2`) and on the lowest-tier
supported device, and record:

- time from `require` of `@workouts/core/nutrition` to the first rendered result list;
- per-keystroke search latency for a 1-character and a 6-character query, both scopes;
- resident memory before and after the food-search screen is first opened.

Change the strategy only if one of these holds on a real device:

- per-keystroke "search all" exceeds ~50 ms, or
- the library adds more than ~30 MB of resident memory, or
- cold open of the search screen exceeds ~300 ms.

`searchShippedFoods`, `servingOptions`, `scaleNutrients` and the rest of
`@workouts/core/nutrition` are the stable surface — every mitigation above is behind them.
