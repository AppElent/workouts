import {
	LIBRARY_GET_MANY_LIMIT,
	normalizeCombo,
	normalizePersonalFood,
	type PersonalFood,
} from "@foundry/core";
import {
	paginationOptsValidator,
	type WithoutSystemFields,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { requireSubject, requireUserId } from "./lib/auth";
import { appError, withRuleErrors } from "./lib/errors";
import { requireFoodPhotoOwner } from "./lib/foodPhotos";
import { libraryIndexFields } from "./lib/nutritionLibraryIndex";
import { withOperationReceipt } from "./lib/operationReceipt";
import { libraryCategory, libraryRecordKind } from "./lib/validators";

const MAX_PAYLOAD_LENGTH = 200_000;
const MAX_RECORD_ID_LENGTH = 512;

const libraryRecord = v.object({
	subject: v.optional(v.string()),
	id: v.string(),
	kind: libraryRecordKind,
	payload: v.union(v.string(), v.null()),
	revision: v.number(),
	deleted: v.boolean(),
});

type RecordKind = Doc<"nutritionLibraryRecords">["recordKind"];
type StoredRecord = Pick<
	Doc<"nutritionLibraryRecords">,
	"recordId" | "recordKind" | "payload" | "revision" | "deleted"
>;

/**
 * Full validation keeps a malformed payload from becoming a future restore.
 * Returns the normalized food, or null for a Combo.
 */
function parsePayload(id: string, kind: RecordKind, payload: string) {
	if (!payload) throw appError("invalid", "payload");
	if (payload.length > MAX_PAYLOAD_LENGTH)
		throw appError("tooLarge", "payload");
	let parsed: unknown;
	try {
		parsed = JSON.parse(payload);
	} catch {
		throw appError("invalid", "payload");
	}
	if (kind === "food") {
		const food = withRuleErrors(() =>
			normalizePersonalFood(parsed as PersonalFood),
		);
		if (food.id !== id) throw appError("invalid", "id");
		return food;
	}
	const combo = withRuleErrors(() => normalizeCombo(parsed));
	if (combo.id !== id) throw appError("invalid", "id");
	return null;
}

/** Account photos must be this account's uploads or this import's provider image. */
async function checkFoodVisual(
	ctx: Pick<QueryCtx, "db">,
	userId: string,
	food: PersonalFood,
) {
	const visual = food.visual;
	if (visual?.kind === "photo") {
		if (!visual.storageId) throw appError("invalid", "visual");
		const storageId = ctx.db.system.normalizeId("_storage", visual.storageId);
		if (!storageId) throw appError("invalid", "visual");
		await requireFoodPhotoOwner(ctx, userId, storageId);
	}
	if (
		visual?.kind === "remote" &&
		(food.provenance.nutritionSource !== "openfoodfacts" ||
			visual.uri !== food.provenance.imageUrl)
	)
		throw appError("invalid", "visual");
}

/** A stored record as devices read it, with a stored photo's current URL. */
async function serveRecord(
	ctx: Pick<QueryCtx, "storage" | "db">,
	row: StoredRecord,
) {
	const record = {
		id: row.recordId,
		kind: row.recordKind,
		payload: row.payload ?? null,
		revision: row.revision,
		deleted: row.deleted,
	};
	if (!record.deleted && record.kind === "food" && record.payload) {
		const food: PersonalFood = JSON.parse(record.payload);
		if (food.visual?.kind === "photo" && food.visual.storageId) {
			const storageId = ctx.db.system.normalizeId(
				"_storage",
				food.visual.storageId,
			);
			const uri = storageId ? await ctx.storage.getUrl(storageId) : null;
			record.payload = JSON.stringify({
				...food,
				visual: uri ? { ...food.visual, uri } : undefined,
			});
		}
	}
	return record;
}

/**
 * Applies an edit in server acceptance order, at most once per operation id.
 * A deletion stays a row, so a delayed update cannot resurrect a removed item.
 */
export const save = mutation({
	args: {
		operationId: v.string(),
		expectedSubject: v.string(),
		operation: v.union(
			v.object({
				kind: v.literal("upsert"),
				record: v.object({
					id: v.string(),
					kind: libraryRecordKind,
					payload: v.string(),
				}),
				expectedRevision: v.number(),
			}),
			v.object({
				kind: v.literal("remove"),
				recordId: v.string(),
				recordKind: libraryRecordKind,
				expectedRevision: v.number(),
			}),
		),
	},
	returns: v.object({ record: libraryRecord }),
	handler: async (ctx, { operationId, ...envelope }) => {
		const userId = await requireSubject(ctx, envelope.expectedSubject);
		const { operation } = envelope;
		return withOperationReceipt(
			ctx,
			"nutritionLibraryOperationReceipts",
			{ userId, operationId, payload: envelope },
			async () => {
				const target =
					operation.kind === "upsert"
						? operation.record
						: { id: operation.recordId, kind: operation.recordKind };
				if (!target.id.trim() || target.id.length > MAX_RECORD_ID_LENGTH)
					throw appError("invalid", "id");
				if (
					operation.expectedRevision < 0 ||
					!Number.isInteger(operation.expectedRevision)
				)
					throw appError("invalid", "expectedRevision");
				if (operation.kind === "upsert") {
					const food = parsePayload(
						target.id,
						target.kind,
						operation.record.payload,
					);
					if (food) await checkFoodVisual(ctx, userId, food);
				}
				const current = await ctx.db
					.query("nutritionLibraryRecords")
					.withIndex("by_user_and_record", (q) =>
						q.eq("userId", userId).eq("recordId", target.id),
					)
					.unique();
				if (current && current.recordKind !== target.kind)
					throw appError("invalid", "kind");
				if (
					operation.kind === "upsert" &&
					(current?.deleted || (!current && operation.expectedRevision > 0))
				)
					throw appError("recordDeleted");
				const payload =
					operation.kind === "upsert" ? operation.record.payload : undefined;
				const next: WithoutSystemFields<Doc<"nutritionLibraryRecords">> = {
					userId,
					recordId: target.id,
					recordKind: target.kind,
					revision: (current?.revision ?? 0) + 1,
					deleted: operation.kind === "remove",
					...(payload === undefined ? {} : { payload }),
					updatedAt: Date.now(),
					...libraryIndexFields(target.kind, payload),
				};
				if (current) await ctx.db.replace(current._id, next);
				else await ctx.db.insert("nutritionLibraryRecords", next);
				return { record: await serveRecord(ctx, next) };
			},
		);
	},
});

export const browse = query({
	args: {
		query: v.string(),
		category: v.optional(libraryCategory),
		paginationOpts: paginationOptsValidator,
	},
	returns: v.object({
		page: v.array(libraryRecord),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (args.query.length > 200) throw appError("tooLong", "query");
		const text = args.query.trim();
		const records = ctx.db.query("nutritionLibraryRecords");
		const selected = text
			? records.withSearchIndex("search_library", (q) => {
					const search = q
						.search("searchText", text)
						.eq("userId", userId)
						.eq("deleted", false);
					return args.category ? search.eq("category", args.category) : search;
				})
			: args.category
				? records.withIndex("by_user_deleted_category_name", (q) =>
						q
							.eq("userId", userId)
							.eq("deleted", false)
							.eq("category", args.category),
					)
				: records.withIndex("by_user_deleted_name", (q) =>
						q.eq("userId", userId).eq("deleted", false),
					);
		const result = await selected.paginate({
			...args.paginationOpts,
			numItems: Math.min(100, args.paginationOpts.numItems),
		});
		return {
			page: await Promise.all(
				result.page.map(async (row) => ({
					...(await serveRecord(ctx, row)),
					subject: userId,
				})),
			),
			isDone: result.isDone,
			continueCursor: result.continueCursor,
		};
	},
});

/** Selected records and the personal sources of one selected Combo. */
export const getMany = query({
	args: {
		ids: v.array(v.string()),
		forkIds: v.optional(v.array(v.string())),
		barcode: v.optional(v.string()),
	},
	returns: v.array(libraryRecord),
	handler: async (ctx, args) => {
		const userId = await requireUserId(ctx);
		if (args.ids.length > LIBRARY_GET_MANY_LIMIT)
			throw appError("tooLarge", "ids");
		if ((args.forkIds?.length ?? 0) > LIBRARY_GET_MANY_LIMIT)
			throw appError("tooLarge", "forkIds");
		const records = new Map<string, Awaited<ReturnType<typeof serveRecord>>>();
		async function add(row: StoredRecord | null) {
			if (row) records.set(row.recordId, await serveRecord(ctx, row));
		}
		async function get(id: string) {
			await add(
				await ctx.db
					.query("nutritionLibraryRecords")
					.withIndex("by_user_and_record", (q) =>
						q.eq("userId", userId).eq("recordId", id),
					)
					.unique(),
			);
		}
		await Promise.all([...new Set(args.ids)].map(get));
		for (const forkId of args.forkIds ?? [])
			await add(
				await ctx.db
					.query("nutritionLibraryRecords")
					.withIndex("by_user_fork", (q) =>
						q
							.eq("userId", userId)
							.eq("forkedFrom", forkId)
							.eq("deleted", false),
					)
					.first(),
			);
		if (args.barcode)
			await add(
				await ctx.db
					.query("nutritionLibraryRecords")
					.withIndex("by_user_barcode", (q) =>
						q
							.eq("userId", userId)
							.eq("barcode", args.barcode)
							.eq("deleted", false),
					)
					.first(),
			);
		const sources = new Set<string>();
		// Only a single selected Combo resolves its sources, not a shortcut list.
		for (const record of records.values())
			if (
				args.ids.length === 1 &&
				record.kind === "combo" &&
				!record.deleted &&
				record.payload
			)
				for (const part of JSON.parse(record.payload).parts)
					if (
						part.reference.kind === "personal" &&
						!records.has(part.reference.foodId)
					)
						sources.add(part.reference.foodId);
		if (sources.size > LIBRARY_GET_MANY_LIMIT)
			throw appError("tooLarge", "ids");
		await Promise.all([...sources].map(get));
		return [...records.values()].map((record) => ({
			...record,
			subject: userId,
		}));
	},
});
