import type {
	ComboDraft,
	ComboPartDraft,
	PersonalFood,
	PersonalFoodClassification,
} from "@foundry/core";

export type PersonalFoodFilter = {
	readonly classification?: PersonalFoodClassification;
};

/** A stored Combo part, with whether its source food is still at hand. */
export type ComboPart = Omit<ComboPartDraft, "id"> & {
	readonly id: string;
	readonly status: "available" | "missing" | "unloaded";
};

export type Combo = Omit<ComboDraft, "parts"> & {
	readonly id: string;
	readonly parts: readonly ComboPart[];
	readonly createdAt: number;
	readonly updatedAt: number;
};

/** A photo that so far exists only as a file on this device. */
export function hasUnuploadedPhoto(food: Pick<PersonalFood, "visual">) {
	return food.visual?.kind === "photo" && !food.visual.storageId;
}

/** A Personal Food safe to move to another device through account backup. */
export function portablePersonalFood(food: PersonalFood): PersonalFood {
	const { visualMigrationPending: _pending, visual, ...portable } = food;
	return {
		...portable,
		...(visual?.kind === "icon" || visual?.kind === "remote"
			? { visual }
			: visual?.kind === "photo" && visual.storageId
				? { visual: { ...visual, uri: "" } }
				: {}),
	};
}
