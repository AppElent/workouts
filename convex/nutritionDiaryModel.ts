import { v } from "convex/values";

const bilingual = v.object({ en: v.string(), nl: v.string() });
const nutrientValue = v.union(
	v.object({ kind: v.literal("value"), amount: v.number() }),
	v.object({ kind: v.literal("trace") }),
	v.object({ kind: v.literal("absent") }),
);
const shippedProvenance = v.object({
	source: v.literal("shipped"),
	sourceId: v.string(),
	dataset: v.string(),
	edition: v.string(),
	sourceCode: v.number(),
	sourceName: bilingual,
	saltDerived: v.boolean(),
});
const personalProvenance = v.object({
	source: v.union(v.literal("personal"), v.literal("import")),
	// Stable device-minted UUID. It deliberately remains valid when the SQLite
	// row is unavailable or deleted; the surrounding Diary Entry is a snapshot.
	sourceId: v.string(),
	nutritionSource: v.union(
		v.literal("manual"),
		v.literal("nevo"),
		v.literal("openfoodfacts"),
	),
	locallyEdited: v.boolean(),
	forkedFrom: v.optional(v.string()),
	provider: v.optional(v.string()),
	barcode: v.optional(v.string()),
	attribution: v.optional(v.string()),
});

export const diarySnapshotFields = {
	date: v.string(),
	meal: v.union(
		v.literal("breakfast"),
		v.literal("lunch"),
		v.literal("dinner"),
		v.literal("snacks"),
	),
	name: bilingual,
	serving: bilingual,
	quantity: v.number(),
	amount: v.number(),
	baseUnit: v.union(v.literal("g"), v.literal("ml")),
	nutrients: v.object({
		energy: nutrientValue,
		protein: nutrientValue,
		carbs: nutrientValue,
		fat: nutrientValue,
		saturatedFat: nutrientValue,
		fibre: nutrientValue,
		sugars: nutrientValue,
		salt: nutrientValue,
	}),
	provenance: v.union(shippedProvenance, personalProvenance),
};
