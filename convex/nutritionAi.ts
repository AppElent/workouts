import { isoDateAt, NUTRITION_AI_LIMITS } from "@foundry/core";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { type ActionCtx, action, internalMutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { appError } from "./lib/errors";
import {
	describe as describeMeal,
	type NutritionAiProvider,
	nutritionAiProvider,
	readLabel as readNutritionLabel,
	select,
} from "./lib/nutritionAi";
import {
	bilingual,
	locale,
	perNutrient,
	measuredUnit as unit,
} from "./lib/validators";

/** Analyses (describe + label) per account per UTC day. */
export const DAILY_ANALYSES = 50;

const image = v.object({
	mediaType: v.union(
		v.literal("image/jpeg"),
		v.literal("image/png"),
		v.literal("image/webp"),
	),
	base64: v.string(),
});
const confidence = v.union(
	v.literal("high"),
	v.literal("medium"),
	v.literal("low"),
);
const nullableNumber = v.union(v.number(), v.null());
const estimate = perNutrient(v.number());

function requireProvider(): NutritionAiProvider {
	const provider = nutritionAiProvider();
	if (!provider) throw appError("unavailable");
	return provider;
}

/** Provider failures surface as one stable code; the cause goes to the log. */
async function run<T>(task: string, work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (error) {
		if (error instanceof ConvexError) throw error;
		console.error(`nutritionAi.${task} failed`, error);
		throw appError("failed");
	}
}

function checkImage(input: { base64: string } | undefined) {
	if (input && input.base64.length > NUTRITION_AI_LIMITS.maxImageBase64)
		throw appError("tooLarge");
}

export const consumeAnalysis = internalMutation({
	args: { userId: v.string(), day: v.string() },
	returns: v.null(),
	handler: async (ctx, { userId, day }) => {
		const row = await ctx.db
			.query("nutritionAiUsage")
			.withIndex("by_user_and_day", (q) =>
				q.eq("userId", userId).eq("day", day),
			)
			.unique();
		if ((row?.count ?? 0) >= DAILY_ANALYSES) throw appError("limit");
		// Each analysis allows a candidate selection and one retry of it, so
		// `choose` cannot be called on its own to reach the provider outside the
		// daily limit.
		if (row)
			await ctx.db.patch(row._id, {
				count: row.count + 1,
				choices: (row.choices ?? 0) + 2,
			});
		else
			await ctx.db.insert("nutritionAiUsage", {
				userId,
				day,
				count: 1,
				choices: 2,
			});
		return null;
	},
});

export const consumeChoice = internalMutation({
	args: { userId: v.string(), day: v.string() },
	returns: v.null(),
	handler: async (ctx, { userId, day }) => {
		const row = await ctx.db
			.query("nutritionAiUsage")
			.withIndex("by_user_and_day", (q) =>
				q.eq("userId", userId).eq("day", day),
			)
			.unique();
		if (!row || (row.choices ?? 0) <= 0) throw appError("limit");
		await ctx.db.patch(row._id, { choices: (row.choices ?? 0) - 1 });
		return null;
	},
});

const today = () => isoDateAt(Date.now(), 0);

async function consume(ctx: ActionCtx, userId: string) {
	await ctx.runMutation(internal.nutritionAi.consumeAnalysis, {
		userId,
		day: today(),
	});
}

/**
 * Text and/or meal photo → what it is, and the items with search terms.
 * Refining sends the previous result back with the corrections; the server
 * keeps no conversation.
 */
export const describe = action({
	args: {
		text: v.optional(v.string()),
		image: v.optional(image),
		locale,
		previous: v.optional(v.string()),
		followUps: v.optional(v.array(v.string())),
		webSearch: v.optional(v.boolean()),
	},
	returns: v.object({
		sources: v.array(v.object({ title: v.string(), url: v.string() })),
		kind: v.union(v.literal("meal"), v.literal("label"), v.literal("no_food")),
		seen: v.string(),
		title: v.string(),
		question: v.union(
			v.object({ text: v.string(), options: v.array(v.string()) }),
			v.null(),
		),
		items: v.array(
			v.object({
				kind: v.union(v.literal("ingredient"), v.literal("product")),
				id: v.optional(v.union(v.string(), v.null())),
				name: v.string(),
				amount: v.number(),
				unit,
				grams: v.number(),
				amountLabel: v.string(),
				amountStated: v.optional(v.boolean()),
				confidence,
				brand: v.union(v.string(), v.null()),
				searchTerms: v.array(v.string()),
				components: v.array(
					v.object({ name: v.string(), grams: v.number(), ...estimate.fields }),
				),
				estimate: v.union(estimate, v.null()),
			}),
		),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (!args.text?.trim() && !args.image) throw appError("empty");
		const limits = NUTRITION_AI_LIMITS;
		if (
			(args.text?.length ?? 0) > limits.maxText ||
			(args.previous?.length ?? 0) > limits.maxPreviousText ||
			(args.followUps?.length ?? 0) > limits.maxFollowUps ||
			args.followUps?.some(
				(followUp) => followUp.length > limits.maxFollowUpText,
			)
		)
			throw appError("tooLarge");
		checkImage(args.image);
		const provider = requireProvider();
		await consume(ctx, userId);
		return run("describe", () =>
			describeMeal(provider, {
				text: args.text,
				image: args.image,
				locale: args.locale,
				previous: args.previous,
				followUps: args.followUps,
				webSearch: args.webSearch,
			}),
		);
	},
});

/** Items with the phone's candidates → one candidate per item, or an estimate. */
export const choose = action({
	args: {
		items: v.array(
			v.object({
				name: v.string(),
				amount: v.number(),
				unit,
				brand: v.union(v.string(), v.null()),
				product: v.optional(v.boolean()),
				candidates: v.array(v.object({ ref: v.string(), name: v.string() })),
			}),
		),
	},
	returns: v.array(
		v.object({
			index: v.number(),
			ref: v.union(v.string(), v.null()),
			estimate: v.union(estimate, v.null()),
			guess: v.optional(v.boolean()),
		}),
	),
	handler: async (ctx, { items }) => {
		const userId = await requireUserId(ctx);
		if (
			items.length === 0 ||
			items.length > NUTRITION_AI_LIMITS.maxItems ||
			items.some(
				(item) => item.candidates.length > NUTRITION_AI_LIMITS.maxCandidates,
			)
		)
			throw appError("tooLarge");
		const provider = requireProvider();
		await ctx.runMutation(internal.nutritionAi.consumeChoice, {
			userId,
			day: today(),
		});
		return run("choose", () => select(provider, items));
	},
});

/** Photo of a nutrition table → transcribed values and named portions. */
export const readLabel = action({
	args: { image, locale },
	returns: v.object({
		isLabel: v.boolean(),
		name: bilingual,
		brand: v.union(v.string(), v.null()),
		barcode: v.union(v.string(), v.null()),
		barcodeInvalid: v.boolean(),
		packAmount: nullableNumber,
		basis: unit,
		per100: v.object({
			energyKj: nullableNumber,
			energy: nullableNumber,
			fat: nullableNumber,
			saturatedFat: nullableNumber,
			carbs: nullableNumber,
			sugars: nullableNumber,
			fibre: nullableNumber,
			protein: nullableNumber,
			salt: nullableNumber,
		}),
		servings: v.array(v.object({ name: bilingual, amount: v.number() })),
		notes: v.string(),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		checkImage(args.image);
		const provider = requireProvider();
		await consume(ctx, userId);
		return run("readLabel", () =>
			readNutritionLabel(provider, { image: args.image, locale: args.locale }),
		);
	},
});
