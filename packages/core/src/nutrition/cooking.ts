import { type NutrientTotal, totalNutrients } from "./aggregate";
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
import { formatQuantity } from "./servings";

/** A cooked recipe is divided by one measured yield, never by a guessed factor. */
export type RecipeYield =
	| { readonly kind: "grams"; readonly amount: number }
	| { readonly kind: "portions"; readonly amount: number };

/** A frozen ingredient selection. Source data is resolved before this is stored. */
export type RecipeIngredientSnapshot = NutritionDiaryPartSnapshot & {
	readonly ingredientId: string;
	readonly sourceKey: string;
};

export type RecipeVersion = {
	readonly id: string;
	readonly recipeId: string;
	readonly name: NutritionBilingual;
	readonly versionName: NutritionBilingual;
	readonly ingredients: readonly RecipeIngredientSnapshot[];
	readonly yield: RecipeYield;
	readonly createdAt: number;
	readonly updatedAt: number;
};

export type RecipeVersionDraft = Pick<
	RecipeVersion,
	"name" | "versionName" | "ingredients" | "yield"
>;

export type RecipePortionRequest =
	| { readonly kind: "grams"; readonly amount: number }
	| { readonly kind: "portions"; readonly amount: number };

/** A recipe total retains counts for absent and trace values for honest UI copy. */
export type RecipeNutritionTotals = Readonly<
	Record<NutrientKey, NutrientTotal>
>;

export type RecipePortion = {
	readonly request: RecipePortionRequest;
	/** The exact ratio applied to the unrounded recipe total. */
	readonly scale: number;
	readonly total: RecipeNutritionTotals;
	readonly nutrients: RecipeNutritionTotals;
};

function positiveFinite(value: number, label: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return value;
}

export function validateRecipeYield(yieldValue: RecipeYield): RecipeYield {
	if (yieldValue.kind !== "grams" && yieldValue.kind !== "portions") {
		throw new Error("Recipe yield must be grams or portions.");
	}
	return {
		kind: yieldValue.kind,
		amount: positiveFinite(yieldValue.amount, "Recipe yield"),
	};
}

export function validateRecipeVersionDraft(
	draft: RecipeVersionDraft,
): RecipeVersionDraft {
	if (!draft.name.en.trim() || !draft.name.nl.trim()) {
		throw new Error("Recipe needs an English and Dutch name.");
	}
	if (!draft.versionName.en.trim() || !draft.versionName.nl.trim()) {
		throw new Error("Recipe version needs an English and Dutch name.");
	}
	if (draft.ingredients.length === 0) {
		throw new Error("Recipe needs at least one ingredient.");
	}
	for (const [index, ingredient] of draft.ingredients.entries()) {
		if (!ingredient.ingredientId.trim() || !ingredient.sourceKey.trim()) {
			throw new Error(`Ingredient ${index + 1} needs a stable identity.`);
		}
		positiveFinite(ingredient.quantity, `Ingredient ${index + 1} quantity`);
		positiveFinite(ingredient.amount, `Ingredient ${index + 1} amount`);
		for (const key of NUTRIENT_KEYS) {
			if (!ingredient.nutrients[key]) {
				throw new Error(`Ingredient ${index + 1} is missing ${key}.`);
			}
		}
	}
	return { ...draft, yield: validateRecipeYield(draft.yield) };
}

/** Sum ingredient snapshots without rounding and without inventing missing figures. */
export function recipeNutritionTotals(
	ingredients: readonly RecipeIngredientSnapshot[],
): RecipeNutritionTotals {
	return totalNutrients(ingredients.map((ingredient) => ingredient.nutrients));
}

export function recipeScale(
	yieldValue: RecipeYield,
	request: RecipePortionRequest,
): number {
	const validYield = validateRecipeYield(yieldValue);
	if (validYield.kind !== request.kind) {
		throw new Error("Recipe request unit must match the saved yield.");
	}
	return positiveFinite(request.amount, "Recipe request") / validYield.amount;
}

export function scaleRecipeTotals(
	totals: RecipeNutritionTotals,
	factor: number,
): RecipeNutritionTotals {
	positiveFinite(factor, "Recipe scale");
	return Object.fromEntries(
		NUTRIENT_KEYS.map((key) => [
			key,
			{ ...totals[key], amount: totals[key].amount * factor },
		]),
	) as RecipeNutritionTotals;
}

/** Build the preview used by both the recipe detail and the durable log path. */
export function recipePortion(
	version: Pick<RecipeVersion, "ingredients" | "yield">,
	request: RecipePortionRequest,
): RecipePortion {
	const total = recipeNutritionTotals(version.ingredients);
	const scale = recipeScale(version.yield, request);
	return {
		request,
		scale,
		total,
		nutrients: scaleRecipeTotals(total, scale),
	};
}

/**
 * The current diary validator cannot represent a mixed known/absent aggregate
 * as one NutrientValue. Log a recipe as one atomic batch of scaled ingredient
 * snapshots instead: each ingredient keeps its own absent/trace state and the
 * diary aggregation can remain qualified. The group id is minted by mobile.
 */
export function recipeBatchSnapshots(
	version: Pick<
		RecipeVersion,
		"recipeId" | "id" | "name" | "versionName" | "ingredients" | "yield"
	>,
	request: RecipePortionRequest,
	date: string,
	meal: NutritionDiarySnapshot["meal"],
	groupId: string,
	mintClientEntryId: () => string,
): Array<NutritionDiarySnapshot & { readonly clientEntryId: string }> {
	const scale = recipeScale(version.yield, request);
	return version.ingredients.map((ingredient) => {
		const amount = ingredient.amount * scale;
		return {
			date,
			meal,
			name: ingredient.name,
			serving: {
				en: `${formatQuantity(amount, "en")} ${ingredient.baseUnit}`,
				nl: `${formatQuantity(amount, "nl")} ${ingredient.baseUnit}`,
			},
			quantity: ingredient.quantity * scale,
			amount,
			baseUnit: ingredient.baseUnit,
			nutrients: rescaleNutrients(ingredient.nutrients, scale),
			provenance: ingredient.provenance,
			comboGroup: {
				id: groupId,
				comboId: version.id,
				name: `${version.name.en} · ${version.versionName.en}`,
			},
			clientEntryId: mintClientEntryId(),
		};
	});
}

/** Format a scaled fixed-food amount for a bilingual snapshot label. */
export function formatCookingAmount(
	amount: number,
	baseUnit: "g" | "ml",
): NutritionBilingual {
	return {
		en: `${formatQuantity(amount, "en")} ${baseUnit}`,
		nl: `${formatQuantity(amount, "nl")} ${baseUnit}`,
	};
}

/** Scale a fixed Combo part at log time; saved Combo defaults remain unchanged. */
export function scaleCookingSnapshot<
	T extends {
		readonly quantity: number;
		readonly amount: number;
		readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	},
>(snapshot: T, multiplier: number): T {
	positiveFinite(multiplier, "Combo multiplier");
	return {
		...snapshot,
		quantity: snapshot.quantity * multiplier,
		amount: snapshot.amount * multiplier,
		nutrients: rescaleNutrients(snapshot.nutrients, multiplier),
	};
}
