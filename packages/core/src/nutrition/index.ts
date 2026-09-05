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
	type NutrientContribution,
	type NutrientTotal,
	totalNutrient,
	totalNutrients,
} from "./aggregate";
export {
	NEVO_ATTRIBUTION,
	NEVO_ATTRIBUTION_MIXED,
	NEVO_LICENCE_CONSTRAINTS,
	NEVO_LICENCE_SOURCE,
	SALT_DERIVATION_DISCLOSURE,
	nevoAttribution,
} from "./attribution";
export {
	SHIPPED_ARTIFACT,
	type ShippedLibrary,
	allShippedFoods,
	getShippedFood,
	getShippedFoodByNevoCode,
	loadShippedLibrary,
	promotedShippedFoods,
	shippedFoodGroups,
	shippedLibrary,
	shippedLibraryMeta,
} from "./library";
export {
	ABSENT,
	NUTRIENT_DISPLAY_DECIMALS,
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientUnit,
	type NutrientValue,
	SHIPPED_NUTRIENT_KEYS,
	type ShippedNutrientKey,
	TRACE,
	isValue,
	numericAmount,
	nutrientValue,
	roundForDisplay,
} from "./nutrients";
export {
	SALT_DERIVATION,
	SALT_FROM_SODIUM_DIVISOR,
	SALT_FROM_SODIUM_FACTOR,
	isDerivedNutrient,
	saltFromSodium,
} from "./salt";
export {
	type FoodSearchResult,
	type SearchMatch,
	type SearchOptions,
	type SearchScope,
	browsePromotedByCategory,
	normaliseForSearch,
	resetSearchIndex,
	searchShippedFoods,
} from "./search";
export {
	type ServingOption,
	type ServingPreview,
	formatQuantity,
	formatServingSelection,
	previewServing,
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
