import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	rescaleNutrients,
} from "./nutrients";
import type {
	NutritionBilingual,
	NutritionDiaryPartSnapshot,
	NutritionDiarySnapshot,
} from "./operations";
import { formatQuantity, type ServingOption } from "./servings";
import type { ShippedFoodId } from "./types";

export type PersonalFoodClassification = "ordinary" | "recipe";

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

export type FoodVisual =
	| { readonly kind: "icon"; readonly preset: FoodVisualPresetId }
	| { readonly kind: "photo"; readonly uri: string };

export type PersonalFoodNutritionBasis =
	| { readonly kind: "per100"; readonly unit: "g" | "ml" }
	| { readonly kind: "perServing"; readonly label: NutritionBilingual };

export type PersonalServing = {
	readonly label: NutritionBilingual;
	/** Base units, or a multiple of the food's named serving. */
	readonly amount: number;
};

export type PersonalFoodProvenance = {
	readonly recordOrigin: "personal" | "import";
	readonly nutritionSource: "manual" | "nevo" | "openfoodfacts";
	readonly locallyEdited: boolean;
	readonly forkedFrom?: ShippedFoodId;
	readonly provider?: string;
	readonly barcode?: string;
	readonly attribution?: string;
	readonly brand?: string;
	readonly quantity?: string;
	readonly imageUrl?: string;
	readonly providerServing?: {
		readonly label: string;
		readonly amount: number;
		readonly unit: "g" | "ml";
	};
};

/** Existing callers and backups may omit fields introduced after per-100 foods. */
export type PersonalFoodDraft = {
	readonly name: NutritionBilingual;
	readonly baseUnit: "g" | "ml" | "serving";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly servings: readonly PersonalServing[];
	readonly provenance: PersonalFoodProvenance;
	readonly classification?: PersonalFoodClassification;
	readonly nutritionBasis?: PersonalFoodNutritionBasis;
	readonly estimated?: boolean;
	readonly description?: NutritionBilingual;
	readonly visual?: FoodVisual;
	/** Internal lazy-migration state; never serialized into account backup. */
	readonly visualMigrationPending?: true;
};

export type NormalizedPersonalFoodDraft = PersonalFoodDraft & {
	readonly classification: PersonalFoodClassification;
	readonly nutritionBasis: PersonalFoodNutritionBasis;
	readonly estimated: boolean;
};

export type PersonalFood = NormalizedPersonalFoodDraft & {
	readonly id: string;
	readonly createdAt: number;
	readonly updatedAt: number;
};

function text(value: unknown, label: string): string {
	if (typeof value !== "string" || !value.trim() || value.length > 500) {
		throw new Error(`${label} is required and must be at most 500 characters.`);
	}
	return value.trim();
}

function bilingual(
	value: NutritionBilingual,
	label: string,
): NutritionBilingual {
	return {
		en: text(value?.en, `${label} English`),
		nl: text(value?.nl, `${label} Dutch`),
	};
}

function positive(value: number, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return value;
}

function validateNutrient(value: NutrientValue, label: string): NutrientValue {
	if (value?.kind === "absent") return { kind: "absent" };
	if (value?.kind === "trace") return { kind: "trace" };
	if (value?.kind !== "value") {
		throw new Error(`${label} must have a nutrient state.`);
	}
	if (
		typeof value.amount !== "number" ||
		!Number.isFinite(value.amount) ||
		value.amount < 0
	) {
		throw new Error(`${label} must be zero or greater.`);
	}
	return { kind: "value", amount: value.amount };
}

function validateProvenance(
	candidate: PersonalFoodProvenance,
): PersonalFoodProvenance {
	if (
		candidate?.recordOrigin !== "personal" &&
		candidate?.recordOrigin !== "import"
	) {
		throw new Error("Food provenance has an invalid record origin.");
	}
	if (
		!["manual", "nevo", "openfoodfacts"].includes(candidate.nutritionSource)
	) {
		throw new Error("Food provenance has an invalid nutrition source.");
	}
	if (typeof candidate.locallyEdited !== "boolean") {
		throw new Error("Food provenance must say whether it was edited locally.");
	}
	const optional: Partial<PersonalFoodProvenance> = {};
	for (const key of [
		"forkedFrom",
		"provider",
		"barcode",
		"attribution",
		"brand",
		"quantity",
		"imageUrl",
	] as const) {
		const value = candidate[key];
		if (value !== undefined) {
			if (typeof value !== "string")
				throw new Error(`Food provenance ${key} is invalid.`);
			if (value.trim())
				Object.assign(optional, {
					[key]: text(value, `Food provenance ${key}`),
				});
		}
	}
	if (optional.imageUrl) {
		let url: URL;
		try {
			url = new URL(optional.imageUrl);
		} catch {
			throw new Error("Food provenance has an invalid image URL.");
		}
		if (
			url.protocol !== "https:" ||
			url.hostname !== "images.openfoodfacts.org"
		) {
			throw new Error("Food provenance has an invalid image URL.");
		}
	}
	let providerServing: PersonalFoodProvenance["providerServing"];
	if (candidate.providerServing !== undefined) {
		const serving = candidate.providerServing;
		if (!serving || (serving.unit !== "g" && serving.unit !== "ml")) {
			throw new Error("Food provenance has invalid provider serving data.");
		}
		providerServing = {
			label: text(serving.label, "Provider serving label"),
			amount: positive(serving.amount, "Provider serving amount"),
			unit: serving.unit,
		};
	}
	return {
		recordOrigin: candidate.recordOrigin,
		nutritionSource: candidate.nutritionSource,
		locallyEdited: candidate.locallyEdited,
		...optional,
		...(providerServing ? { providerServing } : {}),
	};
}

export function validateFoodVisual(value: unknown): FoodVisual | undefined {
	if (value === undefined || value === null) return undefined;
	if (!value || typeof value !== "object" || !("kind" in value)) {
		throw new Error("Food visual is invalid.");
	}
	if (value.kind === "icon") {
		if (
			!("preset" in value) ||
			typeof value.preset !== "string" ||
			!FOOD_VISUAL_PRESET_IDS.includes(value.preset as FoodVisualPresetId)
		) {
			throw new Error("An invalid Food Visual icon was selected.");
		}
		return { kind: "icon", preset: value.preset as FoodVisualPresetId };
	}
	if (value.kind === "photo") {
		if (!("uri" in value) || typeof value.uri !== "string") {
			throw new Error("Food photo is invalid.");
		}
		const uri = value.uri.trim();
		if (!uri.startsWith("file://") || uri.length <= "file://".length) {
			throw new Error("Food photos must use managed local files.");
		}
		return { kind: "photo", uri };
	}
	throw new Error("Food visual kind is invalid.");
}

/** Normalize once at the library boundary, retaining absent and trace readings. */
export function validatePersonalFoodDraft(
	draft: PersonalFoodDraft,
): NormalizedPersonalFoodDraft {
	const name = bilingual(draft?.name, "Food name");
	const classification =
		draft.classification === undefined ? "ordinary" : draft.classification;
	if (classification !== "ordinary" && classification !== "recipe") {
		throw new Error("Personal Food classification is invalid.");
	}
	if (draft.estimated !== undefined && typeof draft.estimated !== "boolean") {
		throw new Error("Personal Food estimate status is invalid.");
	}
	let nutritionBasis: PersonalFoodNutritionBasis;
	if (draft.nutritionBasis === undefined) {
		if (draft.baseUnit !== "g" && draft.baseUnit !== "ml") {
			throw new Error(
				"A per-serving Personal Food needs a named nutrition basis.",
			);
		}
		nutritionBasis = { kind: "per100", unit: draft.baseUnit };
	} else if (draft.nutritionBasis?.kind === "per100") {
		const unit = draft.nutritionBasis.unit;
		if ((unit !== "g" && unit !== "ml") || unit !== draft.baseUnit) {
			throw new Error("Per-100 nutrition must match the food's base unit.");
		}
		nutritionBasis = { kind: "per100", unit };
	} else if (draft.nutritionBasis?.kind === "perServing") {
		if (draft.baseUnit !== "serving") {
			throw new Error(
				"Per-serving nutrition must use servings as its base unit.",
			);
		}
		nutritionBasis = {
			kind: "perServing",
			label: bilingual(draft.nutritionBasis.label, "Serving basis label"),
		};
	} else {
		throw new Error("Personal Food nutrition basis is invalid.");
	}
	if (!Array.isArray(draft.servings) || draft.servings.length > 3) {
		throw new Error("A Personal Food can have up to three Servings.");
	}
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		nutrients[key] = validateNutrient(draft.nutrients?.[key], key);
	}
	const visual = validateFoodVisual(draft.visual);
	return {
		name,
		baseUnit: draft.baseUnit,
		classification,
		nutritionBasis,
		estimated: draft.estimated ?? false,
		...(draft.description !== undefined
			? { description: bilingual(draft.description, "Food description") }
			: {}),
		nutrients,
		servings: draft.servings.map((serving, index) => ({
			label: bilingual(serving?.label, `Serving ${index + 1} label`),
			amount: positive(serving?.amount, `Serving ${index + 1} amount`),
		})),
		provenance: validateProvenance(draft.provenance),
		...(visual ? { visual } : {}),
		...(draft.visualMigrationPending ? { visualMigrationPending: true } : {}),
	};
}

export function normalizePersonalFood(
	food: PersonalFoodDraft & {
		readonly id: string;
		readonly createdAt: number;
		readonly updatedAt: number;
	},
): PersonalFood {
	const draft = validatePersonalFoodDraft(food);
	for (const timestamp of [food.createdAt, food.updatedAt]) {
		if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
			throw new Error("Personal Food timestamps are invalid.");
		}
	}
	return {
		...draft,
		id: text(food.id, "Personal Food ID"),
		createdAt: food.createdAt,
		updatedAt: food.updatedAt,
	};
}

export type PersonalFoodSnapshotSelection = {
	readonly quantity: number;
	/** Omit to log one nutrition basis (100 g/ml or one named serving). */
	readonly serving?: PersonalServing;
};

/** Serving choices follow the food's nutrition basis, including weight-free foods. */
export function personalFoodServingOptions(
	food: PersonalFood,
): ServingOption[] {
	const valid = normalizePersonalFood(food);
	return [
		...valid.servings.map((serving, index) => ({
			kind: "authored" as const,
			index,
			...serving,
		})),
		{
			kind: "base-unit",
			amount: 1,
			unit: valid.baseUnit,
			label:
				valid.nutritionBasis.kind === "perServing"
					? valid.nutritionBasis.label
					: valid.baseUnit === "g"
						? { en: "Gram (g)", nl: "Gram (g)" }
						: { en: "Millilitre (ml)", nl: "Milliliter (ml)" },
		},
	];
}

/** Resolve a saved Combo selection using current figures without reinterpreting its unit. */
export function personalFoodSnapshotAtAmount(
	food: PersonalFood,
	selection: {
		readonly amount: number;
		readonly quantity: number;
		readonly baseUnit: NutritionDiaryPartSnapshot["baseUnit"];
		readonly serving?: NutritionBilingual;
	},
): NutritionDiaryPartSnapshot {
	if (food.baseUnit !== selection.baseUnit) {
		throw new Error(
			"This Personal Food's nutrition basis changed. Choose its serving again.",
		);
	}
	const amount = positive(selection.amount, "Amount");
	const quantity = positive(selection.quantity, "Quantity");
	const snapshot = personalFoodSnapshot(food, {
		quantity,
		serving: {
			amount: amount / quantity,
			label:
				food.nutritionBasis.kind === "perServing"
					? food.nutritionBasis.label
					: { en: food.baseUnit, nl: food.baseUnit },
		},
	});
	return {
		...snapshot,
		...(selection.serving
			? { serving: bilingual(selection.serving, "Serving label") }
			: {}),
	};
}

export function personalFoodSnapshot(
	food: PersonalFood,
	selection: PersonalFoodSnapshotSelection &
		Pick<
			NutritionDiarySnapshot,
			"date" | "meal" | "clientEntryId" | "comboGroup"
		>,
): NutritionDiarySnapshot;
export function personalFoodSnapshot(
	food: PersonalFood,
	selection: PersonalFoodSnapshotSelection,
): NutritionDiaryPartSnapshot;
export function personalFoodSnapshot(
	food: PersonalFood,
	selection: PersonalFoodSnapshotSelection &
		Partial<
			Pick<
				NutritionDiarySnapshot,
				"date" | "meal" | "clientEntryId" | "comboGroup"
			>
		>,
): NutritionDiaryPartSnapshot | NutritionDiarySnapshot {
	const valid = normalizePersonalFood(food);
	const quantity = positive(selection.quantity, "Quantity");
	const perServing = valid.nutritionBasis.kind === "perServing";
	const option = selection.serving ?? {
		amount: perServing ? 1 : 100,
		label:
			valid.nutritionBasis.kind === "perServing"
				? valid.nutritionBasis.label
				: { en: `100 ${valid.baseUnit}`, nl: `100 ${valid.baseUnit}` },
	};
	const amount = positive(option.amount, "Serving amount") * quantity;
	positive(amount, "Amount");
	const label = bilingual(option.label, "Serving label");
	const origin = valid.provenance;
	const part: NutritionDiaryPartSnapshot = {
		name: valid.name,
		serving: {
			en: `${label.en} × ${formatQuantity(quantity, "en")}`,
			nl: `${label.nl} × ${formatQuantity(quantity, "nl")}`,
		},
		quantity,
		amount,
		baseUnit: valid.baseUnit,
		nutrients: rescaleNutrients(
			valid.nutrients,
			perServing ? amount : amount / 100,
		),
		provenance: {
			source: origin.recordOrigin,
			sourceId: valid.id,
			nutritionSource: origin.nutritionSource,
			locallyEdited: origin.locallyEdited,
			...(origin.forkedFrom ? { forkedFrom: origin.forkedFrom } : {}),
			...(origin.provider ? { provider: origin.provider } : {}),
			...(origin.barcode ? { barcode: origin.barcode } : {}),
			...(origin.attribution ? { attribution: origin.attribution } : {}),
		},
		...(valid.estimated ? { estimated: true } : {}),
		...(selection.comboGroup
			? { comboGroup: { ...selection.comboGroup } }
			: {}),
	};
	if (selection.date !== undefined && selection.meal !== undefined) {
		return {
			...part,
			date: selection.date,
			meal: selection.meal,
			...(selection.clientEntryId
				? { clientEntryId: selection.clientEntryId }
				: {}),
		};
	}
	return part;
}
