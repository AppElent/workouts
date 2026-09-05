import {
	ABSENT,
	type NutrientValue,
	nutrientValue,
	type ShippedNutrientKey,
	TRACE,
} from "./nutrients";
import type {
	FoodCategory,
	ServingBasis,
	ShippedFood,
	ShippedFoodGroup,
	ShippedFoodId,
	ShippedLibraryMeta,
	ShippedServing,
} from "./types";

/**
 * The on-disk shape of `shipped-foods.json`.
 *
 * It is deliberately terser than {@link ShippedFood}: the artifact is ~2,300
 * records that every phone parses on start-up, and spelling `saturatedFat` out
 * 2,300 times costs more than the accessor below does. Nothing outside this
 * file should read the wire shape — decode once, work with `ShippedFood`.
 *
 * Nutrients are a fixed-order array whose order the artifact states in
 * `nutrientOrder`, so an artifact generated before a nutrient was added still
 * decodes correctly:
 *   number  → a value
 *   "t"     → a trace
 *   null    → absent
 */
export type WireNutrients = readonly (number | "t" | null)[];

export type WireServing = {
	readonly en: string;
	readonly nl: string;
	readonly amount: number;
	readonly ml?: number;
	readonly basis?: ServingBasis;
	readonly note?: string;
};

export type WirePromotion = {
	readonly en: string;
	readonly nl: string;
	readonly emoji: string;
	readonly aliasEn?: readonly string[];
	readonly aliasNl?: readonly string[];
	readonly servings: readonly WireServing[];
};

export type WireFood = {
	readonly id: string;
	readonly code: number;
	/** NEVO English name, verbatim. */
	readonly en: string;
	/** NEVO Dutch name, verbatim. */
	readonly nl: string;
	readonly cat: FoodCategory;
	readonly grp: string;
	/** Omitted when the base unit is grams, which is 2,275 of 2,328 rows. */
	readonly unit?: "ml";
	/** NEVO's own `Synoniem` column, split on "/". Dutch only. */
	readonly syn?: readonly string[];
	readonly n: WireNutrients;
	readonly p?: WirePromotion;
	readonly retired?: true;
};

export type ShippedArtifact = {
	readonly schemaVersion: number;
	readonly dataset: {
		readonly name: string;
		readonly edition: string;
		readonly version: string;
		readonly publisher: string;
	};
	readonly generatedFrom: string;
	readonly licence: {
		readonly attribution: string;
		readonly attributionMixed: string;
		readonly constraints: readonly string[];
		readonly source: string;
	};
	readonly derived: {
		readonly salt: {
			readonly from: string;
			readonly formula: string;
			readonly origin: string;
			readonly rationale: string;
		};
	};
	readonly nutrientOrder: readonly ShippedNutrientKey[];
	readonly nutrientUnits: Readonly<Record<string, string>>;
	readonly categories: readonly FoodCategory[];
	readonly groups: Readonly<
		Record<
			string,
			{
				readonly en: string;
				readonly nl: string;
				readonly category: FoodCategory;
			}
		>
	>;
	readonly foods: readonly WireFood[];
};

function decodeNutrients(
	wire: WireNutrients,
	order: readonly ShippedNutrientKey[],
): Record<ShippedNutrientKey, NutrientValue> {
	const nutrients = {} as Record<ShippedNutrientKey, NutrientValue>;
	for (let index = 0; index < order.length; index += 1) {
		const cell = wire[index];
		const key = order[index];
		if (key === undefined) continue;
		if (cell === null || cell === undefined) nutrients[key] = ABSENT;
		else if (cell === "t") nutrients[key] = TRACE;
		else nutrients[key] = nutrientValue(cell);
	}
	return nutrients;
}

function decodeServings(
	wire: readonly WireServing[] | undefined,
): ShippedServing[] {
	if (!wire) return [];
	return wire.map((serving) => ({
		label: { en: serving.en, nl: serving.nl },
		amount: serving.amount,
		...(serving.ml === undefined ? {} : { volumeMl: serving.ml }),
		...(serving.basis === undefined ? {} : { basis: serving.basis }),
		...(serving.note === undefined ? {} : { note: serving.note }),
	}));
}

export function decodeFood(
	wire: WireFood,
	order: readonly ShippedNutrientKey[],
): ShippedFood {
	const sourceName = { en: wire.en, nl: wire.nl };
	return {
		id: wire.id as ShippedFoodId,
		code: wire.code,
		name: wire.p ? { en: wire.p.en, nl: wire.p.nl } : sourceName,
		sourceName,
		aliases: {
			en: wire.p?.aliasEn ?? [],
			// NEVO's synonyms are Dutch-only; overlay aliases extend them.
			nl: [...(wire.syn ?? []), ...(wire.p?.aliasNl ?? [])],
		},
		category: wire.cat,
		group: wire.grp,
		baseUnit: wire.unit ?? "g",
		promoted: wire.p !== undefined,
		...(wire.p ? { emoji: wire.p.emoji } : {}),
		servings: decodeServings(wire.p?.servings),
		retired: wire.retired === true,
		nutrients: decodeNutrients(wire.n, order),
	};
}

export function decodeArtifact(artifact: ShippedArtifact): ShippedFood[] {
	return artifact.foods.map((food) => decodeFood(food, artifact.nutrientOrder));
}

export function artifactGroups(artifact: ShippedArtifact): ShippedFoodGroup[] {
	return Object.entries(artifact.groups).map(([key, group]) => ({
		key,
		name: { en: group.en, nl: group.nl },
		category: group.category,
	}));
}

export function artifactMeta(artifact: ShippedArtifact): ShippedLibraryMeta {
	let promoted = 0;
	let retired = 0;
	for (const food of artifact.foods) {
		if (food.p) promoted += 1;
		if (food.retired) retired += 1;
	}
	return {
		schemaVersion: artifact.schemaVersion,
		dataset: artifact.dataset,
		generatedFrom: artifact.generatedFrom,
		counts: { foods: artifact.foods.length, promoted, retired },
	};
}
