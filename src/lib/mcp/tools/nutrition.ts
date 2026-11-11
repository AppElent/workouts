import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
	NUTRIENT_KEYS,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientValue,
	normalizePersonalFood,
	type PersonalFood,
	personalFoodServingOptions,
	type ServingOption,
	type ShippedFoodId,
	servingOptions,
} from "@foundry/core";
import {
	foodSnapshot,
	getShippedFood,
	type LibraryFood,
	searchShippedFoods,
} from "@foundry/core/shipped-foods";
import { z } from "zod";
import {
	defineTool,
	type FoundryBackend,
	ToolInputError,
	today,
} from "./define";

const date = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.describe("Calendar day as YYYY-MM-DD in the user's own time zone");
const meal = z.enum(["breakfast", "lunch", "dinner", "snacks"]);
const idempotencyKey = z
	.string()
	.min(8)
	.max(100)
	.describe(
		"Unique key for this write, such as a UUID. Reuse it only when retrying the same write.",
	);

/** Shipped food IDs already carry this prefix; personal ones get PERSONAL. */
const SHIPPED = "shipped:";
const PERSONAL = "personal:";

/** Nutrient figures as plain numbers; null when the source has no figure. */
function flatNutrients(
	nutrients: Partial<Record<NutrientKey, NutrientValue>>,
): Record<string, number | "trace" | null> {
	const out: Record<string, number | "trace" | null> = {};
	for (const key of NUTRIENT_KEYS) {
		const value = nutrients[key];
		const name = `${key}_${NUTRIENT_UNITS[key]}`;
		if (!value || value.kind === "absent") out[name] = null;
		else if (value.kind === "trace") out[name] = "trace";
		else out[name] = Math.round(value.amount * 10) / 10;
	}
	return out;
}

type DiaryEntry = {
	_id: string;
	meal: string;
	name: { en: string };
	serving: { en: string };
	quantity: number;
	amount: number;
	baseUnit: string;
	estimated?: true;
	comboGroup?: { name: string };
	nutrients: Record<NutrientKey, NutrientValue>;
};

function diaryDay(day: {
	date: string;
	entries: DiaryEntry[];
	totals: Partial<Record<NutrientKey, NutrientValue>>;
}) {
	return {
		date: day.date,
		entries: day.entries.map((entry) => ({
			id: entry._id,
			meal: entry.meal,
			name: entry.name.en,
			serving: entry.serving.en,
			quantity: entry.quantity,
			amount: entry.amount,
			baseUnit: entry.baseUnit,
			estimated: entry.estimated === true,
			combo: entry.comboGroup?.name,
			nutrients: flatNutrients(entry.nutrients),
		})),
		totals: flatNutrients(day.totals),
	};
}

function servingList(options: readonly ServingOption[]) {
	return options.map((option, index) => ({
		servingIndex: index,
		label: option.label.en,
		amount: option.amount,
		unit: "unit" in option ? option.unit : undefined,
	}));
}

async function personalFoods(backend: FoundryBackend, query: string) {
	const page = await backend.query(api.nutritionLibrary.browse, {
		query,
		paginationOpts: { numItems: 10, cursor: null },
	});
	const foods: PersonalFood[] = [];
	for (const record of page.page) {
		if (record.kind !== "food" || record.deleted || !record.payload) continue;
		try {
			foods.push(normalizePersonalFood(JSON.parse(record.payload)));
		} catch {
			// A record this server cannot read is skipped, not fatal to search.
		}
	}
	return foods;
}

async function libraryFood(
	backend: FoundryBackend,
	foodId: string,
): Promise<LibraryFood> {
	if (foodId.startsWith(SHIPPED)) {
		const food = getShippedFood(foodId as ShippedFoodId);
		if (food) return { kind: "shipped", food };
	}
	if (foodId.startsWith(PERSONAL)) {
		const id = foodId.slice(PERSONAL.length);
		const [record] = await backend.query(api.nutritionLibrary.getMany, {
			ids: [id],
		});
		if (record?.kind === "food" && !record.deleted && record.payload) {
			return {
				kind: "personal",
				food: normalizePersonalFood(JSON.parse(record.payload)),
			};
		}
	}
	throw new ToolInputError("Food not found. Use an ID from search_foods.");
}

function libraryServings(source: LibraryFood): ServingOption[] {
	return source.kind === "shipped"
		? servingOptions(source.food)
		: personalFoodServingOptions(source.food);
}

async function createEntry(
	backend: FoundryBackend,
	userId: string,
	idempotencyKey: string,
	entry: Record<string, unknown> & { date: string },
) {
	const clientEntryId = `mcp:${idempotencyKey}`;
	const result = await backend.mutation(api.nutritionDiary.applyOperation, {
		operationId: clientEntryId,
		expectedSubject: userId,
		operation: {
			kind: "create",
			entry: { ...entry, clientEntryId } as never,
		},
	});
	const day = await backend.query(api.nutritionDiary.day, {
		date: entry.date,
	});
	return { entryId: result.entryIds[0], day: diaryDay(day as never) };
}

export const nutritionTools = [
	defineTool({
		name: "get_nutrition_day",
		title: "Get nutrition day",
		description:
			"Return one day of the user's Nutrition Diary: each entry with its meal, serving, and nutrients, plus day totals. Energy is kcal; salt, fibre, and macros are grams.",
		access: "read",
		input: { date: date.optional() },
		async run({ date: day }, { backend, now }) {
			const result = await backend.query(api.nutritionDiary.day, {
				date: day ?? today(now()),
			});
			return diaryDay(result as never);
		},
	}),
	defineTool({
		name: "get_nutrition_week",
		title: "Get nutrition week",
		description:
			"Return a Monday-to-Sunday review: per-day totals against goals, plus energy and protein averages.",
		access: "read",
		input: {
			startDate: date.describe("The Monday that starts the week, YYYY-MM-DD"),
		},
		async run({ startDate }, { backend, now }) {
			return await backend.query(api.nutritionReview.week, {
				startDate,
				today: today(now()),
			});
		},
	}),
	defineTool({
		name: "get_nutrition_goals",
		title: "Get nutrition goals",
		description: "Return the nutrition goals in force on a day.",
		access: "read",
		input: { date: date.optional() },
		async run({ date: day }, { backend, now }) {
			return await backend.query(api.nutritionGoals.forDate, {
				date: day ?? today(now()),
			});
		},
	}),
	defineTool({
		name: "search_foods",
		title: "Search foods",
		description:
			"Search the Food Library: the user's Personal Foods first, then shipped foods (NEVO and others), in English or Dutch. Returns food IDs and serving choices for log_food. Shipped nutrients are per 100 g or ml.",
		access: "read",
		input: {
			query: z.string().min(1).max(100),
			limit: z.number().int().min(1).max(25).default(10),
		},
		async run({ query, limit }, { backend }) {
			const personal = (await personalFoods(backend, query)).map((food) => ({
				foodId: `${PERSONAL}${food.id}`,
				name: food.name.en,
				kind: "personal",
				baseUnit: food.baseUnit,
				servings: servingList(personalFoodServingOptions(food)),
			}));
			const shipped = searchShippedFoods(query, {
				scope: "all",
				limit,
			}).map(({ food }) => ({
				foodId: food.id,
				name: food.name.en,
				nameNl: food.name.nl,
				kind: "shipped",
				baseUnit: food.baseUnit,
				per100: flatNutrients(food.nutrients),
				servings: servingList(servingOptions(food)),
			}));
			return { foods: [...personal, ...shipped].slice(0, limit) };
		},
	}),
	defineTool({
		name: "log_food",
		title: "Log food",
		description:
			"Log a food from search_foods to the Nutrition Diary. Pick a servingIndex from its servings and a quantity of that serving; the base-unit serving (g or ml) takes the amount as quantity.",
		access: "write",
		input: {
			idempotencyKey,
			date,
			meal,
			foodId: z.string().min(1),
			servingIndex: z.number().int().min(0),
			quantity: z.number().positive().max(10000),
		},
		async run(
			{ idempotencyKey, date, meal, foodId, servingIndex, quantity },
			{ backend, access },
		) {
			const source = await libraryFood(backend, foodId);
			const serving = libraryServings(source)[servingIndex];
			if (!serving)
				throw new ToolInputError(
					"Unknown servingIndex. Use one from search_foods.",
				);
			return createEntry(backend, access.userId, idempotencyKey, {
				...foodSnapshot(source, serving, quantity),
				date,
				meal,
			});
		},
	}),
	defineTool({
		name: "log_custom_food",
		title: "Log custom food",
		description:
			"Log a one-off food that is not in the Food Library, with nutrients you estimate for the whole portion. The entry is marked as estimated.",
		access: "write",
		input: {
			idempotencyKey,
			date,
			meal,
			name: z.string().min(1).max(200),
			portion: z
				.string()
				.min(1)
				.max(100)
				.describe("Portion description, such as '1 bowl'"),
			energyKcal: z.number().min(0).max(10000),
			proteinG: z.number().min(0).max(1000).optional(),
			carbsG: z.number().min(0).max(1000).optional(),
			fatG: z.number().min(0).max(1000).optional(),
			saturatedFatG: z.number().min(0).max(1000).optional(),
			fibreG: z.number().min(0).max(1000).optional(),
			sugarsG: z.number().min(0).max(1000).optional(),
			saltG: z.number().min(0).max(100).optional(),
		},
		async run(input, { backend, access }) {
			const figure = (amount: number | undefined): NutrientValue =>
				amount === undefined ? { kind: "absent" } : { kind: "value", amount };
			return createEntry(backend, access.userId, input.idempotencyKey, {
				date: input.date,
				meal: input.meal,
				name: { en: input.name, nl: input.name },
				serving: { en: input.portion, nl: input.portion },
				quantity: 1,
				amount: 1,
				baseUnit: "serving",
				estimated: true,
				nutrients: {
					energy: figure(input.energyKcal),
					protein: figure(input.proteinG),
					carbs: figure(input.carbsG),
					fat: figure(input.fatG),
					saturatedFat: figure(input.saturatedFatG),
					fibre: figure(input.fibreG),
					sugars: figure(input.sugarsG),
					salt: figure(input.saltG),
				},
				provenance: { source: "oneOff" },
			});
		},
	}),
	defineTool({
		name: "update_diary_entry",
		title: "Update diary entry",
		description:
			"Move a Nutrition Diary entry to another day or meal, or change its quantity (its nutrients rescale).",
		access: "write",
		annotations: { idempotentHint: true },
		input: {
			idempotencyKey,
			entryId: z.string().min(1),
			date: date.optional(),
			meal: meal.optional(),
			quantity: z.number().positive().max(10000).optional(),
		},
		async run(
			{ idempotencyKey, entryId, date, meal, quantity },
			{ backend, access },
		) {
			if (date === undefined && meal === undefined && quantity === undefined)
				throw new ToolInputError(
					"Change at least one of date, meal, quantity.",
				);
			await backend.mutation(api.nutritionDiary.applyOperation, {
				operationId: `mcp:${idempotencyKey}`,
				expectedSubject: access.userId,
				operation: {
					kind: "update",
					target: {
						kind: "serverId",
						id: entryId as Id<"nutritionDiaryEntries">,
					},
					date,
					meal,
					quantity,
				},
			});
			return { entryId, updated: true };
		},
	}),
];
