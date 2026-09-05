import { describe, expect, test } from "vitest";
import {
	buildArtifact,
	EMPTY_LOCK,
	reconcileLock,
	serialiseArtifact,
} from "../../scripts/build";
import { parseNevoExtract } from "../../scripts/nevo";
import type { OverlayEntry } from "./overlay";

/**
 * The identity rules, exercised by feeding the generator a mutated extract.
 *
 * These are the guarantees a diary entry or a Combo leans on: an id, once
 * minted, means the same food forever, and no source-side change can quietly
 * repoint it.
 */

const HEADER = [
	"NEVO-versie/NEVO-version",
	"Voedingsmiddelgroep",
	"Food group",
	"NEVO-code",
	"Voedingsmiddelnaam/Dutch food name",
	"Engelse naam/Food name",
	"Synoniem",
	"Hoeveelheid/Quantity",
	"Bevat sporen van/Contains traces of",
	"ENERCC (kcal)",
	"PROT (g)",
	"CHO (g)",
	"FAT (g)",
	"FASAT (g)",
	"FIBT (g)",
	"SUGAR (g)",
	"NA (mg)",
].join("|");

type Row = {
	code: number;
	nl: string;
	en: string;
	groupNl?: string;
	groupEn?: string;
	synonyms?: string;
	unit?: "g" | "ml";
	traces?: string;
	energy?: string;
	sodium?: string;
	fibre?: string;
};

function extractOf(rows: readonly Row[], version = "NEVO-Online 2025 9.0") {
	const lines = rows.map((row) =>
		[
			version,
			row.groupNl ?? "Fruits-nl",
			row.groupEn ?? "Fruits",
			String(row.code),
			row.nl,
			row.en,
			row.synonyms ?? "",
			`per 100${row.unit ?? "g"}`,
			row.traces ?? "",
			row.energy ?? "88",
			"2",
			"19",
			"0",
			"0",
			row.fibre ?? "1,8",
			"1",
			row.sodium ?? "2",
		].join("|"),
	);
	return parseNevoExtract([HEADER, ...lines].join("\r\n"));
}

const APPLE: Row = { code: 1, nl: "Appel", en: "Apple" };
const PEAR: Row = { code: 2, nl: "Peer", en: "Pear" };

function lockFor(rows: readonly Row[]) {
	const result = reconcileLock(extractOf(rows), EMPTY_LOCK, { mintNew: true });
	expect(result.problems).toEqual([]);
	return result.lock;
}

describe("minting a shipped id", () => {
	test("refuses to bind an id to an unseen NEVO code without being asked", () => {
		const { problems, lock } = reconcileLock(extractOf([APPLE]), EMPTY_LOCK);
		expect(lock.entries).toHaveLength(0);
		expect(problems).toHaveLength(1);
		expect(problems[0]?.kind).toBe("new");
		expect(problems[0]?.remedy).toContain("--mint-new");
	});

	test("mints a readable slug once asked, and records the edition", () => {
		const lock = lockFor([APPLE, PEAR]);
		expect(lock.entries.map((entry) => entry.id)).toEqual([
			"shipped:apple",
			"shipped:pear",
		]);
		expect(lock.entries[0]?.mintedIn).toBe("2025/9.0");
		expect(lock.entries[0]?.status).toBe("active");
	});

	test("keeps two foods with the same English name apart", () => {
		const lock = lockFor([APPLE, { code: 9, nl: "Appel groen", en: "Apple" }]);
		expect(lock.entries.map((entry) => entry.id)).toEqual([
			"shipped:apple",
			"shipped:apple-9",
		]);
	});

	test("keeps an id unchanged when NEVO only revises the figures", () => {
		const first = lockFor([APPLE]);
		const revised = reconcileLock(
			extractOf([{ ...APPLE, energy: "91", sodium: "3" }]),
			first,
		);
		expect(revised.problems).toEqual([]);
		expect(revised.lock.entries[0]?.id).toBe("shipped:apple");
	});
});

describe("a changed NEVO code", () => {
	const renamed = [{ ...APPLE, nl: "Braam", en: "Blackberry" }];

	test("stops generation instead of inheriting the existing id", () => {
		const { problems, lock } = reconcileLock(
			extractOf(renamed),
			lockFor([APPLE]),
		);
		expect(problems).toHaveLength(1);
		expect(problems[0]?.kind).toBe("changed");
		expect(problems[0]?.id).toBe("shipped:apple");
		expect(lock.entries[0]?.id).toBe("shipped:apple");
	});

	test("says exactly which flag resolves it, either way", () => {
		const { problems } = reconcileLock(extractOf(renamed), lockFor([APPLE]));
		expect(problems[0]?.detail).toContain("Blackberry");
		expect(problems[0]?.remedy).toContain("--accept-change=1");
		expect(problems[0]?.remedy).toContain("--remint=1");
	});

	test("keeps the id when a human says it is the same food renamed", () => {
		const { problems, lock } = reconcileLock(
			extractOf(renamed),
			lockFor([APPLE]),
			{
				acceptChange: [1],
			},
		);
		expect(problems).toEqual([]);
		expect(lock.entries).toHaveLength(1);
		expect(lock.entries[0]?.id).toBe("shipped:apple");
	});

	test("retires the id and mints a new one when it is a different food", () => {
		const { problems, lock } = reconcileLock(
			extractOf(renamed),
			lockFor([APPLE]),
			{ remint: [1] },
		);
		expect(problems).toEqual([]);
		expect(lock.entries).toHaveLength(2);
		expect(
			lock.entries.find((entry) => entry.id === "shipped:apple")?.status,
		).toBe("retired");
		expect(lock.entries.find((entry) => entry.status === "active")?.id).toBe(
			"shipped:blackberry",
		);
	});

	test("also fires when the food moves to another NEVO group", () => {
		const moved = [{ ...APPLE, groupEn: "Vegetables", groupNl: "Groenten" }];
		const { problems } = reconcileLock(extractOf(moved), lockFor([APPLE]));
		expect(problems[0]?.kind).toBe("changed");
	});
});

describe("a retired NEVO code", () => {
	test("stops generation rather than dropping the id silently", () => {
		const { problems, lock } = reconcileLock(
			extractOf([PEAR]),
			lockFor([APPLE, PEAR]),
		);
		expect(problems).toHaveLength(1);
		expect(problems[0]?.kind).toBe("missing");
		expect(problems[0]?.id).toBe("shipped:apple");
		expect(
			lock.entries.find((entry) => entry.id === "shipped:apple")?.status,
		).toBe("active");
	});

	test("keeps the entry forever once retirement is confirmed", () => {
		const { problems, lock } = reconcileLock(
			extractOf([PEAR]),
			lockFor([APPLE, PEAR]),
			{
				retireMissing: true,
			},
		);
		expect(problems).toEqual([]);
		const apple = lock.entries.find((entry) => entry.id === "shipped:apple");
		expect(apple?.status).toBe("retired");
		expect(apple?.retiredIn).toBe("2025/9.0");
	});

	test("freezes the food's last figures so references keep resolving", () => {
		const full = lockFor([APPLE, PEAR]);
		const previous = new Map(
			buildArtifact({
				extract: extractOf([APPLE, PEAR]),
				lock: full,
				overlay: [],
			}).foods.map((food) => [food.code, food]),
		);
		const { lock } = reconcileLock(
			extractOf([PEAR]),
			full,
			{ retireMissing: true },
			previous,
		);
		const apple = lock.entries.find((entry) => entry.id === "shipped:apple");
		expect(apple?.lastKnown?.en).toBe("Apple");
		expect(apple?.lastKnown?.retired).toBe(true);

		const artifact = buildArtifact({
			extract: extractOf([PEAR]),
			lock,
			overlay: [],
		});
		const shippedApple = artifact.foods.find(
			(food) => food.id === "shipped:apple",
		);
		expect(shippedApple?.retired).toBe(true);
		expect(shippedApple?.n[0]).toBe(88);
	});
});

describe("a returning NEVO code", () => {
	function retiredLock() {
		return reconcileLock(extractOf([PEAR]), lockFor([APPLE, PEAR]), {
			retireMissing: true,
		}).lock;
	}

	test("stops generation rather than reactivating on its own", () => {
		const { problems } = reconcileLock(extractOf([APPLE, PEAR]), retiredLock());
		expect(problems).toHaveLength(1);
		expect(problems[0]?.kind).toBe("returning");
		expect(problems[0]?.remedy).toContain("--accept-change=1");
	});

	test("reactivates the original id when a human confirms it is the same food", () => {
		const { problems, lock } = reconcileLock(
			extractOf([APPLE, PEAR]),
			retiredLock(),
			{
				acceptChange: [1],
			},
		);
		expect(problems).toEqual([]);
		expect(lock.entries.find((entry) => entry.code === 1)?.id).toBe(
			"shipped:apple",
		);
		expect(lock.entries.find((entry) => entry.code === 1)?.status).toBe(
			"active",
		);
	});

	test("never reuses a retired id for a different food behind the same code", () => {
		const { problems, lock } = reconcileLock(
			extractOf([{ ...APPLE, nl: "Braam", en: "Blackberry" }, PEAR]),
			retiredLock(),
			{ remint: [1] },
		);
		expect(problems).toEqual([]);
		const forCode1 = lock.entries.filter((entry) => entry.code === 1);
		expect(forCode1.map((entry) => entry.status).sort()).toEqual([
			"active",
			"retired",
		]);
		expect(forCode1.find((entry) => entry.status === "retired")?.id).toBe(
			"shipped:apple",
		);
		expect(forCode1.find((entry) => entry.status === "active")?.id).toBe(
			"shipped:blackberry",
		);
	});
});

describe("generation output", () => {
	test("is byte-identical when run twice over the same inputs", () => {
		const extract = extractOf([APPLE, PEAR]);
		const lock = lockFor([APPLE, PEAR]);
		const once = serialiseArtifact(
			buildArtifact({ extract, lock, overlay: [] }),
		);
		const twice = serialiseArtifact(
			buildArtifact({ extract, lock, overlay: [] }),
		);
		expect(once).toBe(twice);
	});

	test("writes one record per line, ordered by NEVO code", () => {
		const text = serialiseArtifact(
			buildArtifact({
				extract: extractOf([PEAR, APPLE]),
				lock: lockFor([APPLE, PEAR]),
				overlay: [],
			}),
		);
		const records = text
			.split("\n")
			.filter((line) => line.startsWith('\t\t{"id"'));
		expect(records).toHaveLength(2);
		expect(records[0]).toContain('"code":1');
		expect(records[1]).toContain('"code":2');
	});
});

describe("nutrient states as generated", () => {
	const rows: Row[] = [
		{ ...APPLE, sodium: "0", traces: "NA" },
		{ ...PEAR, sodium: "" },
		{ code: 3, nl: "Meloen", en: "Melon", sodium: "40" },
	];

	function artifact() {
		return buildArtifact({
			extract: extractOf(rows),
			lock: lockFor(rows),
			overlay: [],
		});
	}

	test("reads a zero listed under 'contains traces of' as a trace", () => {
		const food = artifact().foods.find((entry) => entry.code === 1);
		expect(food?.n[8]).toBe("t");
	});

	test("reads an empty cell as absent, not zero", () => {
		const food = artifact().foods.find((entry) => entry.code === 2);
		expect(food?.n[8]).toBeNull();
	});

	test("derives salt from sodium and keeps the source figure", () => {
		const food = artifact().foods.find((entry) => entry.code === 3);
		expect(food?.n[8]).toBe(40);
		expect(food?.n[7]).toBe(0.1);
	});

	test("carries absence and trace through into salt", () => {
		const built = artifact().foods;
		expect(built.find((entry) => entry.code === 1)?.n[7]).toBe("t");
		expect(built.find((entry) => entry.code === 2)?.n[7]).toBeNull();
	});
});

describe("the promotion overlay", () => {
	const overlay: OverlayEntry[] = [
		{
			code: 1,
			en: "Apple",
			nl: "Appel",
			emoji: "🍎",
			category: "fruit",
			servings: [{ en: "Apple", nl: "Appel", amount: 130 }],
		},
	];

	test("refuses a code that is not in the extract", () => {
		expect(() =>
			buildArtifact({
				extract: extractOf([PEAR]),
				lock: lockFor([PEAR]),
				overlay,
			}),
		).toThrow(/no NEVO row with this code/);
	});

	test("refuses a promoted beverage with no authored serving", () => {
		const drink: Row = {
			code: 5,
			nl: "Bier",
			en: "Beer",
			groupEn: "Alcoholic beverages",
			groupNl: "Alcohol",
		};
		expect(() =>
			buildArtifact({
				extract: extractOf([drink]),
				lock: lockFor([drink]),
				overlay: [
					{
						code: 5,
						en: "Beer",
						nl: "Bier",
						emoji: "🍺",
						category: "drinks",
						servings: [],
					},
				],
			}),
		).toThrow(/cannot be promoted without a practical authored serving/);
	});

	test("refuses a volume-labelled serving that does not say how it became a mass", () => {
		expect(() =>
			buildArtifact({
				extract: extractOf([APPLE]),
				lock: lockFor([APPLE]),
				overlay: [
					{
						code: 1,
						en: "Apple juice",
						nl: "Appelsap",
						emoji: "🧃",
						category: "drinks",
						servings: [
							{
								en: "Glass (200 ml)",
								nl: "Glas (200 ml)",
								amount: 209,
								ml: 200,
							},
						],
					},
				],
			}),
		).toThrow(/does not say how 200 ml became 209/);
	});

	test("lets the overlay decide the category, overriding the NEVO group map", () => {
		const built = buildArtifact({
			extract: extractOf([APPLE]),
			lock: lockFor([APPLE]),
			overlay,
		});
		expect(built.foods[0]?.cat).toBe("fruit");
		expect(built.foods[0]?.p?.emoji).toBe("🍎");
	});
});
