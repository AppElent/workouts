import type { NutrientKey, NutrientValue } from "./nutrients";

export type NutritionMealSlot = "breakfast" | "lunch" | "dinner" | "snacks";

export type NutritionBilingual = { readonly en: string; readonly nl: string };

export type NutritionProvenance =
	| {
			readonly source: "shipped";
			readonly sourceId: string;
			readonly dataset: string;
			readonly edition: string;
			readonly sourceCode: number;
			readonly sourceName: NutritionBilingual;
			readonly saltDerived: boolean;
	  }
	| {
			readonly source: "personal" | "import";
			readonly sourceId: string;
			readonly nutritionSource: "manual" | "nevo" | "openfoodfacts";
			readonly locallyEdited: boolean;
			readonly forkedFrom?: string;
			readonly provider?: string;
			readonly barcode?: string;
			readonly attribution?: string;
	  }
	| { readonly source: "oneOff" };

export type NutritionDiarySnapshot = {
	readonly date: string;
	readonly meal: NutritionMealSlot;
	readonly name: NutritionBilingual;
	readonly serving: NutritionBilingual;
	readonly quantity: number;
	readonly amount: number;
	readonly baseUnit: "g" | "ml";
	readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	readonly provenance: NutritionProvenance;
	readonly comboGroup?: {
		readonly id: string;
		readonly comboId: string;
		readonly name: string;
	};
	readonly clientEntryId?: string;
};

export type NutritionDiaryPartSnapshot = Omit<
	NutritionDiarySnapshot,
	"date" | "meal" | "clientEntryId"
>;

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
			readonly meal: NutritionMealSlot;
			readonly entries: readonly (NutritionDiaryPartSnapshot & {
				readonly clientEntryId: string;
			})[];
	  }
	| {
			readonly kind: "update";
			readonly target: NutritionOperationTarget;
			readonly quantity?: number;
			readonly date?: string;
			readonly meal?: NutritionMealSlot;
	  }
	| {
			readonly kind: "remove";
			readonly target: NutritionOperationTarget;
	  };

export type NutritionOperationEnvelope = {
	readonly version: 1;
	readonly operationId: string;
	readonly expectedSubject: string;
	readonly operation: NutritionDiaryOperation;
};

/** Stable JSON for operation receipts; object key order never changes identity. */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(",")}}`;
}

export function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value,
	);
}
