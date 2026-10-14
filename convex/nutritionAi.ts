import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
	type ActionCtx,
	action,
	internalMutation,
} from "./_generated/server";
import {
	type AiLocale,
	describe as describeMeal,
	MAX_IMAGE_BASE64,
	MAX_ITEMS,
	MAX_TEXT,
	type NutritionAiProvider,
	nutritionAiProvider,
	readLabel as readNutritionLabel,
	select,
} from "./lib/nutritionAi";

/** Analyses (describe + label) per account per UTC day. */
export const DAILY_ANALYSES = 50;

const locale = v.union(v.literal("en"), v.literal("nl"));
const image = v.object({
	mediaType: v.union(
		v.literal("image/jpeg"),
		v.literal("image/png"),
		v.literal("image/webp"),
	),
	base64: v.string(),
});
const unit = v.union(v.literal("g"), v.literal("ml"));
const confidence = v.union(
	v.literal("high"),
	v.literal("medium"),
	v.literal("low"),
);
const nullableNumber = v.union(v.number(), v.null());
const bilingual = v.object({ en: v.string(), nl: v.string() });
const estimate = v.object({
	energy: v.number(),
	protein: v.number(),
	carbs: v.number(),
	fat: v.number(),
	saturatedFat: v.number(),
	sugars: v.number(),
	fibre: v.number(),
	salt: v.number(),
});

async function requireUser(ctx: ActionCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new ConvexError("unauthenticated");
	return identity.subject;
}

function requireProvider(): NutritionAiProvider {
	const provider = nutritionAiProvider();
	if (!provider) throw new ConvexError("unavailable");
	return provider;
}

/** Provider failures surface as one stable code; the cause goes to the log. */
async function run<T>(task: string, work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (error) {
		if (error instanceof ConvexError) throw error;
		console.error(`nutritionAi.${task} failed`, error);
		throw new ConvexError("failed");
	}
}

function checkImage(input: { base64: string } | undefined) {
	if (input && input.base64.length > MAX_IMAGE_BASE64)
		throw new ConvexError("tooLarge");
}

export const consumeAnalysis = internalMutation({
	args: { userId: v.string(), day: v.string() },
	returns: v.null(),
	handler: async (ctx, { userId, day }) => {
		const row = await ctx.db
			.query("nutritionAiUsage")
			.withIndex("by_user_and_day", (q) => q.eq("userId", userId).eq("day", day))
			.unique();
		if ((row?.count ?? 0) >= DAILY_ANALYSES) throw new ConvexError("limit");
		if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
		else await ctx.db.insert("nutritionAiUsage", { userId, day, count: 1 });
		return null;
	},
});

async function consume(ctx: ActionCtx, userId: string) {
	await ctx.runMutation(internal.nutritionAi.consumeAnalysis, {
		userId,
		day: new Date().toISOString().slice(0, 10),
	});
}

/** Text and/or meal photo → what it is, and the items with search terms. */
export const describe = action({
	args: { text: v.optional(v.string()), image: v.optional(image), locale },
	returns: v.object({
		kind: v.union(v.literal("meal"), v.literal("label"), v.literal("no_food")),
		seen: v.string(),
		items: v.array(
			v.object({
				name: v.string(),
				amount: v.number(),
				unit,
				amountLabel: v.string(),
				confidence,
				brand: v.union(v.string(), v.null()),
				searchTerms: v.array(v.string()),
			}),
		),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		if (!args.text?.trim() && !args.image) throw new ConvexError("empty");
		if ((args.text?.length ?? 0) > MAX_TEXT) throw new ConvexError("tooLarge");
		checkImage(args.image);
		const provider = requireProvider();
		await consume(ctx, userId);
		return run("describe", async () => {
			const described = await describeMeal(provider, {
				text: args.text,
				image: args.image,
				locale: args.locale as AiLocale,
			});
			return {
				...described,
				items: described.items.map((item) => ({
					...item,
					searchTerms: [...item.searchTerms],
				})),
			};
		});
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
				candidates: v.array(v.object({ ref: v.string(), name: v.string() })),
			}),
		),
	},
	returns: v.array(
		v.object({
			index: v.number(),
			ref: v.union(v.string(), v.null()),
			estimate: v.union(estimate, v.null()),
		}),
	),
	handler: async (ctx, { items }) => {
		await requireUser(ctx);
		if (
			items.length === 0 ||
			items.length > MAX_ITEMS ||
			items.some((item) => item.candidates.length > 15)
		)
			throw new ConvexError("tooLarge");
		const provider = requireProvider();
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
		const userId = await requireUser(ctx);
		checkImage(args.image);
		const provider = requireProvider();
		await consume(ctx, userId);
		return run("readLabel", async () => {
			const reading = await readNutritionLabel(provider, {
				image: args.image,
				locale: args.locale as AiLocale,
			});
			return { ...reading, servings: [...reading.servings] };
		});
	},
});
