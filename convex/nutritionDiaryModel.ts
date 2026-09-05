import { v } from "convex/values";

const bilingual = v.object({ en: v.string(), nl: v.string() });
const nutrientValue = v.union(
	v.object({ kind: v.literal("value"), amount: v.number() }),
	v.object({ kind: v.literal("trace") }),
	v.object({ kind: v.literal("absent") }),
);

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
	provenance: v.object({
		source: v.literal("shipped"),
		sourceId: v.string(),
		dataset: v.string(),
		edition: v.string(),
		sourceCode: v.number(),
		sourceName: bilingual,
		saltDerived: v.boolean(),
	}),
};
