import type {
	NutritionDiarySnapshot,
	NutritionMealSlot,
	NutritionProvenance,
} from "@workouts/core";
import {
	formatQuantity,
	getShippedFood,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	type ShippedFood,
	searchShippedFoods,
	shippedLibraryMeta,
} from "@workouts/core/nutrition";
import type {
	PersonalFood,
	PersonalFoodDraft,
} from "./personal-food-repository";

export type BaseUnit = "g" | "ml";

export type AssistanceFood = {
	readonly id: string;
	readonly kind: "shipped" | "personal";
	readonly name: { readonly en: string; readonly nl: string };
	readonly baseUnit: BaseUnit;
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly provenance: NutritionProvenance;
};

export type AssistanceRowStatus =
	| "unresolved"
	| "ambiguous"
	| "needs-selection"
	| "selected";

export type AssistanceRow = {
	readonly id: string;
	readonly raw: string;
	readonly query: string;
	readonly quantity: number | undefined;
	readonly unit: BaseUnit | undefined;
	readonly candidates: readonly AssistanceFood[];
	readonly selectedCandidateId: string | undefined;
	readonly status: AssistanceRowStatus;
	readonly error:
		| "unsupported-quantity"
		| "invalid-quantity"
		| "no-match"
		| "unit-mismatch"
		| undefined;
};

export type LabelEnergyBasis = "kcal-label" | "kj-converted" | undefined;

export const MAX_ASSISTANCE_ROWS = 100;
export const MAX_ASSISTANCE_INPUT_LENGTH = 12_000;

export type ParsedNutritionLabel = {
	readonly name: { readonly en: string; readonly nl: string };
	readonly baseUnit: BaseUnit;
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly energyBasis: LabelEnergyBasis;
};

const QUANTITY_PATTERN =
	/^\s*(\d+(?:[.,]\d+)?)\s*(g|gram|grams|grammen|ml|millilitre|millilitres|milliliter|milliliters)\s+(.+?)\s*$/i;
const DECIMAL_PATTERN = /^\d+(?:[.,]\d+)?$/;

function parseDecimal(value: string): number | undefined {
	if (!DECIMAL_PATTERN.test(value.trim())) return undefined;
	const parsed = Number(value.trim().replace(",", "."));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalise(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function unitOf(value: string): BaseUnit {
	return value.toLowerCase().startsWith("m") ? "ml" : "g";
}

function candidateFromShipped(food: ShippedFood): AssistanceFood {
	const nutrients = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, food.nutrients[key]]),
	) as Record<NutrientKey, NutrientValue>;
	const meta = shippedLibraryMeta();
	return {
		id: food.id,
		kind: "shipped",
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients,
		provenance: {
			source: "shipped",
			sourceId: food.id,
			dataset: meta.dataset.name,
			edition: meta.dataset.edition,
			sourceCode: food.code,
			sourceName: food.sourceName,
			saltDerived: true,
		},
	};
}

function candidateFromPersonal(food: PersonalFood): AssistanceFood {
	const provenance = food.provenance;
	return {
		id: food.id,
		kind: "personal",
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients: food.nutrients,
		provenance: {
			source: provenance.recordOrigin,
			sourceId: food.id,
			nutritionSource: provenance.nutritionSource,
			locallyEdited: provenance.locallyEdited,
			...(provenance.forkedFrom ? { forkedFrom: provenance.forkedFrom } : {}),
			...(provenance.provider ? { provider: provenance.provider } : {}),
			...(provenance.barcode ? { barcode: provenance.barcode } : {}),
			...(provenance.attribution
				? { attribution: provenance.attribution }
				: {}),
		},
	};
}

export function buildAssistanceFoodCatalog(
	shipped: readonly ShippedFood[],
	personal: readonly PersonalFood[],
): readonly AssistanceFood[] {
	return [
		...shipped.map(candidateFromShipped),
		...personal.map(candidateFromPersonal),
	];
}

function scoreCandidate(
	query: string,
	food: AssistanceFood,
	locale: "en" | "nl",
): number {
	const wanted = normalise(query);
	const name = normalise(food.name[locale]);
	const other = normalise(food.name[locale === "en" ? "nl" : "en"]);
	if (name === wanted || other === wanted) return 0;
	if (name.startsWith(wanted) || other.startsWith(wanted)) return 1;
	const words = wanted.split(" ").filter(Boolean);
	if (words.length > 0 && words.every((word) => name.includes(word))) return 2;
	if (name.includes(wanted) || other.includes(wanted)) return 3;
	return Number.POSITIVE_INFINITY;
}

export function searchAssistanceFoods(
	query: string,
	catalog: readonly AssistanceFood[],
	locale: "en" | "nl",
	limit = 8,
): readonly AssistanceFood[] {
	const wanted = normalise(query);
	if (!wanted) return [];
	const shippedById = new Map(
		catalog
			.filter((food) => food.kind === "shipped")
			.map((food) => [food.id, food]),
	);
	const shippedMatches = searchShippedFoods(query, {
		locale,
		scope: "all",
		limit,
	}).flatMap((match) => {
		const candidate = shippedById.get(match.food.id);
		return candidate ? [candidate] : [];
	});
	const personalMatches = catalog
		.filter((food) => food.kind === "personal")
		.map((food) => ({ food, score: scoreCandidate(query, food, locale) }))
		.filter(({ score }) => Number.isFinite(score))
		.sort(
			(a, b) =>
				a.score - b.score ||
				a.food.name[locale].localeCompare(b.food.name[locale], locale) ||
				a.food.id.localeCompare(b.food.id),
		)
		.map(({ food }) => food);
	return [...shippedMatches, ...personalMatches]
		.filter(
			(food, index, all) =>
				all.findIndex((item) => item.id === food.id) === index,
		)
		.slice(0, limit);
}

function splitInput(text: string): readonly string[] {
	return text
		.split(/(?:,(?=\s|$)|;|\n|\s+\b(?:and|en)\b)/i)
		.map((item) => item.trim())
		.filter(Boolean);
}

export function assistanceInputError(
	text: string,
): "too-long" | "too-many-rows" | undefined {
	if (text.length > MAX_ASSISTANCE_INPUT_LENGTH) return "too-long";
	if (splitInput(text).length > MAX_ASSISTANCE_ROWS) return "too-many-rows";
	return undefined;
}

function rowFromText(
	raw: string,
	index: number,
	catalog: readonly AssistanceFood[],
	locale: "en" | "nl",
): AssistanceRow {
	const id = `row-${index}`;
	const match = QUANTITY_PATTERN.exec(raw);
	if (!match) {
		return {
			id,
			raw,
			query: raw,
			quantity: undefined,
			unit: undefined,
			candidates: [],
			selectedCandidateId: undefined,
			status: "unresolved",
			error: "unsupported-quantity",
		};
	}
	const quantity = parseDecimal(match[1]);
	const unit = unitOf(match[2]);
	if (quantity === undefined) {
		return {
			id,
			raw,
			query: match[3],
			quantity: undefined,
			unit,
			candidates: [],
			selectedCandidateId: undefined,
			status: "unresolved",
			error: "invalid-quantity",
		};
	}
	const candidates = searchAssistanceFoods(match[3], catalog, locale);
	return {
		id,
		raw,
		query: match[3],
		quantity,
		unit,
		candidates,
		selectedCandidateId: undefined,
		status:
			candidates.length > 1
				? "ambiguous"
				: candidates.length === 1
					? "needs-selection"
					: "unresolved",
		error: candidates.length === 0 ? "no-match" : undefined,
	};
}

export function parseTextAssistedLog(
	text: string,
	catalog: readonly AssistanceFood[],
	locale: "en" | "nl",
): readonly AssistanceRow[] {
	if (assistanceInputError(text)) return [];
	return splitInput(text).map((raw, index) =>
		rowFromText(raw, index, catalog, locale),
	);
}

export function reparseAssistanceRow(
	row: AssistanceRow,
	text: string,
	catalog: readonly AssistanceFood[],
	locale: "en" | "nl",
): AssistanceRow {
	return { ...rowFromText(text, 0, catalog, locale), id: row.id, raw: text };
}

export function selectAssistanceFood(
	row: AssistanceRow,
	candidateId: string,
): AssistanceRow {
	const candidate = row.candidates.find((item) => item.id === candidateId);
	if (
		!candidate ||
		!row.quantity ||
		!row.unit ||
		candidate.baseUnit !== row.unit
	) {
		return {
			...row,
			selectedCandidateId: undefined,
			status: "unresolved",
			error: "unit-mismatch",
		};
	}
	return {
		...row,
		selectedCandidateId: candidate.id,
		status: "selected",
		error: undefined,
	};
}

export function allAssistanceRowsSelected(
	rows: readonly AssistanceRow[],
): boolean {
	return (
		rows.length > 0 &&
		rows.every(
			(row) =>
				row.status === "selected" && row.selectedCandidateId !== undefined,
		)
	);
}

function scaleNutrients(
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>,
	amount: number,
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = nutrients[key];
			return [
				key,
				value.kind === "value"
					? { kind: "value", amount: value.amount * (amount / 100) }
					: value,
			];
		}),
	) as Record<NutrientKey, NutrientValue>;
}

export function buildAssistanceBatchEntries(
	rows: readonly AssistanceRow[],
	date: string,
	meal: NutritionMealSlot,
	mintId: () => string,
): readonly (NutritionDiarySnapshot & { readonly clientEntryId: string })[] {
	if (rows.length > MAX_ASSISTANCE_ROWS)
		throw new Error("A text batch cannot contain more than 100 rows.");
	if (!allAssistanceRowsSelected(rows))
		throw new Error("Every food needs an explicit selection.");
	return rows.map((row) => {
		const candidate = row.candidates.find(
			(item) => item.id === row.selectedCandidateId,
		);
		if (!candidate || row.quantity === undefined || row.unit === undefined) {
			throw new Error("Every food needs an explicit selection.");
		}
		const formatted = formatQuantity(row.quantity, "en");
		const formattedNl = formatQuantity(row.quantity, "nl");
		return {
			date,
			meal,
			clientEntryId: mintId(),
			name: candidate.name,
			serving: {
				en: `${row.unit === "g" ? "Gram (g)" : "Millilitre (ml)"} × ${formatted}`,
				nl: `${row.unit === "g" ? "Gram (g)" : "Milliliter (ml)"} × ${formattedNl}`,
			},
			quantity: row.quantity,
			amount: row.quantity,
			baseUnit: row.unit,
			nutrients: scaleNutrients(candidate.nutrients, row.quantity),
			provenance: candidate.provenance,
		};
	});
}

const LABEL_ALIASES: readonly [NutrientKey, RegExp][] = [
	[
		"saturatedFat",
		/^(?:of\s+which\s+)?(?:saturates?|saturated\s+fat|verzadigd\s+vet)\b/i,
	],
	["energy", /^(?:energy|energie)\b/i],
	["protein", /^(?:protein|proteine|eiwitten?)\b/i],
	["carbs", /^(?:carbohydrates?|carbs?|koolhydraten?)\b/i],
	["fat", /^(?:fat|vet)\b/i],
	["fibre", /^(?:fibre|fiber|vezels?)\b/i],
	["sugars", /^(?:sugars?|suikers?)\b/i],
	["salt", /^(?:salt|zout)\b/i],
];

function nutrientLine(line: string) {
	const clean = line.replace(/^\s*[-•]\s*/, "").trim();
	for (const [key, alias] of LABEL_ALIASES) {
		const match = alias.exec(clean);
		if (match)
			return {
				key,
				valueText: clean.slice(match[0].length).replace(/^\s*[:=-]?\s*/, ""),
			};
	}
	return undefined;
}

function labelValue(
	text: string,
	key: NutrientKey,
): { value: NutrientValue; basis?: LabelEnergyBasis } {
	const matches = [
		...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|g)\b/gi),
	].map((match) => ({
		amount: Number(match[1].replace(",", ".")),
		unit: match[2].toLowerCase(),
	}));
	const usable = matches.filter(
		(item) => Number.isFinite(item.amount) && item.amount >= 0,
	);
	if (usable.length === 0) return { value: { kind: "absent" } };
	if (key === "energy") {
		const kcal = usable.find((item) => item.unit === "kcal");
		if (kcal)
			return {
				value: { kind: "value", amount: kcal.amount },
				basis: "kcal-label",
			};
		const kj = usable.find((item) => item.unit === "kj");
		if (kj) {
			const kcal = Math.round((kj.amount / 4.184) * 10) / 10;
			return { value: { kind: "value", amount: kcal }, basis: "kj-converted" };
		}
		return { value: { kind: "absent" } };
	}
	const first = usable[0];
	if (!first || !["g", "mg"].includes(first.unit))
		return { value: { kind: "absent" } };
	return {
		value: {
			kind: "value",
			amount: first.unit === "mg" ? first.amount / 1000 : first.amount,
		},
	};
}

export function parseNutritionLabel(
	text: string,
): ParsedNutritionLabel | undefined {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const basisLine = lines.find((line) =>
		/\bper\s*100\s*(?:g|ml)\b|\b100\s*(?:g|ml)\b/i.test(line),
	);
	const basisMatch = basisLine?.match(/(?:per\s*)?100\s*(g|ml)\b/i);
	if (!basisMatch) return undefined;
	const baseUnit = basisMatch[1].toLowerCase() === "ml" ? "ml" : "g";
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) nutrients[key] = { kind: "absent" };
	let energyBasis: LabelEnergyBasis;
	const consumed = new Set<string>();
	for (const line of lines) {
		const parsed = nutrientLine(line);
		if (!parsed || consumed.has(parsed.key)) continue;
		const value = labelValue(parsed.valueText, parsed.key);
		nutrients[parsed.key] = value.value;
		if (parsed.key === "energy") energyBasis = value.basis;
		consumed.add(parsed.key);
	}
	const explicitName = lines
		.find((line) => /^(?:name|naam)\s*:/i.test(line))
		?.replace(/^(?:name|naam)\s*:\s*/i, "");
	const fallbackName =
		lines.find((line) => line !== basisLine && !nutrientLine(line)) ??
		"Pasted label food";
	const name = (explicitName || fallbackName).trim() || "Pasted label food";
	return { name: { en: name, nl: name }, baseUnit, nutrients, energyBasis };
}

export function editableLabelNutrients(
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>,
): Record<NutrientKey, string> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [
			key,
			nutrients[key].kind === "value" ? String(nutrients[key].amount) : "",
		]),
	) as Record<NutrientKey, string>;
}

export function nutrientsFromLabelInputs(
	inputs: Readonly<Record<NutrientKey, string>>,
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const raw = inputs[key].trim();
			if (!raw) return [key, { kind: "absent" }];
			const amount = Number(raw.replace(",", "."));
			if (!Number.isFinite(amount) || amount < 0)
				throw new Error(`Invalid ${key}.`);
			return [key, { kind: "value", amount }];
		}),
	) as Record<NutrientKey, NutrientValue>;
}

export function personalFoodDraftFromLabel(
	label: ParsedNutritionLabel,
	name: { en: string; nl: string },
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>,
	baseUnit: BaseUnit = label.baseUnit,
): PersonalFoodDraft {
	return {
		name,
		baseUnit,
		nutrients,
		servings: [],
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: true,
			attribution: "Reviewed from pasted nutrition-label text.",
		},
	};
}

export function shippedCandidate(id: string): AssistanceFood | undefined {
	const food = getShippedFood(id);
	return food ? candidateFromShipped(food) : undefined;
}
