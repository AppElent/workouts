import { RuleError, type RuleResult, ruleResult } from "../rules";
import {
	checkNutrientValue,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	rescaleNutrients,
} from "./nutrients";
import {
	baseUnitServingOption,
	type ServingOption,
	servingAmountLabel,
	servingSelectionLabel,
} from "./servings";
import {
	type BaseUnit,
	type Bilingual,
	FOOD_VISUAL_PRESET_IDS,
	type FoodPhotoStorageId,
	type FoodVisual,
	type FoodVisualPresetId,
	type MeasuredUnit,
	NUTRITION_SOURCES,
	type NutritionDiaryPartSnapshot,
	type NutritionDiarySnapshot,
	type NutritionSource,
} from "./snapshot";
import type { ShippedFoodId } from "./types";

/** The longest name, label or description a Personal Food may carry. */
export const PERSONAL_FOOD_TEXT_LIMIT = 500;

export type PersonalFoodClassification = "ordinary" | "recipe";

/**
 * Field paths are dotted (`name.en`, `servings.0.amount`,
 * `provenance.imageUrl`, `nutrients.energy`).
 */
export type PersonalFoodCode =
	| "required"
	| "tooLong"
	| "notPositive"
	| "negative"
	| "invalid"
	| "unitMismatch"
	| "basisChanged";

export type PersonalFoodNutritionBasis =
	| { readonly kind: "per100"; readonly unit: MeasuredUnit }
	| { readonly kind: "perServing"; readonly label: Bilingual };

export type PersonalServing = {
	readonly label: Bilingual;
	/** Base units, or a multiple of the food's named serving. */
	readonly amount: number;
};

export type PersonalFoodProvenance = {
	readonly recordOrigin: "personal" | "import";
	readonly nutritionSource: NutritionSource;
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
		readonly unit: MeasuredUnit;
	};
};

/** Existing callers and backups may omit fields introduced after per-100 foods. */
export type PersonalFoodDraft = {
	readonly name: Bilingual;
	readonly baseUnit: BaseUnit;
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly servings: readonly PersonalServing[];
	readonly provenance: PersonalFoodProvenance;
	readonly classification?: PersonalFoodClassification;
	readonly nutritionBasis?: PersonalFoodNutritionBasis;
	readonly estimated?: boolean;
	readonly description?: Bilingual;
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

function fail(field: string, code: PersonalFoodCode): never {
	throw new RuleError<string, PersonalFoodCode>(field, code);
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) fail(field, "required");
	if (value.length > PERSONAL_FOOD_TEXT_LIMIT) fail(field, "tooLong");
	return value.trim();
}

function bilingual(value: Bilingual | undefined, field: string): Bilingual {
	return {
		en: text(value?.en, `${field}.en`),
		nl: text(value?.nl, `${field}.nl`),
	};
}

function positive(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
		fail(field, "notPositive");
	return value;
}

function isMeasuredUnit(value: unknown): value is MeasuredUnit {
	return value === "g" || value === "ml";
}

function validateProvenance(
	candidate: PersonalFoodProvenance,
): PersonalFoodProvenance {
	if (
		candidate?.recordOrigin !== "personal" &&
		candidate?.recordOrigin !== "import"
	)
		fail("provenance.recordOrigin", "invalid");
	if (!NUTRITION_SOURCES.includes(candidate.nutritionSource))
		fail("provenance.nutritionSource", "invalid");
	if (typeof candidate.locallyEdited !== "boolean")
		fail("provenance.locallyEdited", "invalid");
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
		if (value === undefined) continue;
		if (typeof value !== "string") fail(`provenance.${key}`, "invalid");
		if (value.trim())
			Object.assign(optional, { [key]: text(value, `provenance.${key}`) });
	}
	// Only Open Food Facts supplies remote product images today.
	if (optional.imageUrl) {
		let url: URL | undefined;
		try {
			url = new URL(optional.imageUrl);
		} catch {
			url = undefined;
		}
		if (
			url?.protocol !== "https:" ||
			url.hostname !== "images.openfoodfacts.org"
		)
			fail("provenance.imageUrl", "invalid");
	}
	let providerServing: PersonalFoodProvenance["providerServing"];
	if (candidate.providerServing !== undefined) {
		const serving = candidate.providerServing;
		if (!serving || !isMeasuredUnit(serving.unit))
			fail("provenance.providerServing", "invalid");
		providerServing = {
			label: text(serving.label, "provenance.providerServing.label"),
			amount: positive(serving.amount, "provenance.providerServing.amount"),
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

function isFoodPhotoStorageId(value: unknown): value is FoodPhotoStorageId {
	return typeof value === "string" && value.length > 0;
}

/** A Food Visual as stored, or `undefined` for none. Throws `RuleError` on field `visual`. */
export function normalizeFoodVisual(value: unknown): FoodVisual | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== "object" || !("kind" in value))
		fail("visual", "invalid");
	if (value.kind === "icon") {
		if (
			!("preset" in value) ||
			typeof value.preset !== "string" ||
			!FOOD_VISUAL_PRESET_IDS.includes(value.preset as FoodVisualPresetId)
		)
			fail("visual", "invalid");
		return { kind: "icon", preset: value.preset as FoodVisualPresetId };
	}
	if (value.kind === "remote") {
		if (
			!("uri" in value) ||
			typeof value.uri !== "string" ||
			!value.uri.startsWith("https://")
		)
			fail("visual", "invalid");
		return { kind: "remote", uri: value.uri };
	}
	if (value.kind === "photo") {
		const uri =
			"uri" in value && typeof value.uri === "string" ? value.uri.trim() : "";
		const storageId =
			"storageId" in value && isFoodPhotoStorageId(value.storageId)
				? value.storageId
				: undefined;
		if (storageId) {
			if (uri && !uri.startsWith("https://") && !uri.startsWith("file://"))
				fail("visual", "invalid");
			return { kind: "photo", uri, storageId };
		}
		if (!uri.startsWith("file://") || uri.length <= "file://".length)
			fail("visual", "invalid");
		return { kind: "photo", uri };
	}
	return fail("visual", "invalid");
}

/**
 * Normalize once at the library boundary, keeping absent and trace readings.
 * Throws `RuleError<string, PersonalFoodCode>`.
 */
export function normalizePersonalFoodDraft(
	draft: PersonalFoodDraft,
): NormalizedPersonalFoodDraft {
	const name = bilingual(draft?.name, "name");
	const classification =
		draft.classification === undefined ? "ordinary" : draft.classification;
	if (classification !== "ordinary" && classification !== "recipe")
		fail("classification", "invalid");
	if (draft.estimated !== undefined && typeof draft.estimated !== "boolean")
		fail("estimated", "invalid");
	let nutritionBasis: PersonalFoodNutritionBasis;
	if (draft.nutritionBasis === undefined) {
		if (!isMeasuredUnit(draft.baseUnit)) fail("nutritionBasis", "required");
		nutritionBasis = { kind: "per100", unit: draft.baseUnit };
	} else if (draft.nutritionBasis?.kind === "per100") {
		const unit = draft.nutritionBasis.unit;
		if (!isMeasuredUnit(unit) || unit !== draft.baseUnit)
			fail("nutritionBasis", "unitMismatch");
		nutritionBasis = { kind: "per100", unit };
	} else if (draft.nutritionBasis?.kind === "perServing") {
		if (draft.baseUnit !== "serving") fail("nutritionBasis", "unitMismatch");
		nutritionBasis = {
			kind: "perServing",
			label: bilingual(draft.nutritionBasis.label, "nutritionBasis.label"),
		};
	} else {
		return fail("nutritionBasis", "invalid");
	}
	if (!Array.isArray(draft.servings)) fail("servings", "invalid");
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		const checked = checkNutrientValue(draft.nutrients?.[key]);
		if (!checked.ok) fail(`nutrients.${key}`, checked.code);
		nutrients[key] = checked.value;
	}
	const visual = normalizeFoodVisual(draft.visual);
	return {
		name,
		baseUnit: draft.baseUnit,
		classification,
		nutritionBasis,
		estimated: draft.estimated ?? false,
		...(draft.description !== undefined
			? { description: bilingual(draft.description, "description") }
			: {}),
		nutrients,
		servings: draft.servings.map((serving, index) => ({
			label: bilingual(serving?.label, `servings.${index}.label`),
			amount: positive(serving?.amount, `servings.${index}.amount`),
		})),
		provenance: validateProvenance(draft.provenance),
		...(visual ? { visual } : {}),
		...(draft.visualMigrationPending ? { visualMigrationPending: true } : {}),
	};
}

export function validatePersonalFoodDraft(
	draft: PersonalFoodDraft,
): RuleResult<NormalizedPersonalFoodDraft, string, PersonalFoodCode> {
	return ruleResult(() => normalizePersonalFoodDraft(draft));
}

/** A stored Personal Food. Throws `RuleError<string, PersonalFoodCode>`. */
export function normalizePersonalFood(
	food: PersonalFoodDraft & {
		readonly id: string;
		readonly createdAt: number;
		readonly updatedAt: number;
	},
): PersonalFood {
	const draft = normalizePersonalFoodDraft(food);
	if (typeof food.createdAt !== "number" || !Number.isFinite(food.createdAt))
		fail("createdAt", "invalid");
	if (typeof food.updatedAt !== "number" || !Number.isFinite(food.updatedAt))
		fail("updatedAt", "invalid");
	return {
		...draft,
		id: text(food.id, "id"),
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
		baseUnitServingOption(
			valid.baseUnit,
			valid.nutritionBasis.kind === "perServing"
				? valid.nutritionBasis.label
				: undefined,
		),
	];
}

/** Resolve a saved Combo selection using current figures without reinterpreting its unit. */
export function personalFoodSnapshotAtAmount(
	food: PersonalFood,
	selection: {
		readonly amount: number;
		readonly quantity: number;
		readonly baseUnit: BaseUnit;
		readonly serving?: Bilingual;
	},
): NutritionDiaryPartSnapshot {
	if (food.baseUnit !== selection.baseUnit) fail("baseUnit", "basisChanged");
	const amount = positive(selection.amount, "amount");
	const quantity = positive(selection.quantity, "quantity");
	const snapshot = personalFoodSnapshot(food, {
		quantity,
		serving: {
			amount: amount / quantity,
			label:
				food.nutritionBasis.kind === "perServing"
					? food.nutritionBasis.label
					: servingAmountLabel(amount / quantity, food.baseUnit),
		},
	});
	return {
		...snapshot,
		...(selection.serving
			? { serving: bilingual(selection.serving, "serving") }
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
	const quantity = positive(selection.quantity, "quantity");
	const perServing = valid.nutritionBasis.kind === "perServing";
	const option = selection.serving ?? {
		amount: perServing ? 1 : 100,
		label:
			valid.nutritionBasis.kind === "perServing"
				? valid.nutritionBasis.label
				: servingAmountLabel(100, valid.baseUnit),
	};
	const amount = positive(option.amount, "serving.amount") * quantity;
	positive(amount, "amount");
	const label = bilingual(option.label, "serving");
	const origin = valid.provenance;
	const part: NutritionDiaryPartSnapshot = {
		name: valid.name,
		...(valid.visual ? { visual: valid.visual } : {}),
		serving: servingSelectionLabel(label, quantity),
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
