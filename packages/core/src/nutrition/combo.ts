import { RuleError } from "../rules";
import { combinedNutrients } from "./aggregate";
import {
	checkNutrientValue,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "./nutrients";
import { PERSONAL_FOOD_TEXT_LIMIT } from "./personal-food";
import {
	BASE_UNITS,
	type Bilingual,
	NUTRITION_SOURCES,
	type NutritionDiaryPartSnapshot,
	type NutritionProvenance,
} from "./snapshot";

/** A saved Combo part: the diary part snapshot without per-entry extras. */
export type ComboPartSnapshot = Pick<
	NutritionDiaryPartSnapshot,
	| "name"
	| "serving"
	| "quantity"
	| "amount"
	| "baseUnit"
	| "estimated"
	| "nutrients"
	| "provenance"
>;

export type ComboPartReference =
	| { readonly kind: "shipped"; readonly foodId: string }
	| { readonly kind: "personal"; readonly foodId: string }
	| { readonly kind: "oneOff" };

export type ComboPartDraft = {
	readonly id?: string;
	readonly reference: ComboPartReference;
	readonly snapshot: ComboPartSnapshot;
};

export type ComboDraft = {
	readonly name: string;
	readonly parts: readonly ComboPartDraft[];
};

/** A Combo as the library stores it. */
type ComboPart = ComboPartDraft & { readonly id: string };

export type Combo = {
	readonly id: string;
	readonly name: string;
	readonly parts: readonly ComboPart[];
	readonly createdAt: number;
	readonly updatedAt: number;
};

/**
 * Field paths are dotted (`name`, `parts.0.reference`,
 * `parts.1.snapshot.nutrients.energy`, `parts.2.snapshot.provenance`).
 */
type ComboCode =
	| "required"
	| "tooLong"
	| "invalid"
	| "notPositive"
	| "negative"
	| "nested"
	| "referenceMismatch";

function fail(field: string, code: ComboCode): never {
	throw new RuleError<string, ComboCode>(field, code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
	if (typeof value !== "string" || !value.trim()) fail(field, "required");
	if (value.length > PERSONAL_FOOD_TEXT_LIMIT) fail(field, "tooLong");
	return value.trim();
}

function bilingual(value: unknown, field: string): Bilingual {
	if (!isRecord(value)) fail(field, "required");
	return {
		en: text(value.en, `${field}.en`),
		nl: text(value.nl, `${field}.nl`),
	};
}

function positive(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
		fail(field, "notPositive");
	return value;
}

function reference(value: unknown, field: string): ComboPartReference {
	if (!isRecord(value)) fail(field, "required");
	if (value.kind === "combo") fail(field, "nested");
	if (value.kind === "oneOff") return { kind: "oneOff" };
	if (value.kind !== "shipped" && value.kind !== "personal")
		fail(field, "invalid");
	return { kind: value.kind, foodId: text(value.foodId, `${field}.foodId`) };
}

function provenance(
	value: unknown,
	ref: ComboPartReference,
	field: string,
): NutritionProvenance {
	if (!isRecord(value)) fail(field, "required");
	if (ref.kind === "oneOff") {
		if (value.source !== "oneOff") fail(field, "referenceMismatch");
		return { source: "oneOff" };
	}
	if (value.sourceId !== ref.foodId) fail(field, "referenceMismatch");
	if (ref.kind === "shipped") {
		if (value.source !== "shipped") fail(field, "referenceMismatch");
		if (
			typeof value.sourceCode !== "number" ||
			!Number.isFinite(value.sourceCode)
		)
			fail(`${field}.sourceCode`, "invalid");
		if (typeof value.saltDerived !== "boolean")
			fail(`${field}.saltDerived`, "invalid");
		return {
			source: "shipped",
			sourceId: ref.foodId,
			dataset: text(value.dataset, `${field}.dataset`),
			edition: text(value.edition, `${field}.edition`),
			sourceCode: value.sourceCode,
			sourceName: bilingual(value.sourceName, `${field}.sourceName`),
			saltDerived: value.saltDerived,
		};
	}
	if (value.source !== "personal" && value.source !== "import")
		fail(field, "referenceMismatch");
	const source = value.nutritionSource;
	if (!NUTRITION_SOURCES.some((known) => known === source))
		fail(`${field}.nutritionSource`, "invalid");
	if (typeof value.locallyEdited !== "boolean")
		fail(`${field}.locallyEdited`, "invalid");
	const optional = (
		key: "forkedFrom" | "provider" | "barcode" | "attribution",
	) =>
		typeof value[key] === "string" && value[key]
			? { [key]: value[key] as string }
			: {};
	return {
		source: value.source,
		sourceId: ref.foodId,
		nutritionSource: source as (typeof NUTRITION_SOURCES)[number],
		locallyEdited: value.locallyEdited,
		...optional("forkedFrom"),
		...optional("provider"),
		...optional("barcode"),
		...optional("attribution"),
	};
}

function snapshot(
	value: unknown,
	ref: ComboPartReference,
	field: string,
): ComboPartSnapshot {
	if (!isRecord(value)) fail(field, "required");
	const baseUnit = value.baseUnit;
	if (!BASE_UNITS.some((unit) => unit === baseUnit))
		fail(`${field}.baseUnit`, "invalid");
	if (value.estimated !== undefined && value.estimated !== true)
		fail(`${field}.estimated`, "invalid");
	const source = isRecord(value.nutrients) ? value.nutrients : {};
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		const checked = checkNutrientValue(source[key]);
		if (!checked.ok) fail(`${field}.nutrients.${key}`, checked.code);
		nutrients[key] = checked.value;
	}
	return {
		name: bilingual(value.name, `${field}.name`),
		serving: bilingual(value.serving, `${field}.serving`),
		quantity: positive(value.quantity, `${field}.quantity`),
		amount: positive(value.amount, `${field}.amount`),
		baseUnit: baseUnit as ComboPartSnapshot["baseUnit"],
		...(value.estimated ? { estimated: true as const } : {}),
		nutrients,
		provenance: provenance(value.provenance, ref, `${field}.provenance`),
	};
}

function parts(
	value: unknown,
	requireIds: boolean,
): ComboPart[] | ComboPartDraft[] {
	if (!Array.isArray(value) || value.length === 0) fail("parts", "required");
	return value.map((part, index) => {
		const field = `parts.${index}`;
		if (!isRecord(part)) fail(field, "invalid");
		const ref = reference(part.reference, `${field}.reference`);
		const id =
			part.id === undefined && !requireIds
				? undefined
				: text(part.id, `${field}.id`);
		return {
			...(id === undefined ? {} : { id }),
			reference: ref,
			snapshot: snapshot(part.snapshot, ref, `${field}.snapshot`),
		};
	});
}

/** A Combo being saved. Throws `RuleError<string, ComboCode>`. */
export function normalizeComboDraft(draft: unknown): ComboDraft {
	if (!isRecord(draft)) fail("combo", "invalid");
	return { name: text(draft.name, "name"), parts: parts(draft.parts, false) };
}

/** A stored Combo: ids on every part and both timestamps. Throws `RuleError<string, ComboCode>`. */
export function normalizeCombo(combo: unknown): Combo {
	if (!isRecord(combo)) fail("combo", "invalid");
	for (const key of ["createdAt", "updatedAt"] as const) {
		const value = combo[key];
		if (typeof value !== "number" || !Number.isFinite(value))
			fail(key, "invalid");
	}
	return {
		id: text(combo.id, "id"),
		name: text(combo.name, "name"),
		parts: parts(combo.parts, true) as ComboPart[],
		createdAt: combo.createdAt as number,
		updatedAt: combo.updatedAt as number,
	};
}

/**
 * One whole Combo as one reading per nutrient, from the snapshots it was
 * saved with. A part's nutrients already describe the amount it logs.
 */
export function comboNutrients(combo: {
	readonly parts: readonly {
		readonly snapshot: Pick<ComboPartSnapshot, "nutrients">;
	}[];
}): Record<NutrientKey, NutrientValue> {
	return combinedNutrients(combo.parts.map((part) => part.snapshot.nutrients));
}
