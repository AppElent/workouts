import type { NutritionDiarySnapshot } from "@workouts/core";
import {
	recipeBatchSnapshots as coreRecipeBatchSnapshots,
	recipePortion as coreRecipePortion,
	recipeScale as coreRecipeScale,
	scaleCookingSnapshot as coreScaleCookingSnapshot,
	formatCookingAmount,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";
import type {
	CookingRecipe,
	CookingYield,
} from "./nutrition-cooking-repository";

export type CookingRequest =
	| { readonly kind: "grams"; readonly amount: number }
	| { readonly kind: "portions"; readonly amount: number };

export function positiveCookingNumber(value: string, label: string): number {
	const parsed = Number(value.replace(",", ".").trim());
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return parsed;
}

export function recipeScale(
	yieldValue: CookingYield,
	request: CookingRequest,
): number {
	return coreRecipeScale(yieldValue, request);
}

export function recipePreview(recipe: CookingRecipe, request: CookingRequest) {
	const portion = coreRecipePortion(
		{ ingredients: recipe.ingredients, yield: recipe.yield },
		request,
	);
	return {
		scale: portion.scale,
		totals: portion.total,
		nutrients: portion.nutrients,
	};
}

export function recipeLogBatch(
	recipe: CookingRecipe,
	request: CookingRequest,
	date: string,
	meal: NutritionDiarySnapshot["meal"],
	groupId: string,
	mintClientEntryId: () => string,
): Array<NutritionDiarySnapshot & { readonly clientEntryId: string }> {
	return coreRecipeBatchSnapshots(
		{
			recipeId: recipe.id,
			id: recipe.id,
			name: recipe.name,
			versionName: recipe.versionName,
			ingredients: recipe.ingredients,
			yield: recipe.yield,
		},
		request,
		date,
		meal,
		groupId,
		mintClientEntryId,
	);
}

export function scaleComboSnapshot<
	T extends {
		readonly quantity: number;
		readonly amount: number;
		readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	},
>(snapshot: T, multiplier: number): T {
	const scaled = coreScaleCookingSnapshot(snapshot, multiplier);
	if ("serving" in scaled && "baseUnit" in scaled) {
		const baseUnit = scaled.baseUnit;
		if (baseUnit === "g" || baseUnit === "ml") {
			return Object.assign(scaled, {
				serving: formatCookingAmount(scaled.amount, baseUnit),
			});
		}
	}
	return scaled;
}

export function oneOffLogSnapshot(input: {
	date: string;
	meal: NutritionDiarySnapshot["meal"];
	name: { readonly en: string; readonly nl: string };
	amount: number;
	baseUnit?: "g" | "ml";
	nutrients: Partial<Record<NutrientKey, NutrientValue>>;
	clientEntryId: string;
	note?: string;
}): NutritionDiarySnapshot & { readonly clientEntryId: string } {
	if (!Number.isFinite(input.amount) || input.amount <= 0) {
		throw new Error("Log once amount must be greater than zero.");
	}
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS)
		nutrients[key] = input.nutrients[key] ?? { kind: "absent" };
	return {
		date: input.date,
		meal: input.meal,
		name: input.name,
		serving: (() => {
			const label = formatCookingAmount(input.amount, input.baseUnit ?? "g");
			return {
				en: `Estimated · ${label.en}`,
				nl: `Geschat · ${label.nl}`,
			};
		})(),
		quantity: 1,
		amount: input.amount,
		baseUnit: input.baseUnit ?? "g",
		nutrients,
		// The current Convex validator accepts only { source: "oneOff" }.
		// “Estimated” is visible in the serving label until its optional
		// provenance field is added at the shared schema seam.
		provenance: { source: "oneOff" },
		clientEntryId: input.clientEntryId,
	};
}
