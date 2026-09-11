#!/usr/bin/env tsx
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { WireFood } from "../src/nutrition/artifact";
import {
	shippedArtifactSchema,
	shippedLockSchema,
} from "../src/nutrition/schema";
import {
	buildArtifact,
	EMPTY_LOCK,
	type Resolutions,
	reconcileLock,
	serialiseArtifact,
	serialiseLock,
} from "./build";
import { readNevoExtract } from "./nevo";

/**
 * Generate `src/nutrition/shipped-foods.json` from the three committed inputs:
 * the unchanged NEVO extract, the hand-authored promotion overlay, and the
 * append-only ID lockfile.
 *
 *   pnpm --filter @workouts/core generate:foods
 *   pnpm --filter @workouts/core generate:foods --check
 *   pnpm --filter @workouts/core generate:foods --mint-new
 *   pnpm --filter @workouts/core generate:foods --retire-missing
 *   pnpm --filter @workouts/core generate:foods --accept-change=2063,5562
 *   pnpm --filter @workouts/core generate:foods --remint=2063
 *
 * Running it twice produces byte-identical files: records are ordered by NEVO
 * code, the serialisation is pinned, and derived figures are rounded to a fixed
 * precision. `--check` writes nothing and exits non-zero if the committed files
 * are out of date — that is what CI would run.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const EXTRACT_PATH = resolve(repoRoot, "data/nevo/NEVO2025_v9.0.csv");
const ARTIFACT_PATH = resolve(here, "../src/nutrition/shipped-foods.json");
const LOCK_PATH = resolve(here, "../src/nutrition/shipped-foods.lock.json");

function parseCodeList(argument: string): number[] {
	return argument
		.split(",")
		.map((part) => Number(part.trim()))
		.filter((code) => Number.isInteger(code) && code > 0);
}

function parseArgs(argv: readonly string[]): {
	resolutions: Resolutions;
	check: boolean;
} {
	const resolutions: {
		mintNew: boolean;
		retireMissing: boolean;
		acceptChange: number[];
		remint: number[];
	} = {
		mintNew: false,
		retireMissing: false,
		acceptChange: [],
		remint: [],
	};
	let check = false;

	for (const argument of argv) {
		if (argument === "--mint-new") resolutions.mintNew = true;
		else if (argument === "--retire-missing") resolutions.retireMissing = true;
		else if (argument === "--check") check = true;
		else if (argument.startsWith("--accept-change=")) {
			resolutions.acceptChange.push(
				...parseCodeList(argument.slice("--accept-change=".length)),
			);
		} else if (argument.startsWith("--remint=")) {
			resolutions.remint.push(
				...parseCodeList(argument.slice("--remint=".length)),
			);
		} else {
			throw new Error(`Unknown option ${argument}`);
		}
	}

	return { resolutions, check };
}

function loadLock() {
	if (!existsSync(LOCK_PATH)) return EMPTY_LOCK;
	return shippedLockSchema.parse(JSON.parse(readFileSync(LOCK_PATH, "utf8")));
}

function loadPreviousFoods(): Map<number, WireFood> {
	if (!existsSync(ARTIFACT_PATH)) return new Map();
	const previous = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as {
		foods?: WireFood[];
	};
	return new Map((previous.foods ?? []).map((food) => [food.code, food]));
}

function main(): void {
	const { resolutions, check } = parseArgs(process.argv.slice(2));

	const extract = readNevoExtract(EXTRACT_PATH);
	const lock = loadLock();
	const previousFoods = loadPreviousFoods();

	const reconciled = reconcileLock(extract, lock, resolutions, previousFoods);
	if (reconciled.problems.length > 0) {
		const byKind = new Map<string, typeof reconciled.problems>();
		for (const problem of reconciled.problems) {
			byKind.set(problem.kind, [...(byKind.get(problem.kind) ?? []), problem]);
		}
		console.error(
			`\nGeneration stopped: ${reconciled.problems.length} NEVO code(s) need explicit reconciliation.\n` +
				"Internal ids are permanent and are never reused, so nothing is bound automatically.\n",
		);
		for (const [kind, problems] of byKind) {
			console.error(`  ${problems.length} ${kind}:`);
			for (const problem of problems.slice(0, 8))
				console.error(`    - ${problem.detail}`);
			if (problems.length > 8)
				console.error(`    ... and ${problems.length - 8} more`);
			const first = problems[0];
			if (first) console.error(`    → ${first.remedy}\n`);
		}
		process.exit(1);
	}

	const validatedLock = shippedLockSchema.parse(reconciled.lock);
	const artifact = buildArtifact({ extract, lock: validatedLock });
	shippedArtifactSchema.parse(artifact);

	const artifactText = serialiseArtifact(artifact);
	const lockText = serialiseLock(validatedLock);

	if (check) {
		const staleness: string[] = [];
		if (
			!existsSync(ARTIFACT_PATH) ||
			readFileSync(ARTIFACT_PATH, "utf8") !== artifactText
		) {
			staleness.push("shipped-foods.json");
		}
		if (
			!existsSync(LOCK_PATH) ||
			readFileSync(LOCK_PATH, "utf8") !== lockText
		) {
			staleness.push("shipped-foods.lock.json");
		}
		if (staleness.length > 0) {
			console.error(
				`Out of date: ${staleness.join(", ")}. Run \`pnpm --filter @workouts/core generate:foods\` and commit the result.`,
			);
			process.exit(1);
		}
		console.log("Shipped food artifact and lockfile are up to date.");
		return;
	}

	writeFileSync(LOCK_PATH, lockText, "utf8");
	writeFileSync(ARTIFACT_PATH, artifactText, "utf8");

	const promoted = artifact.foods.filter((food) => food.p).length;
	const retired = artifact.foods.filter((food) => food.retired).length;
	console.log(
		[
			`Wrote ${artifact.foods.length} shipped foods (${promoted} promoted, ${retired} retired) from ${extract.version}.`,
			reconciled.minted.length > 0
				? `Minted ${reconciled.minted.length} new id(s).`
				: "",
			reconciled.retired.length > 0
				? `Retired ${reconciled.retired.length} id(s).`
				: "",
			`Artifact ${(Buffer.byteLength(artifactText) / 1024).toFixed(0)} KB, lockfile ${(Buffer.byteLength(lockText) / 1024).toFixed(0)} KB.`,
		]
			.filter(Boolean)
			.join(" "),
	);
}

main();
