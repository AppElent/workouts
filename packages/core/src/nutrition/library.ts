import rawArtifact from "./shipped-foods.json";
import { artifactGroups, artifactMeta, decodeArtifact, type ShippedArtifact } from "./artifact";
import type { ShippedFood, ShippedFoodGroup, ShippedFoodId, ShippedLibraryMeta } from "./types";

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

/** The raw artifact, for tests and the generator's round-trip check. */
export const SHIPPED_ARTIFACT: ShippedArtifact = rawArtifact;

/**
 * Decode the artifact into a working library.
 *
 * Exported unmemoized so the benchmark can time a cold build; application code
 * should call {@link shippedLibrary}, which does this once.
 */
export function loadShippedLibrary(artifact: ShippedArtifact = rawArtifact): ShippedLibrary {
	const foods = decodeArtifact(artifact);
	const byId = new Map<string, ShippedFood>();
	const byNevoCode = new Map<number, ShippedFood>();
	const active: ShippedFood[] = [];
	const promoted: ShippedFood[] = [];

	for (const food of foods) {
		byId.set(food.id, food);
		byNevoCode.set(food.code, food);
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

export function promotedShippedFoods(): readonly ShippedFood[] {
	return shippedLibrary().promoted;
}

export function getShippedFood(id: ShippedFoodId | string): ShippedFood | undefined {
	return shippedLibrary().byId.get(id);
}

/**
 * Look a food up by its NEVO code. For provenance and generation only — a
 * stored reference must always use the `shipped:` id, because NEVO codes can
 * retire and reappear.
 */
export function getShippedFoodByNevoCode(code: number): ShippedFood | undefined {
	return shippedLibrary().byNevoCode.get(code);
}

export function shippedLibraryMeta(): ShippedLibraryMeta {
	return shippedLibrary().meta;
}

export function shippedFoodGroups(): readonly ShippedFoodGroup[] {
	return shippedLibrary().groups;
}
