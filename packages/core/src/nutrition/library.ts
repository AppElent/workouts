import {
	artifactGroups,
	artifactMeta,
	decodeArtifact,
	type ShippedArtifact,
} from "./artifact";
import rawArtifact from "./shipped-foods.json";
import type {
	ShippedFood,
	ShippedFoodGroup,
	ShippedFoodId,
	ShippedLibraryMeta,
	ShippedSourceMeta,
} from "./types";

export type ShippedLibrary = {
	readonly meta: ShippedLibraryMeta;
	/** Every shipped food, retired ones included, ordered by NEVO code. */
	readonly foods: readonly ShippedFood[];
	/** The searchable subset: everything not retired. */
	readonly active: readonly ShippedFood[];
	readonly promoted: readonly ShippedFood[];
	readonly groups: readonly ShippedFoodGroup[];
	readonly byId: ReadonlyMap<string, ShippedFood>;
	readonly byNevoCode: ReadonlyMap<number, ShippedFood>;
};

/**
 * The raw artifact, for tests and the generator's round-trip check.
 *
 * `json-modules.d.ts` types the import when `resolveJsonModule` is off (this
 * package). Expo's tsconfig turns it on and resolves `@foundry/core` to source,
 * so there TypeScript infers the JSON and widens `nutrientOrder` to `string[]`.
 * The generator's `check:foods` keeps the file in this shape.
 */
export const SHIPPED_ARTIFACT = rawArtifact as ShippedArtifact;

/**
 * Decode the artifact into a working library.
 *
 * Exported unmemoized so the benchmark can time a cold build; application code
 * should call {@link shippedLibrary}, which does this once.
 */
export function loadShippedLibrary(
	artifact: ShippedArtifact = SHIPPED_ARTIFACT,
): ShippedLibrary {
	const foods = decodeArtifact(artifact);
	const byId = new Map<string, ShippedFood>();
	const byNevoCode = new Map<number, ShippedFood>();
	const active: ShippedFood[] = [];
	const promoted: ShippedFood[] = [];

	for (const food of foods) {
		byId.set(food.id, food);
		if (food.source === "nevo") byNevoCode.set(food.code, food);
		if (!food.retired) {
			active.push(food);
			if (food.promoted) promoted.push(food);
		}
	}

	return {
		meta: artifactMeta(artifact),
		foods,
		active,
		promoted,
		groups: artifactGroups(artifact),
		byId,
		byNevoCode,
	};
}

let cached: ShippedLibrary | undefined;

/** The shipped library, decoded on first use and reused thereafter. */
export function shippedLibrary(): ShippedLibrary {
	if (!cached) cached = loadShippedLibrary();
	return cached;
}

export function allShippedFoods(): readonly ShippedFood[] {
	return shippedLibrary().foods;
}

export function getShippedFood(
	id: ShippedFoodId | string,
): ShippedFood | undefined {
	return shippedLibrary().byId.get(id);
}

/** Dataset name, edition and salt provenance for the source a food came from. */
export function shippedSourceMeta(
	food: Pick<ShippedFood, "source">,
): ShippedSourceMeta {
	const meta = shippedLibrary().meta.sources[food.source];
	// The schema guarantees this at generation time; a miss means a hand-edited artifact.
	if (!meta)
		throw new Error(`Shipped artifact has no source table for ${food.source}`);
	return meta;
}
