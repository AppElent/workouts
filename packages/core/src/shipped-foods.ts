/**
 * `@foundry/core/shipped-foods`: the code that reads the shipped food
 * artifact. It is a separate entry from the `@foundry/core` barrel because
 * esbuild inlines an imported JSON module into every bundle that reaches it,
 * and the artifact is ~500 KB. The web app and Convex functions that do not
 * read shipped foods import only the barrel. Everything that does not need the
 * artifact lives in the barrel; nothing is exported from both.
 */

export {
	foodSnapshot,
	foodSnapshotAtAmount,
	type LibraryFood,
	shippedFoodProvenance,
} from "./nutrition/food-snapshot";
export {
	type FoodResult,
	foodResults,
	forkHasLocalEdits,
	forkShippedFood,
	forkSource,
} from "./nutrition/fork";
export {
	allShippedFoods,
	getShippedFood,
	shippedLibrary,
} from "./nutrition/library";
export { searchShippedFoods } from "./nutrition/search";
