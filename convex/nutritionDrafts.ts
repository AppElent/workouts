import { isoDayOffset } from "@foundry/core";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireSubject, requireUserId } from "./lib/auth";
import { assertIsoDate } from "./lib/diaryDays";
import { appError } from "./lib/errors";
import { withOperationReceipt } from "./lib/operationReceipt";
import { captureDraft, mealSlot } from "./lib/validators";

const MAX_RANGE_DAYS = 62;
const MAX_NOTE_LENGTH = 10_000;
/** Distinct draft days counted for the summary; drafts are short-lived. */
const MAX_COUNTED_DAYS = 1000;

function asDraft(row: Doc<"nutritionCaptureDrafts">) {
	return {
		id: row.recordId,
		subject: row.userId,
		date: row.date,
		meal: row.meal,
		note: row.note,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

async function changeCount(
	ctx: MutationCtx,
	userId: string,
	date: string,
	delta: number,
) {
	const current = await ctx.db
		.query("nutritionCaptureDraftCounts")
		.withIndex("by_user_and_date", (q) =>
			q.eq("userId", userId).eq("date", date),
		)
		.unique();
	const count = (current?.count ?? 0) + delta;
	if (current) {
		if (count === 0) await ctx.db.delete(current._id);
		else await ctx.db.patch(current._id, { count });
	} else if (count > 0)
		await ctx.db.insert("nutritionCaptureDraftCounts", { userId, date, count });
}

export const list = query({
	args: {
		startDate: v.string(),
		endDate: v.string(),
		paginationOpts: paginationOptsValidator,
	},
	returns: v.object({
		page: v.array(captureDraft),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, { startDate, endDate, paginationOpts }) => {
		const userId = await requireUserId(ctx);
		assertIsoDate(startDate, "startDate");
		assertIsoDate(endDate, "endDate");
		const days = isoDayOffset(startDate, endDate);
		if (days < 0 || days >= MAX_RANGE_DAYS)
			throw appError("invalid", "endDate");
		const result = await ctx.db
			.query("nutritionCaptureDrafts")
			.withIndex("by_user_and_deleted_and_date", (q) =>
				q
					.eq("userId", userId)
					.eq("deleted", false)
					.gte("date", startDate)
					.lte("date", endDate),
			)
			.paginate({
				...paginationOpts,
				numItems: Math.min(paginationOpts.numItems, 100),
			});
		return {
			isDone: result.isDone,
			continueCursor: result.continueCursor,
			page: result.page.map(asDraft),
		};
	},
});

export const get = query({
	args: { id: v.string() },
	returns: v.union(captureDraft, v.null()),
	handler: async (ctx, { id }) => {
		const userId = await requireUserId(ctx);
		const row = await ctx.db
			.query("nutritionCaptureDrafts")
			.withIndex("by_user_and_record", (q) =>
				q.eq("userId", userId).eq("recordId", id),
			)
			.unique();
		return row && !row.deleted ? asDraft(row) : null;
	},
});

/** Drafts on other days than `date`, and the oldest draft's date. */
export const summary = query({
	args: { date: v.string() },
	returns: v.object({
		count: v.number(),
		oldestDate: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, { date }) => {
		const userId = await requireUserId(ctx);
		assertIsoDate(date);
		// Rows dated "" hold the account total an earlier server version kept.
		const [counts, oldest] = await Promise.all([
			ctx.db
				.query("nutritionCaptureDraftCounts")
				.withIndex("by_user_and_date", (q) =>
					q.eq("userId", userId).gt("date", ""),
				)
				.take(MAX_COUNTED_DAYS),
			ctx.db
				.query("nutritionCaptureDrafts")
				.withIndex("by_user_and_deleted_and_date", (q) =>
					q.eq("userId", userId).eq("deleted", false),
				)
				.first(),
		]);
		return {
			count: counts
				.filter((row) => row.date !== date)
				.reduce((total, row) => total + row.count, 0),
			oldestDate: oldest?.date ?? null,
		};
	},
});

export const save = mutation({
	args: {
		expectedSubject: v.string(),
		operationId: v.string(),
		id: v.string(),
		action: v.union(
			v.literal("create"),
			v.literal("update"),
			v.literal("remove"),
		),
		input: v.optional(
			v.object({ date: v.string(), meal: mealSlot, note: v.string() }),
		),
	},
	returns: v.union(captureDraft, v.null()),
	handler: async (ctx, args) => {
		const userId = await requireSubject(ctx, args.expectedSubject);
		const { id: recordId, action, input } = args;
		if (!recordId.trim() || recordId.length > 2048)
			throw appError("invalid", "id");
		return withOperationReceipt(
			ctx,
			"nutritionCaptureDraftReceipts",
			{ userId, operationId: args.operationId, payload: args },
			async () => {
				const current = await ctx.db
					.query("nutritionCaptureDrafts")
					.withIndex("by_user_and_record", (q) =>
						q.eq("userId", userId).eq("recordId", recordId),
					)
					.unique();
				if (action === "remove") {
					if (current && !current.deleted) {
						await ctx.db.patch(current._id, {
							deleted: true,
							note: "",
							updatedAt: Date.now(),
						});
						await changeCount(ctx, userId, current.date, -1);
					}
					return null;
				}
				if (!input) throw appError("required", "input");
				if (!input.note.trim()) throw appError("required", "note");
				if (input.note.length > MAX_NOTE_LENGTH)
					throw appError("tooLong", "note");
				assertIsoDate(input.date);
				if (action === "update" && (!current || current.deleted))
					throw appError("recordDeleted");
				if (action === "create" && current) throw appError("duplicate", "id");
				const now = Date.now();
				const createdAt = current?.createdAt ?? now;
				if (current) {
					await ctx.db.patch(current._id, { ...input, updatedAt: now });
					if (current.date !== input.date) {
						await changeCount(ctx, userId, current.date, -1);
						await changeCount(ctx, userId, input.date, 1);
					}
				} else {
					await ctx.db.insert("nutritionCaptureDrafts", {
						userId,
						recordId,
						...input,
						deleted: false,
						createdAt,
						updatedAt: now,
					});
					await changeCount(ctx, userId, input.date, 1);
				}
				return {
					id: recordId,
					subject: userId,
					...input,
					createdAt,
					updatedAt: now,
				};
			},
		);
	},
});
