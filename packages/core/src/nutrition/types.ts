import type { NutrientValue, ShippedNutrientKey } from "./nutrients";

/** The two languages the library ships in. */
export type Locale = "en" | "nl";

/** Any text that exists in both languages. */
export type Bilingual = { readonly en: string; readonly nl: string };

/**
 * The ten category keys every shipped food is filed under (spec #68, D16).
 * NEVO's own 27 food groups are preserved separately; the 27 → 10 mapping
 * lives in `scripts/generate-shipped-foods.ts` beside the NEVO group names.
 */
export const FOOD_CATEGORIES = [
	"fruit",
	"vegetables",
	"grains",
	"protein",
	"dairy",
	"fats",
	"drinks",
	"snacks",
	"meals",
	"other",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/**
 * A shipped food's permanent identity: a hand-minted slug namespaced with
 * `shipped:`. The prefix is what lets any reader — Convex included — tell a
 * shipped food from a device-minted personal food id without a second field.
 */
export type ShippedFoodId = `shipped:${string}`;

/**
 * How a volume-labelled serving was turned into an amount in a mass base unit.
 *
 * Every NEVO beverage is per 100 **g**, so "Glass (200 ml)" cannot simply store
 * 200. `one-to-one` is the documented `1 ml ≈ 1 g` fallback and is only
 * defensible for water-like drinks; `density` means the amount came from a
 * known density and `note` says which.
 */
export type ServingBasis = "one-to-one" | "density";

export type ShippedServing = {
	readonly label: Bilingual;
	/** Amount in the food's base unit. Authored, never derived from NEVO. */
	readonly amount: number;
	/** Set when the label names a volume but `amount` is a mass. */
	readonly volumeMl?: number;
	/** Required whenever `volumeMl` is set on a `g`-based food. */
	readonly basis?: ServingBasis;
	/** Why this amount — density used, or which everyday portion it reflects. */
	readonly note?: string;
};

export type ShippedFood = {
	readonly id: ShippedFoodId;
	/** NEVO code. Source identity only — never application identity. */
	readonly code: number;
	/**
	 * What to show. The overlay's conversational name for a promoted food, the
	 * verbatim NEVO name otherwise.
	 */
	readonly name: Bilingual;
	/**
	 * The NEVO name exactly as published. The licence forbids amending it, so
	 * "search all" shows this even when a friendlier name exists.
	 */
	readonly sourceName: Bilingual;
	readonly aliases: { readonly en: readonly string[]; readonly nl: readonly string[] };
	readonly category: FoodCategory;
	/** Key into the artifact's NEVO food-group table. */
	readonly group: string;
	readonly baseUnit: "g" | "ml";
	readonly promoted: boolean;
	readonly emoji?: string;
	/** Authored servings, in the order the picker should offer them. */
	readonly servings: readonly ShippedServing[];
	/**
	 * A retired food is withdrawn from search but kept forever so ids are never
	 * reused and Combos that reference it keep resolving.
	 */
	readonly retired: boolean;
	readonly nutrients: Readonly<Record<ShippedNutrientKey, NutrientValue>>;
};

export type ShippedFoodGroup = {
	readonly key: string;
	readonly name: Bilingual;
	readonly category: FoodCategory;
};

export type ShippedLibraryMeta = {
	readonly schemaVersion: number;
	readonly dataset: {
		readonly name: string;
		readonly edition: string;
		readonly version: string;
		readonly publisher: string;
	};
	readonly generatedFrom: string;
	readonly counts: {
		readonly foods: number;
		readonly promoted: number;
		readonly retired: number;
	};
};
