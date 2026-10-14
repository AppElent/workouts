import type { NutritionProvenance } from "@foundry/core";
import {
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	personalFoodSnapshot,
	type ShippedFood,
	searchShippedFoods,
	shippedSourceMeta,
} from "@foundry/core/nutrition";
import type { PersonalFood } from "./personal-food-repository";

/**
 * The phone's food library as one searchable catalog (shipped + personal),
 * used by Hulp bij invoeren to find candidates for each described item.
 */

export type BaseUnit = "g" | "ml";

export type AssistanceFood = {
	readonly id: string;
	readonly kind: "shipped" | "personal";
	readonly name: { readonly en: string; readonly nl: string };
	readonly baseUnit: BaseUnit | "serving";
	readonly personalFood?: PersonalFood;
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly provenance: NutritionProvenance;
};

function normalise(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function candidateFromShipped(food: ShippedFood): AssistanceFood {
	const nutrients = Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [key, food.nutrients[key]]),
	) as Record<NutrientKey, NutrientValue>;
	const source = shippedSourceMeta(food);
	return {
		id: food.id,
		kind: "shipped",
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients,
		provenance: {
			source: "shipped",
			sourceId: food.id,
			dataset: source.name,
			edition: source.edition,
			sourceCode: food.code,
			sourceName: food.sourceName,
			saltDerived: source.saltDerived,
		},
	};
}

function candidateFromPersonal(food: PersonalFood): AssistanceFood {
	const snapshot = personalFoodSnapshot(food, { quantity: 1 });
	return {
		id: food.id,
		kind: "personal",
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients: food.nutrients,
		provenance: snapshot.provenance,
		personalFood: food,
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
