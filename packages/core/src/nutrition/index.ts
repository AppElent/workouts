/**
 * `@workouts/core/nutrition` — the shipped food library and the pure functions
 * around it.
 *
 * This is a SEPARATE entry point from the `@workouts/core` barrel on purpose
 * (spec #68, D13): it carries the ~500 KB generated NEVO artifact, and esbuild
 * inlines that into any bundle that can reach it. The web app and Convex import
 * the barrel and must never pull this in.
 *
 * Two things are deliberately NOT exported here:
 *   - `./overlay` — generation input, folded into the artifact already.
 *   - `./schema`  — the Zod validation schema, used by the generator and tests.
 *     `zod` is a devDependency; keeping it out of this entry is what keeps
 *     `@workouts/core` free of runtime dependencies on the phone.
 */

export {
	type NutrientContribution,
	type NutrientTotal,
	totalNutrient,
	totalNutrients,
} from "./aggregate";
export {
	artifactGroups,
	artifactMeta,
	decodeArtifact,
	decodeFood,
	type ShippedArtifact,
	type WireFood,
	type WireNutrients,
	type WirePromotion,
	type WireServing,
} from "./artifact";
export {
	NEVO_ATTRIBUTION,
	NEVO_ATTRIBUTION_MIXED,
	NEVO_LICENCE_CONSTRAINTS,
	NEVO_LICENCE_SOURCE,
	nevoAttribution,
	OPEN_FOOD_FACTS_ATTRIBUTION,
	SALT_DERIVATION_DISCLOSURE,
} from "./attribution";
export * from "./cooking";
export {
	type FoodResult,
	type FoodResultsInput,
	type ForkedFoodDraft,
	type ForkedFoodValues,
	type ForkedServing,
	type ForkProvenance,
	type ForkRef,
	foodResults,
	forkHasLocalEdits,
	forkShadows,
	forkShippedFood,
	forkSource,
	isFork,
	type LocalFoodLike,
	MAX_FORK_SERVINGS,
} from "./fork";
export {
	editedGoalCount,
	GOAL_DIRECTIONS,
	GOAL_PRESET_KEYS,
	type GoalDirection,
	type GoalPresetKey,
	NUTRIENT_DEFAULT_DIRECTIONS,
	NUTRITION_GOAL_PRESETS,
	type NutritionGoalValue,
} from "./goals";
export {
	allShippedFoods,
	getShippedFood,
	getShippedFoodByNevoCode,
	loadShippedLibrary,
	promotedShippedFoods,
	SHIPPED_ARTIFACT,
	type ShippedLibrary,
	shippedFoodGroups,
	shippedLibrary,
	shippedLibraryMeta,
} from "./library";
export {
	ABSENT,
	isValue,
	NUTRIENT_DISPLAY_DECIMALS,
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientUnit,
	type NutrientValue,
	numericAmount,
	nutrientValue,
	rescaleNutrients,
	roundForDisplay,
	SHIPPED_NUTRIENT_KEYS,
	type ShippedNutrientKey,
	scaleNutrient,
	TRACE,
} from "./nutrients";
export {
	parseProviderNumber,
	parseProviderNutrient,
} from "./provider";
export {
	isDerivedNutrient,
	SALT_DERIVATION,
	SALT_FROM_SODIUM_DIVISOR,
	SALT_FROM_SODIUM_FACTOR,
	saltFromSodium,
} from "./salt";
export {
	browsePromotedByCategory,
	type FoodSearchResult,
	normaliseForSearch,
	resetSearchIndex,
	type SearchMatch,
	type SearchOptions,
	type SearchScope,
	searchShippedFoods,
} from "./search";
export {
	formatQuantity,
	formatServingSelection,
	previewServing,
	type ServingOption,
	type ServingPreview,
	scaleNutrients,
	servingAmount,
	servingOptions,
	servingVolumeMapping,
} from "./servings";
export {
	type Bilingual,
	FOOD_CATEGORIES,
	type FoodCategory,
	type Locale,
	type ServingBasis,
	type ShippedFood,
	type ShippedFoodGroup,
	type ShippedFoodId,
	type ShippedLibraryMeta,
	type ShippedServing,
} from "./types";
