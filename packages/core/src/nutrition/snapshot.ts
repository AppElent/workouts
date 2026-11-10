/**
 * The nutrition contract shared by the device, Convex and every client: the
 * vocabularies and the Diary Entry snapshot. Types and tuples only, so every
 * other nutrition module can import it without a cycle.
 */
import type { NutrientKey, NutrientValue } from "./nutrients";

/** Any text that exists in both languages. */
export type Bilingual = { readonly en: string; readonly nl: string };

/** The four diary slots. "Meal" means exactly these, never a Combo. */
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** What a quantity counts: grams, millilitres, or whole named servings. */
export const BASE_UNITS = ["g", "ml", "serving"] as const;
export type BaseUnit = (typeof BASE_UNITS)[number];

/** The base units a weight or volume is measured in. */
export const MEASURED_UNITS = ["g", "ml"] as const;
export type MeasuredUnit = (typeof MEASURED_UNITS)[number];

/** Where a food's figures came from. */
export const NUTRITION_SOURCES = [
	"manual",
	"nevo",
	"lidl",
	"openfoodfacts",
] as const;
export type NutritionSource = (typeof NUTRITION_SOURCES)[number];

export const FOOD_VISUAL_PRESET_IDS = [
	"fruit",
	"vegetable",
	"grains",
	"dairy",
	"egg",
	"meat",
	"fish",
	"meal",
	"snack",
	"drink",
	"supplement",
	"condiment",
] as const;
export type FoodVisualPresetId = (typeof FOOD_VISUAL_PRESET_IDS)[number];

/** A Convex `_storage` id, branded so it is not mistaken for a URI. */
export type FoodPhotoStorageId = string & { readonly __tableName: "_storage" };

export type FoodVisual =
	| { readonly kind: "icon"; readonly preset: FoodVisualPresetId }
	| {
			readonly kind: "photo";
			readonly uri: string;
			readonly storageId?: FoodPhotoStorageId;
	  }
	| { readonly kind: "remote"; readonly uri: string };

/** Values use an explicit amount basis; retries and concurrent quantity edits never drift. */
export type DiaryNutrientCorrection = {
	readonly baseUnit: BaseUnit;
	readonly basisAmount: number;
	readonly nutrients: Readonly<Partial<Record<NutrientKey, NutrientValue>>>;
};

export type NutritionProvenance =
	| {
			readonly source: "shipped";
			readonly sourceId: string;
			readonly dataset: string;
			readonly edition: string;
			readonly sourceCode: number;
			readonly sourceName: Bilingual;
			readonly saltDerived: boolean;
	  }
	| {
			readonly source: "personal" | "import";
			readonly sourceId: string;
			readonly nutritionSource: NutritionSource;
			readonly locallyEdited: boolean;
			readonly forkedFrom?: string;
			readonly provider?: string;
			readonly barcode?: string;
			readonly attribution?: string;
	  }
	| { readonly source: "oneOff" };

/** The Diary Entries logged together from one Combo. */
export type ComboGroup = {
	readonly id: string;
	readonly comboId: string;
	readonly name: string;
};

export type NutritionDiarySnapshot = {
	readonly date: string;
	readonly meal: MealSlot;
	readonly name: Bilingual;
	/** Serving label text; built and re-read only by `servings.ts`. */
	readonly serving: Bilingual;
	readonly quantity: number;
	readonly amount: number;
	readonly baseUnit: BaseUnit;
	/** Stable identity when the selected amount came from a Personal Measure. */
	readonly personalMeasureId?: string;
	readonly visual?: FoodVisual;
	/** Omitted for historical entries and figures that are not estimated. */
	readonly estimated?: true;
	/** Explicit user corrections, distinct from the original source attribution. */
	readonly correctedNutrients?: NutrientKey[];
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly provenance: NutritionProvenance;
	readonly comboGroup?: ComboGroup;
	readonly clientEntryId?: string;
};

/** A Food at an amount without a day or Meal Slot: a Diary Entry or Combo part. */
export type NutritionDiaryPartSnapshot = Omit<
	NutritionDiarySnapshot,
	"date" | "meal" | "clientEntryId"
>;
