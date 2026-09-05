#!/usr/bin/env tsx
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { ShippedArtifact } from "../src/nutrition/artifact";
import { loadShippedLibrary } from "../src/nutrition/library";
import { resetSearchIndex, searchShippedFoods } from "../src/nutrition/search";

/**
 * Measure what the shipped library costs to open and to search (spec #68, D18).
 *
 * This runs in Node on a developer machine, which is NOT the number that fixes
 * the search strategy — the ticket asks for representative supported phones,
 * and Hermes parses JSON and allocates differently from V8. Treat these as an
 * order-of-magnitude floor and a regression guard; the follow-up UI work
 * re-measures on device. The public search API is stable either way, so the
 * internal strategy can change without touching callers.
 *
 *   pnpm --filter @workouts/core bench:foods
 *   node --expose-gc ./node_modules/.bin/tsx scripts/benchmark-shipped-foods.ts
 */

const here = dirname(fileURLToPath(import.meta.url));
const ARTIFACT_PATH = resolve(here, "../src/nutrition/shipped-foods.json");

const QUERIES = [
	{ query: "banaan", locale: "nl" as const },
	{ query: "brood", locale: "nl" as const },
	{ query: "chicken", locale: "en" as const },
	{ query: "yog", locale: "en" as const },
	{ query: "kaas 30", locale: "nl" as const },
	{ query: "e", locale: "en" as const },
];

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	const low = sorted[middle - 1] ?? 0;
	const high = sorted[middle] ?? 0;
	return sorted.length % 2 === 0 ? (low + high) / 2 : high;
}

function time<T>(
	runs: number,
	work: () => T,
): { median: number; worst: number; last: T } {
	const samples: number[] = [];
	let last = work();
	for (let run = 0; run < runs; run += 1) {
		const started = performance.now();
		last = work();
		samples.push(performance.now() - started);
	}
	return { median: median(samples), worst: Math.max(...samples), last };
}

function heapUsedMb(): number {
	const gc = (globalThis as { gc?: () => void }).gc;
	if (gc) {
		gc();
		gc();
	}
	return process.memoryUsage().heapUsed / 1024 / 1024;
}

function main(): void {
	const bytes = statSync(ARTIFACT_PATH).size;
	const text = readFileSync(ARTIFACT_PATH, "utf8");
	const gzipped = gzipSync(text).byteLength;

	const parse = time(20, () => JSON.parse(text) as ShippedArtifact);
	const artifact = parse.last;

	const beforeDecode = heapUsedMb();
	const decode = time(10, () => loadShippedLibrary(artifact));
	const library = decode.last;
	const afterDecode = heapUsedMb();

	const beforeIndex = heapUsedMb();
	const firstSearch = time(1, () => {
		resetSearchIndex();
		return searchShippedFoods("banaan", { locale: "nl", scope: "all" });
	});
	const afterIndex = heapUsedMb();

	const rows: string[] = [];
	for (const scope of ["promoted", "all"] as const) {
		for (const { query, locale } of QUERIES) {
			const measured = time(50, () =>
				searchShippedFoods(query, { locale, scope }),
			);
			rows.push(
				`  ${scope.padEnd(9)} ${`"${query}"`.padEnd(10)} ${locale}  median ${measured.median.toFixed(3)} ms  worst ${measured.worst.toFixed(3)} ms  ${String(measured.last.length).padStart(3)} results`,
			);
		}
	}

	console.log(`
Shipped food library benchmark (Node ${process.version}, V8 — NOT a phone)

Artifact
  file                     ${(bytes / 1024).toFixed(0)} KB on disk, ${(gzipped / 1024).toFixed(0)} KB gzipped
  foods                    ${artifact.foods.length} (${artifact.foods.filter((food) => food.p).length} promoted)
  JSON.parse               median ${parse.median.toFixed(1)} ms, worst ${parse.worst.toFixed(1)} ms
  decode to ShippedFood[]  median ${decode.median.toFixed(1)} ms, worst ${decode.worst.toFixed(1)} ms
  cold open (parse+decode) ~${(parse.median + decode.median).toFixed(1)} ms
  heap held by the library ~${(afterDecode - beforeDecode).toFixed(1)} MB

Search index (built lazily on the first search)
  first search             ${firstSearch.median.toFixed(1)} ms including index build
  heap held by the index   ~${(afterIndex - beforeIndex).toFixed(1)} MB
  indexed foods            ${library.active.length} active, ${library.promoted.length} promoted

Warm searches (50 runs each)
${rows.join("\n")}
`);
}

main();
