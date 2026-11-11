import type {
	Bilingual,
	ComboGroup,
	DiaryNutrientCorrection,
	MealSlot,
	NutritionDiaryPartSnapshot,
	NutritionDiarySnapshot,
} from "./snapshot";

export type NutritionOperationTarget =
	| { readonly kind: "serverId"; readonly id: string }
	| { readonly kind: "clientEntryId"; readonly id: string };

export type NutritionDiaryOperation =
	| {
			readonly kind: "create";
			readonly entry: NutritionDiarySnapshot & {
				readonly clientEntryId: string;
			};
	  }
	| {
			readonly kind: "createBatch";
			readonly date: string;
			readonly meal: MealSlot;
			readonly entries: readonly (NutritionDiaryPartSnapshot & {
				readonly clientEntryId: string;
			})[];
			/** Entries removed in the same write: all of it happens, or none. */
			readonly replaces?: readonly NutritionOperationTarget[];
	  }
	| {
			readonly kind: "update";
			readonly target: NutritionOperationTarget;
			readonly quantity?: number;
			readonly correction?: DiaryNutrientCorrection;
			/** A newly chosen serving, captured as a durable diary snapshot. */
			readonly selection?: {
				readonly serving: Bilingual;
				readonly quantity: number;
				readonly amount: number;
				readonly personalMeasureId: string | null;
			};
			readonly date?: string;
			readonly meal?: MealSlot;
	  }
	| {
			readonly kind: "group";
			readonly targets: readonly NutritionOperationTarget[];
			readonly comboGroup: ComboGroup;
	  }
	| {
			readonly kind: "remove";
			readonly target: NutritionOperationTarget;
	  }
	| {
			readonly kind: "removeBatch";
			readonly targets: readonly NutritionOperationTarget[];
	  }
	| {
			readonly kind: "moveBatch";
			readonly targets: readonly NutritionOperationTarget[];
			readonly date: string;
			readonly meal: MealSlot;
	  };

export type NutritionOperationEnvelope = {
	readonly operationId: string;
	readonly expectedSubject: string;
	readonly operation: NutritionDiaryOperation;
};
