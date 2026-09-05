import type {
	ShippedArtifact,
	WireFood,
	WireServing,
} from "../src/nutrition/artifact";
import {
	NEVO_ATTRIBUTION,
	NEVO_ATTRIBUTION_MIXED,
	NEVO_LICENCE_CONSTRAINTS,
	NEVO_LICENCE_SOURCE,
} from "../src/nutrition/attribution";
import {
	NUTRIENT_UNITS,
	SHIPPED_NUTRIENT_KEYS,
} from "../src/nutrition/nutrients";
import { type OverlayEntry, PROMOTION_OVERLAY } from "../src/nutrition/overlay";
import {
	SALT_DERIVATION,
	SALT_FROM_SODIUM_DIVISOR,
	SALT_FROM_SODIUM_FACTOR,
} from "../src/nutrition/salt";
import type { LockEntry, ShippedLock } from "../src/nutrition/schema";
import { FOOD_CATEGORIES, type FoodCategory } from "../src/nutrition/types";
import {
	identityFingerprint,
	NEVO_TRACE_CODES,
	type NevoExtract,
	type NevoNutrient,
	type NevoRow,
	nevoEdition,
	parseNevoNumber,
	slugify,
} from "./nevo";

/**
 * Turning the NEVO extract + the promotion overlay + the ID lockfile into the
 * shipped artifact.
 *
 * Kept free of filesystem access so the identity rules can be tested by feeding
 * in a mutated extract; `generate-shipped-foods.ts` is the thin CLI around it.
 */

export const ARTIFACT_SCHEMA_VERSION = 1;
export const LOCK_SCHEMA_VERSION = 1;

/**
 * NEVO's 27 food groups mapped onto the ten category keys (spec #68, D16).
 * The NEVO English group name is the key, so a future edition renaming a group
 * fails loudly here rather than silently filing its foods under "other".
 *
 * A promoted food's category comes from the overlay instead — this map is what
 * the other ~2,180 rows get.
 */
export const GROUP_CATEGORIES: Readonly<Record<string, FoodCategory>> = {
	"Potatoes and tubers": "vegetables",
	Vegetables: "vegetables",
	Fruits: "fruit",
	"Cereal products and types of flour": "grains",
	Bread: "grains",
	"Pastry and biscuits": "snacks",
	"Milk and milk products": "dairy",
	Cheese: "dairy",
	Eggs: "protein",
	"Meat and poultry": "protein",
	"Cold meat cuts": "protein",
	"Fish, crustacean and shellfish": "protein",
	Legumes: "protein",
	"Nuts and seeds": "protein",
	"Meat substitutes and dairy substitutes": "protein",
	"Fats and oils": "fats",
	"Non-alcoholic beverages": "drinks",
	"Alcoholic beverages": "drinks",
	"Sugar, sweets and sweet sauces": "snacks",
	"Savoury snacks": "snacks",
	"Mixed dishes": "meals",
	Soups: "meals",
	"Savoury sauces": "other",
	"Savoury bread spreads": "other",
	"Herbs and spices": "other",
	"Foods for special nutritional use": "other",
	"Miscellaneous foods": "other",
};

/** NEVO groups that are drinks whatever the overlay says. */
const BEVERAGE_GROUPS = new Set([
	"Non-alcoholic beverages",
	"Alcoholic beverages",
]);

// ---------------------------------------------------------------- identity --

export type ReconcileProblemKind = "new" | "changed" | "returning" | "missing";

export type ReconcileProblem = {
	readonly kind: ReconcileProblemKind;
	readonly code: number;
	readonly id?: string;
	readonly detail: string;
	readonly remedy: string;
};

export type Resolutions = {
	/** Bind a `shipped:` id to every NEVO code the lockfile has never seen. */
	readonly mintNew?: boolean;
	/** Retire lock entries whose NEVO code has left the extract. */
	readonly retireMissing?: boolean;
	/** "Same food" — keep the id, rebind it to the new identity fields. */
	readonly acceptChange?: Iterable<number>;
	/** "Different food behind the same code" — retire the id, mint a fresh one. */
	readonly remint?: Iterable<number>;
};

export type ReconcileResult = {
	readonly lock: ShippedLock;
	readonly problems: readonly ReconcileProblem[];
	readonly minted: readonly number[];
	readonly retired: readonly number[];
};

export const LOCK_NOTE =
	"Append-only map from NEVO code to permanent shipped: id. Entries are never deleted and ids are never reused. Regenerate with `pnpm --filter @workouts/core generate:foods`.";

export const EMPTY_LOCK: ShippedLock = {
	schemaVersion: LOCK_SCHEMA_VERSION,
	note: LOCK_NOTE,
	entries: [],
};

function mintId(nameEn: string, code: number, used: Set<string>): string {
	const base = `shipped:${slugify(nameEn)}`;
	if (!used.has(base)) return base;
	// Two NEVO foods share an English name. The code disambiguates and, unlike a
	// counter, does not shift when an unrelated food is added later.
	const withCode = `${base}-${code}`;
	if (!used.has(withCode)) return withCode;
	let suffix = 2;
	while (used.has(`${withCode}-${suffix}`)) suffix += 1;
	return `${withCode}-${suffix}`;
}

/**
 * Reconcile the lockfile against the extract.
 *
 * Nothing here mints, retires or rebinds an id on its own. Every one of those
 * is a deliberate human act, expressed as a flag on the generator, because a
 * NEVO code that changed meaning would otherwise silently inherit an id that
 * diary entries and Combos already point at.
 */
export function reconcileLock(
	extract: NevoExtract,
	lock: ShippedLock,
	resolutions: Resolutions = {},
	previousFoods: ReadonlyMap<number, WireFood> = new Map(),
): ReconcileResult {
	const edition = nevoEdition(extract.version);
	const acceptChange = new Set(resolutions.acceptChange ?? []);
	const remint = new Set(resolutions.remint ?? []);

	const entries: LockEntry[] = lock.entries.map((entry) => ({ ...entry }));
	const usedIds = new Set(entries.map((entry) => entry.id));
	const problems: ReconcileProblem[] = [];
	const minted: number[] = [];
	const retired: number[] = [];

	const activeByCode = new Map<number, LockEntry>();
	const retiredByCode = new Map<number, LockEntry>();
	for (const entry of entries) {
		if (entry.status === "active") activeByCode.set(entry.code, entry);
		else retiredByCode.set(entry.code, entry);
	}

	const mint = (row: NevoRow, fingerprint: string) => {
		const id = mintId(row.nameEn, row.code, usedIds);
		usedIds.add(id);
		const entry: LockEntry = {
			code: row.code,
			id,
			status: "active",
			identity: fingerprint,
			mintedIn: edition,
		};
		entries.push(entry);
		activeByCode.set(row.code, entry);
		minted.push(row.code);
	};

	const retire = (entry: LockEntry) => {
		entry.status = "retired";
		entry.retiredIn = edition;
		const previous = previousFoods.get(entry.code);
		// Freeze the last generated record so a retired food stays readable:
		// Combos read a food's current figures, and a Combo that referenced this
		// id must not start showing nothing.
		if (previous && !entry.lastKnown) {
			entry.lastKnown = {
				...previous,
				retired: true,
			} as LockEntry["lastKnown"];
		}
		activeByCode.delete(entry.code);
		retiredByCode.set(entry.code, entry);
		retired.push(entry.code);
	};

	for (const row of extract.rows) {
		const fingerprint = identityFingerprint(row);
		const active = activeByCode.get(row.code);

		if (active) {
			if (active.identity === fingerprint) continue;
			if (remint.has(row.code)) {
				retire(active);
				mint(row, fingerprint);
				continue;
			}
			if (acceptChange.has(row.code)) {
				active.identity = fingerprint;
				continue;
			}
			problems.push({
				kind: "changed",
				code: row.code,
				id: active.id,
				detail: `NEVO code ${row.code} no longer matches the food ${active.id} was minted for. The extract now says "${row.nameEn}" / "${row.nameNl}" (${row.groupEn}, per 100 ${row.baseUnit}); identity ${active.identity} became ${fingerprint}.`,
				remedy: `If that is the same food renamed or regrouped, rerun with --accept-change=${row.code}. If NEVO now uses this code for a different food, rerun with --remint=${row.code} — ${active.id} is retired and a new id is minted.`,
			});
			continue;
		}

		const previouslyRetired = retiredByCode.get(row.code);
		if (previouslyRetired) {
			if (acceptChange.has(row.code)) {
				previouslyRetired.status = "active";
				previouslyRetired.identity = fingerprint;
				previouslyRetired.retiredIn = undefined;
				previouslyRetired.lastKnown = undefined;
				retiredByCode.delete(row.code);
				activeByCode.set(row.code, previouslyRetired);
				continue;
			}
			if (remint.has(row.code)) {
				mint(row, fingerprint);
				continue;
			}
			problems.push({
				kind: "returning",
				code: row.code,
				id: previouslyRetired.id,
				detail: `NEVO code ${row.code} is back in the extract as "${row.nameEn}", but it was retired here as ${previouslyRetired.id} in ${previouslyRetired.retiredIn}.`,
				remedy: `If it is the same food returning, rerun with --accept-change=${row.code} to reactivate ${previouslyRetired.id}. If NEVO has reused the code for something else, rerun with --remint=${row.code} — ${previouslyRetired.id} stays retired forever and a new id is minted.`,
			});
			continue;
		}

		if (resolutions.mintNew) {
			mint(row, fingerprint);
			continue;
		}
		problems.push({
			kind: "new",
			code: row.code,
			detail: `NEVO code ${row.code} ("${row.nameEn}") has no shipped id yet.`,
			remedy: "Rerun with --mint-new to bind ids to every unseen code.",
		});
	}

	const extractCodes = new Set(extract.rows.map((row) => row.code));
	for (const entry of entries) {
		if (entry.status !== "active" || extractCodes.has(entry.code)) continue;
		if (resolutions.retireMissing) {
			retire(entry);
			continue;
		}
		problems.push({
			kind: "missing",
			code: entry.code,
			id: entry.id,
			detail: `${entry.id} (NEVO code ${entry.code}) is no longer in the extract.`,
			remedy:
				"Rerun with --retire-missing. The id is kept forever and never reused; its last generated record is frozen into the lockfile so Combos that reference it keep resolving.",
		});
	}

	entries.sort((a, b) =>
		a.code === b.code ? a.id.localeCompare(b.id) : a.code - b.code,
	);

	return {
		lock: {
			schemaVersion: LOCK_SCHEMA_VERSION,
			note: lock.note || LOCK_NOTE,
			entries,
		},
		problems,
		minted,
		retired,
	};
}

// ---------------------------------------------------------------- artifact --

export type NutrientCell = number | "t" | null;

/**
 * One nutrient cell, keeping NEVO's three states apart.
 *
 * Empty cell means absent. A `0` whose code is listed in "Contains traces of"
 * is a trace, which NEVO writes as zero "to allow calculations". Anything else
 * is a measured figure, including a genuine measured zero.
 */
export function nutrientCell(row: NevoRow, key: NevoNutrient): NutrientCell {
	const raw = row.cells[key] ?? "";
	const value = parseNevoNumber(raw);
	if (value === undefined) return null;
	if (value === 0 && row.traces.has(NEVO_TRACE_CODES[key])) return "t";
	return value;
}

/** Salt from sodium, preserving absence and trace (spec #68, "Nutrients"). */
export function saltCell(sodium: NutrientCell): NutrientCell {
	if (sodium === null) return null;
	if (sodium === "t") return "t";
	// Fixed precision so a float artefact cannot make two identical runs differ.
	return Number(
		((sodium * SALT_FROM_SODIUM_FACTOR) / SALT_FROM_SODIUM_DIVISOR).toFixed(6),
	);
}

export type OverlayProblem = { readonly code: number; readonly detail: string };

function overlayServing(
	serving: OverlayEntry["servings"][number],
): WireServing {
	return {
		en: serving.en,
		nl: serving.nl,
		amount: serving.amount,
		...(serving.ml === undefined ? {} : { ml: serving.ml }),
		...(serving.basis === undefined ? {} : { basis: serving.basis }),
		...(serving.note === undefined ? {} : { note: serving.note }),
	};
}

/**
 * Check the overlay against the extract before anything is written.
 *
 * The beverage rule is the load-bearing one: every NEVO beverage is per 100 g,
 * so promoting a drink without a serving would hand the user a raw mass-only
 * row as a top result, and a volume-labelled serving without a stated basis
 * would be a made-up number.
 */
export function validateOverlay(
	overlay: readonly OverlayEntry[],
	rowsByCode: ReadonlyMap<number, NevoRow>,
): OverlayProblem[] {
	const problems: OverlayProblem[] = [];
	const seen = new Set<number>();

	for (const entry of overlay) {
		const say = (detail: string) => problems.push({ code: entry.code, detail });

		if (seen.has(entry.code)) say("promoted twice in the overlay");
		seen.add(entry.code);

		const row = rowsByCode.get(entry.code);
		if (!row) {
			say("no NEVO row with this code — check data/nevo/NEVO2025_v9.0.csv");
			continue;
		}
		if (!FOOD_CATEGORIES.includes(entry.category))
			say(`unknown category "${entry.category}"`);
		if (entry.en.trim() === "" || entry.nl.trim() === "")
			say("needs a name in both languages");
		if (entry.emoji.trim() === "") say("needs an emoji");
		if (entry.servings.length > 3)
			say(`has ${entry.servings.length} servings; three is the cap`);

		const isBeverage =
			entry.category === "drinks" || BEVERAGE_GROUPS.has(row.groupEn);
		if (isBeverage && entry.servings.length === 0) {
			say(
				`is a beverage ("${row.nameEn}", ${row.groupEn}) and cannot be promoted without a practical authored serving — every NEVO beverage is per 100 g, so a raw mass-only drink is a poor default result. Leave it to "search all" or author a serving.`,
			);
		}

		for (const serving of entry.servings) {
			if (!(serving.amount > 0))
				say(`serving "${serving.en}" needs a positive amount`);
			if (serving.ml !== undefined && serving.basis === undefined) {
				say(
					`serving "${serving.en}" names a volume but does not say how ${serving.ml} ml became ${serving.amount} ${row.baseUnit}. Set basis "density" with a note naming the figure, or "one-to-one" for a water-like drink.`,
				);
			}
			if (
				serving.basis === "one-to-one" &&
				serving.ml !== undefined &&
				serving.ml !== serving.amount
			) {
				say(
					`serving "${serving.en}" claims 1 ml is 1 g but maps ${serving.ml} ml to ${serving.amount}`,
				);
			}
		}
	}

	return problems;
}

export type BuildInput = {
	readonly extract: NevoExtract;
	readonly lock: ShippedLock;
	readonly overlay?: readonly OverlayEntry[];
};

export function buildArtifact({
	extract,
	lock,
	overlay = PROMOTION_OVERLAY,
}: BuildInput): ShippedArtifact {
	const rowsByCode = new Map(extract.rows.map((row) => [row.code, row]));
	const overlayProblems = validateOverlay(overlay, rowsByCode);
	if (overlayProblems.length > 0) {
		throw new Error(
			`The promotion overlay has ${overlayProblems.length} problem(s):\n${overlayProblems
				.map((problem) => `  NEVO ${problem.code}: ${problem.detail}`)
				.join("\n")}`,
		);
	}

	const overlayByCode = new Map(overlay.map((entry) => [entry.code, entry]));
	const idByCode = new Map<number, string>();
	for (const entry of lock.entries) {
		if (entry.status === "active") idByCode.set(entry.code, entry.id);
	}

	const groups: Record<
		string,
		{ en: string; nl: string; category: FoodCategory }
	> = {};
	const groupKey = (row: NevoRow): string => {
		const category = GROUP_CATEGORIES[row.groupEn];
		if (!category) {
			throw new Error(
				`NEVO food group "${row.groupEn}" is not in GROUP_CATEGORIES. A new NEVO edition has added or renamed a group; map it onto one of the ten category keys.`,
			);
		}
		const key = slugify(row.groupEn);
		groups[key] = { en: row.groupEn, nl: row.groupNl, category };
		return key;
	};

	const foods: WireFood[] = [];

	for (const row of extract.rows) {
		const id = idByCode.get(row.code);
		if (!id)
			throw new Error(
				`NEVO code ${row.code} has no active lock entry; reconcile the lockfile first`,
			);
		const key = groupKey(row);
		const promotion = overlayByCode.get(row.code);
		const category = promotion
			? promotion.category
			: (GROUP_CATEGORIES[row.groupEn] as FoodCategory);

		const sodium = nutrientCell(row, "sodium");
		const cells: Record<string, NutrientCell> = {
			energy: nutrientCell(row, "energy"),
			protein: nutrientCell(row, "protein"),
			carbs: nutrientCell(row, "carbs"),
			fat: nutrientCell(row, "fat"),
			saturatedFat: nutrientCell(row, "saturatedFat"),
			fibre: nutrientCell(row, "fibre"),
			sugars: nutrientCell(row, "sugars"),
			salt: saltCell(sodium),
			sodium,
		};

		foods.push({
			id,
			code: row.code,
			en: row.nameEn,
			nl: row.nameNl,
			cat: category,
			grp: key,
			...(row.baseUnit === "ml" ? { unit: "ml" as const } : {}),
			...(row.synonyms.length > 0 ? { syn: row.synonyms } : {}),
			n: SHIPPED_NUTRIENT_KEYS.map((nutrient) => cells[nutrient] ?? null),
			...(promotion
				? {
						p: {
							en: promotion.en,
							nl: promotion.nl,
							emoji: promotion.emoji,
							...(promotion.aliasEn?.length
								? { aliasEn: promotion.aliasEn }
								: {}),
							...(promotion.aliasNl?.length
								? { aliasNl: promotion.aliasNl }
								: {}),
							servings: promotion.servings.map(overlayServing),
						},
					}
				: {}),
		});
	}

	// Retired foods stay in the artifact forever, carrying the figures they had
	// when they left NEVO, so a Combo or diary reference to them still resolves.
	for (const entry of lock.entries) {
		if (entry.status === "retired" && entry.lastKnown) {
			foods.push({ ...(entry.lastKnown as WireFood), retired: true });
		}
	}

	foods.sort((a, b) =>
		a.code === b.code ? a.id.localeCompare(b.id) : a.code - b.code,
	);

	const orderedGroups = Object.fromEntries(
		Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)),
	);
	const edition = nevoEdition(extract.version);

	return {
		schemaVersion: ARTIFACT_SCHEMA_VERSION,
		dataset: {
			name: "NEVO-online",
			edition,
			version: extract.version,
			publisher: "RIVM, Bilthoven",
		},
		generatedFrom:
			"data/nevo/NEVO2025_v9.0.csv + packages/core/src/nutrition/overlay.ts",
		licence: {
			attribution: NEVO_ATTRIBUTION,
			attributionMixed: NEVO_ATTRIBUTION_MIXED,
			constraints: NEVO_LICENCE_CONSTRAINTS,
			source: NEVO_LICENCE_SOURCE,
		},
		derived: {
			salt: {
				from: SALT_DERIVATION.from,
				formula: SALT_DERIVATION.formula,
				origin: SALT_DERIVATION.origin,
				rationale: SALT_DERIVATION.rationale,
			},
		},
		nutrientOrder: [...SHIPPED_NUTRIENT_KEYS],
		nutrientUnits: NUTRIENT_UNITS,
		categories: [...FOOD_CATEGORIES],
		groups: orderedGroups,
		foods,
	};
}

// ------------------------------------------------------------- serialising --

/**
 * A pinned serialisation: the header is indented for reading, and every food or
 * lock entry sits on exactly one line.
 *
 * Both files are committed, so this is what keeps a regeneration's diff to the
 * records that actually changed instead of rewriting tens of thousands of lines.
 */
function serialise(
	header: Record<string, unknown>,
	listKey: string,
	list: readonly unknown[],
): string {
	const head = JSON.stringify(header, null, "\t");
	const lines = list.map((item) => `\t\t${JSON.stringify(item)}`);
	const body = lines.length === 0 ? "[]" : `[\n${lines.join(",\n")}\n\t]`;
	const opened = head === "{}" ? "{" : head.slice(0, -2);
	return `${opened},\n\t${JSON.stringify(listKey)}: ${body}\n}\n`;
}

export function serialiseArtifact(artifact: ShippedArtifact): string {
	const { foods, ...header } = artifact;
	return serialise(header, "foods", foods);
}

export function serialiseLock(lock: ShippedLock): string {
	const { entries, ...header } = lock;
	return serialise(header, "entries", entries);
}
