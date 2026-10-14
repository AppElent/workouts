import type { NutritionDiarySnapshot, NutritionMealSlot } from "@foundry/core";
import {
	formatQuantity,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	numericAmount,
	personalFoodServingOptions,
	personalFoodSnapshot,
} from "@foundry/core/nutrition";
import type { FunctionReturnType } from "convex/server";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { api } from "../convex/api";
import {
	type AssistanceFood,
	searchAssistanceFoods,
} from "./nutrition-assistance";
import { oneOffLogSnapshot } from "./nutrition-one-off";
import type { PersonalFoodDraft } from "./personal-food-repository";

/**
 * Hulp bij invoeren: the phone half of AI entry (designs/nutrition/ai-entry_final.html).
 *
 * Convex `nutritionAi.describe` splits text or a photo into items with search
 * terms; this module searches the phone's own food library for each item;
 * `nutritionAi.choose` picks one candidate per item, or estimates the item
 * when nothing fits. Nothing here is saved until the person confirms.
 */

export type Described = FunctionReturnType<typeof api.nutritionAi.describe>;
export type DescribedItem = Described["items"][number];
export type Choice = FunctionReturnType<typeof api.nutritionAi.choose>[number];
export type LabelReading = FunctionReturnType<typeof api.nutritionAi.readLabel>;
export type ImageInput = { mediaType: "image/jpeg"; base64: string };

/** Long edge in pixels: label digits stay legible, the upload stays small. */
const IMAGE_EDGE = 1600;
const CANDIDATES_PER_ITEM = 12;

/** Downscale and re-encode a camera or library photo for the AI call. */
export async function prepareImage(uri: string): Promise<ImageInput> {
	const measured = await ImageManipulator.manipulate(uri).renderAsync();
	const scale = Math.min(
		1,
		IMAGE_EDGE / Math.max(measured.width, measured.height),
	);
	const context = ImageManipulator.manipulate(measured);
	if (scale < 1)
		context.resize({
			width: Math.round(measured.width * scale),
			height: Math.round(measured.height * scale),
		});
	const image = await context.renderAsync();
	const saved = await image.saveAsync({
		format: SaveFormat.JPEG,
		compress: 0.7,
		base64: true,
	});
	if (!saved.base64) throw new Error("The photo could not be encoded.");
	return { mediaType: "image/jpeg", base64: saved.base64 };
}

export type ReviewItem = {
	readonly key: string;
	/** The AI's name for what was eaten, shown when nothing matched. */
	readonly described: string;
	/** In the matched food's base unit, or g/ml for an estimate. */
	readonly amount: number;
	readonly unit: "g" | "ml";
	readonly amountLabel: string;
	readonly confidence: DescribedItem["confidence"];
	readonly candidates: readonly AssistanceFood[];
	readonly food?: AssistanceFood;
	/** Totals for `amount` when no food matched; always an estimate. */
	readonly estimate?: Readonly<Record<NutrientKey, NutrientValue>>;
};

/**
 * Local candidates per item: every search term against the shipped and
 * personal library, best rank first. Foods measured per serving are left out
 * because the AI estimates grams or millilitres.
 */
export function groundItems(
	items: readonly DescribedItem[],
	catalog: readonly AssistanceFood[],
	locale: "en" | "nl",
): ReviewItem[] {
	return items.map((item, index) => {
		const ranked = new Map<string, { food: AssistanceFood; rank: number }>();
		for (const term of [...item.searchTerms, item.name]) {
			searchAssistanceFoods(term, catalog, locale, 8).forEach((food, rank) => {
				if (food.baseUnit === "serving") return;
				const prior = ranked.get(food.id);
				if (!prior || prior.rank > rank) ranked.set(food.id, { food, rank });
			});
		}
		return {
			key: `item-${index}`,
			described: item.name,
			amount: item.amount,
			unit: item.unit,
			amountLabel: item.amountLabel,
			confidence: item.confidence,
			candidates: [...ranked.values()]
				.sort((a, b) => a.rank - b.rank)
				.slice(0, CANDIDATES_PER_ITEM)
				.map((entry) => entry.food),
		};
	});
}

/** Shipped foods are offered by their published name, which carries preparation. */
function candidateName(food: AssistanceFood): string {
	if (food.provenance.source === "shipped") {
		const published = food.provenance.sourceName?.nl;
		if (published && published !== food.name.nl)
			return `${food.name.nl} (${published})`;
	}
	return food.name.nl;
}

export function chooseInput(
	items: readonly ReviewItem[],
	brands: readonly (string | null)[],
) {
	return items.map((item, index) => ({
		name: item.described,
		amount: item.amount,
		unit: item.unit,
		brand: brands[index] ?? null,
		candidates: item.candidates.map((food) => ({
			ref: food.id,
			name: candidateName(food),
		})),
	}));
}

export function applyChoices(
	items: readonly ReviewItem[],
	choices: readonly Choice[],
): ReviewItem[] {
	return items.map((item, index) => {
		const choice = choices.find((c) => c.index === index);
		const food = item.candidates.find((c) => c.id === choice?.ref);
		if (food) return { ...item, food };
		const estimate = choice?.estimate;
		return estimate
			? {
					...item,
					estimate: Object.fromEntries(
						NUTRIENT_KEYS.map((key) => [
							key,
							{ kind: "value", amount: estimate[key] },
						]),
					) as Record<NutrientKey, NutrientValue>,
				}
			: item;
	});
}

export function replaceFood(
	item: ReviewItem,
	food: AssistanceFood,
): ReviewItem {
	const { estimate: _estimate, ...rest } = item;
	return { ...rest, food };
}

/**
 * A new amount rescales an estimate proportionally; a matched food is
 * recomputed from its own figures.
 */
export function withAmount(
	item: ReviewItem,
	amount: number,
	locale: "en" | "nl",
): ReviewItem {
	if (!(amount > 0)) return item;
	const estimate = item.estimate
		? scale(item.estimate, amount / item.amount)
		: undefined;
	return {
		...item,
		amount,
		amountLabel: `${formatQuantity(amount, locale)} ${item.unit}`,
		confidence: "high",
		...(estimate ? { estimate } : {}),
	};
}

function scale(
	nutrients: Readonly<Record<NutrientKey, NutrientValue>>,
	factor: number,
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			const value = nutrients[key];
			return [
				key,
				value.kind === "value"
					? { kind: "value", amount: value.amount * factor }
					: value,
			];
		}),
	) as Record<NutrientKey, NutrientValue>;
}

/** Totals for the item's amount, or undefined when it has neither food nor estimate. */
export function itemNutrients(
	item: ReviewItem,
): Readonly<Record<NutrientKey, NutrientValue>> | undefined {
	if (item.food) return scale(item.food.nutrients, item.amount / 100);
	return item.estimate;
}

export type ReviewTotals = Readonly<
	Record<"energy" | "protein" | "carbs" | "fat", number>
>;

/** Absent figures add nothing; they are never read as zero elsewhere. */
export function reviewTotals(items: readonly ReviewItem[]): ReviewTotals {
	const totals = { energy: 0, protein: 0, carbs: 0, fat: 0 };
	for (const item of items) {
		const nutrients = itemNutrients(item);
		if (!nutrients) continue;
		for (const key of Object.keys(totals) as (keyof typeof totals)[])
			totals[key] += numericAmount(nutrients[key]) ?? 0;
	}
	return totals;
}

export function readyToLog(items: readonly ReviewItem[]): boolean {
	return items.length > 0 && items.every((item) => itemNutrients(item));
}

/** One estimated Diary Entry per item; matched items keep their Food Reference. */
export function diarySnapshots(
	items: readonly ReviewItem[],
	date: string,
	meal: NutritionMealSlot,
	mintId: () => string,
): (NutritionDiarySnapshot & { readonly clientEntryId: string })[] {
	return items.map((item) => {
		const food = item.food;
		if (!food) {
			if (!item.estimate)
				throw new Error("Every item needs a food or estimate.");
			return oneOffLogSnapshot({
				date,
				meal,
				name: { en: item.described, nl: item.described },
				amount: item.amount,
				baseUnit: item.unit,
				nutrients: item.estimate,
				clientEntryId: mintId(),
			});
		}
		if (food.personalFood) {
			const base = personalFoodServingOptions(food.personalFood).find(
				(option) => option.kind === "base-unit",
			);
			return {
				...personalFoodSnapshot(food.personalFood, {
					quantity: item.amount,
					serving: base,
					date,
					meal,
				}),
				estimated: true as const,
				clientEntryId: mintId(),
			};
		}
		const unit = food.baseUnit === "ml" ? "ml" : "g";
		return {
			date,
			meal,
			clientEntryId: mintId(),
			name: food.name,
			serving: {
				en: `${unit === "g" ? "Gram (g)" : "Millilitre (ml)"} × ${formatQuantity(item.amount, "en")}`,
				nl: `${unit === "g" ? "Gram (g)" : "Milliliter (ml)"} × ${formatQuantity(item.amount, "nl")}`,
			},
			quantity: item.amount,
			amount: item.amount,
			baseUnit: unit,
			nutrients: scale(food.nutrients, item.amount / 100),
			provenance: food.provenance,
			estimated: true as const,
		};
	});
}

/** Totals of all items as one entry, for Opslaan als → Eén item. */
export function combinedNutrients(
	items: readonly ReviewItem[],
): Record<NutrientKey, NutrientValue> {
	const totals = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, { kind: "value", amount: 0 }]),
	) as Record<NutrientKey, NutrientValue>;
	for (const item of items) {
		const nutrients = itemNutrients(item);
		for (const key of NUTRIENT_KEYS) {
			const value = nutrients?.[key];
			const current = totals[key];
			if (!value || value.kind === "absent" || current.kind !== "value")
				totals[key] = { kind: "absent" };
			else if (value.kind === "value")
				totals[key] = { kind: "value", amount: current.amount + value.amount };
		}
	}
	return totals;
}

// ───────────────────────────── label ─────────────────────────────

const LABEL_KEYS: Record<NutrientKey, keyof LabelReading["per100"]> = {
	energy: "energy",
	protein: "protein",
	carbs: "carbs",
	fat: "fat",
	saturatedFat: "saturatedFat",
	fibre: "fibre",
	sugars: "sugars",
	salt: "salt",
};

/** Label values as nutrient states; kJ fills energy only when kcal is missing. */
export function labelNutrients(
	reading: LabelReading,
): Record<NutrientKey, NutrientValue> {
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => {
			let amount = reading.per100[LABEL_KEYS[key]];
			if (
				key === "energy" &&
				amount === null &&
				reading.per100.energyKj !== null
			)
				amount = Math.round(reading.per100.energyKj / 4.184);
			return [
				key,
				amount === null ? { kind: "absent" } : { kind: "value", amount },
			];
		}),
	) as Record<NutrientKey, NutrientValue>;
}

export type LabelCheck =
	| "energyMismatch"
	| "kjMismatch"
	| "saturatedAboveFat"
	| "sugarsAboveCarbs";

/** Arithmetic that catches a misread digit; each failure is shown, never fixed. */
export function labelChecks(reading: LabelReading): LabelCheck[] {
	const p = reading.per100;
	const failures: LabelCheck[] = [];
	if (
		p.energy !== null &&
		p.protein !== null &&
		p.carbs !== null &&
		p.fat !== null
	) {
		const computed =
			4 * p.protein + 4 * p.carbs + 9 * p.fat + 2 * (p.fibre ?? 0);
		if (p.energy > 0 && Math.abs(computed - p.energy) / p.energy > 0.08)
			failures.push("energyMismatch");
	}
	if (p.energy && p.energyKj && Math.abs(p.energyKj / p.energy - 4.184) > 0.1)
		failures.push("kjMismatch");
	if (p.saturatedFat !== null && p.fat !== null && p.saturatedFat > p.fat)
		failures.push("saturatedAboveFat");
	if (p.sugars !== null && p.carbs !== null && p.sugars > p.carbs)
		failures.push("sugarsAboveCarbs");
	return failures;
}

/** A new Personal Food draft from a label; reviewed in the editor before saving. */
export function personalFoodDraftFromReading(
	reading: LabelReading,
): PersonalFoodDraft {
	return {
		name: reading.name,
		baseUnit: reading.basis,
		classification: "ordinary",
		estimated: false,
		nutritionBasis: { kind: "per100", unit: reading.basis },
		nutrients: labelNutrients(reading),
		servings: reading.servings.map((serving) => ({
			label: serving.name,
			amount: serving.amount,
		})),
		provenance: {
			recordOrigin: "personal",
			nutritionSource: "manual",
			locallyEdited: false,
			...(reading.barcode ? { barcode: reading.barcode } : {}),
			...(reading.brand ? { brand: reading.brand } : {}),
			...(reading.packAmount
				? {
						quantity: `${formatQuantity(reading.packAmount, "nl")} ${reading.basis}`,
					}
				: {}),
		},
	};
}
