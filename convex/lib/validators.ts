import {
	ACTIVITY_SPORTS,
	BASE_UNITS,
	DISTANCE_UNITS,
	ENDURANCE_ENVIRONMENTS,
	ENDURANCE_SPORTS,
	EQUIPMENT,
	EXERCISE_CATEGORIES,
	FOOD_VISUAL_PRESET_IDS,
	GOAL_DIRECTIONS,
	GOAL_PRESET_KEYS,
	HOSTED_LEVELS,
	LIBRARY_CATEGORIES,
	LIBRARY_RECORD_KINDS,
	LOAD_UNITS,
	MEAL_SLOTS,
	MEASURED_UNITS,
	NUTRIENT_KEYS,
	NUTRITION_SOURCES,
	type NutrientKey,
	RX_SCALED,
	SET_REFERENCE_SOURCES,
	SET_TYPES,
	STRENGTH_REFERENCE_SOURCES,
	SUPPORTED_LOCALES,
	WOD_TYPES,
} from "@foundry/core";
import {
	type GenericValidator,
	type VLiteral,
	type VUnion,
	v,
} from "convex/values";

type Literal = string | number;

/** A union validator of every value in a core vocabulary tuple. */
export function literals<const T extends readonly [Literal, ...Literal[]]>(
	values: T,
): VUnion<T[number], VLiteral<T[number], "required">[], "required", never> {
	return v.union(...values.map((value) => v.literal(value))) as never;
}

export function perNutrient<V extends GenericValidator>(value: V) {
	return v.object(
		Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, value])) as Record<
			NutrientKey,
			V
		>,
	);
}

export const loadUnit = literals(LOAD_UNITS);
export const distanceUnit = literals(DISTANCE_UNITS);
export const equipment = literals(EQUIPMENT);
export const exerciseCategory = literals(EXERCISE_CATEGORIES);
export const setType = literals(SET_TYPES);
export const wodType = literals(WOD_TYPES);
export const hostedLevel = literals(HOSTED_LEVELS);
export const activitySport = literals(ACTIVITY_SPORTS);
export const enduranceSport = literals(ENDURANCE_SPORTS);
export const enduranceEnvironment = literals(ENDURANCE_ENVIRONMENTS);
export const mealSlot = literals(MEAL_SLOTS);
export const baseUnit = literals(BASE_UNITS);
export const measuredUnit = literals(MEASURED_UNITS);
export const nutritionSource = literals(NUTRITION_SOURCES);
export const nutrientKey = literals(NUTRIENT_KEYS);
const goalDirection = literals(GOAL_DIRECTIONS);
const goalPreset = literals(GOAL_PRESET_KEYS);
export const locale = literals(SUPPORTED_LOCALES);
export const libraryRecordKind = literals(LIBRARY_RECORD_KINDS);
export const libraryCategory = literals(LIBRARY_CATEGORIES);
export const rxScaled = literals(RX_SCALED);
export const setReferenceSource = literals(SET_REFERENCE_SOURCES);

/**
 * A shipped exercise key (`shipped:…`) or a personal exercise's document id;
 * writers resolve it against the bundled catalog or an owned row.
 */
export const exerciseReference = v.string();

export const plannedSet = v.object({
	reps: v.number(),
	weight: v.number(),
	unit: loadUnit,
});

export const wodMovement = v.object({
	name: v.string(),
	reps: v.optional(v.number()),
	weight: v.optional(v.number()),
	unit: v.optional(loadUnit),
	distance: v.optional(v.number()),
	distanceUnit: v.optional(distanceUnit),
	notes: v.optional(v.string()),
});

/** What defines a WOD, in the library and on a hosted workout's WOD block. */
export const wodDefinitionFields = {
	name: v.string(),
	type: wodType,
	description: v.optional(v.string()),
	repScheme: v.optional(v.string()),
	timeCapSeconds: v.optional(v.number()),
	durationSeconds: v.optional(v.number()),
};

export const wodScoreFields = {
	timeSeconds: v.optional(v.number()),
	rounds: v.optional(v.number()),
	reps: v.optional(v.number()),
	timeCapped: v.optional(v.boolean()),
	load: v.optional(v.number()),
	loadUnit: v.optional(loadUnit),
	notes: v.optional(v.string()),
};

export const oneRepMaxSource = literals(STRENGTH_REFERENCE_SOURCES);

const strengthReferenceSnapshot = v.object({
	value: v.number(),
	unit: loadUnit,
	date: v.number(),
	source: oneRepMaxSource,
	sourceSetId: v.optional(v.id("sets")),
	formula: v.optional(v.string()),
	performance: v.optional(
		v.object({ weight: v.number(), reps: v.number(), unit: loadUnit }),
	),
});

export const strengthReferenceSnapshots = v.object({
	measured: v.union(v.null(), strengthReferenceSnapshot),
	estimated: v.union(v.null(), strengthReferenceSnapshot),
	manual: v.union(v.null(), strengthReferenceSnapshot),
});

export const nutritionGoal = v.object({
	nutrient: nutrientKey,
	direction: goalDirection,
	target: v.number(),
	sourcePreset: v.optional(goalPreset),
});

export const bilingual = v.object({ en: v.string(), nl: v.string() });

export const nutrientValue = v.union(
	v.object({ kind: v.literal("value"), amount: v.number() }),
	v.object({ kind: v.literal("trace") }),
	v.object({ kind: v.literal("absent") }),
);

const provenance = v.union(
	v.object({
		source: v.literal("shipped"),
		sourceId: v.string(),
		dataset: v.string(),
		edition: v.string(),
		sourceCode: v.number(),
		sourceName: bilingual,
		saltDerived: v.boolean(),
	}),
	v.object({
		source: v.union(v.literal("personal"), v.literal("import")),
		// A device-minted UUID that stays valid after the food itself is gone;
		// the diary row is a snapshot.
		sourceId: v.string(),
		nutritionSource,
		locallyEdited: v.boolean(),
		forkedFrom: v.optional(v.string()),
		provider: v.optional(v.string()),
		barcode: v.optional(v.string()),
		attribution: v.optional(v.string()),
	}),
	v.object({ source: v.literal("oneOff") }),
);

const foodVisual = v.union(
	v.object({
		kind: v.literal("icon"),
		preset: literals(FOOD_VISUAL_PRESET_IDS),
	}),
	v.object({
		kind: v.literal("photo"),
		uri: v.string(),
		storageId: v.optional(v.id("_storage")),
	}),
	v.object({ kind: v.literal("remote"), uri: v.string() }),
);

export const diaryNutrientCorrection = v.object({
	baseUnit,
	basisAmount: v.number(),
	nutrients: perNutrient(v.optional(nutrientValue)),
});

export const diaryPartSnapshotFields = {
	name: bilingual,
	serving: bilingual,
	quantity: v.number(),
	amount: v.number(),
	baseUnit,
	personalMeasureId: v.optional(v.string()),
	visual: v.optional(foodVisual),
	estimated: v.optional(v.literal(true)),
	correctedNutrients: v.optional(v.array(nutrientKey)),
	nutrients: perNutrient(nutrientValue),
	provenance,
};

export const comboGroup = v.object({
	id: v.string(),
	comboId: v.string(),
	name: v.string(),
});

export const diarySnapshotFields = {
	date: v.string(),
	meal: mealSlot,
	// Rendering provenance only: each row stays an independently editable
	// snapshot even after the Combo is gone.
	comboGroup: v.optional(comboGroup),
	// Absent on rows from before devices minted their own entry ids.
	clientEntryId: v.optional(v.string()),
	...diaryPartSnapshotFields,
};

export const nutrientTotal = v.object({
	amount: v.number(),
	entryCount: v.number(),
	valueCount: v.number(),
	traceCount: v.number(),
	absentCount: v.number(),
	incomplete: v.boolean(),
	qualified: v.boolean(),
});

/** A diary day as devices read it: its entries, totals and revision. */
export const diaryDay = v.object({
	date: v.string(),
	entries: v.array(
		v.object({
			_id: v.id("nutritionDiaryEntries"),
			_creationTime: v.number(),
			userId: v.string(),
			loggedAt: v.number(),
			...diarySnapshotFields,
		}),
	),
	totals: perNutrient(nutrientTotal),
	revision: v.number(),
});

export const captureDraft = v.object({
	id: v.string(),
	subject: v.string(),
	date: v.string(),
	meal: mealSlot,
	note: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
});
