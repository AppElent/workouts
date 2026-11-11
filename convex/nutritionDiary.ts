import {
	type Bilingual,
	correctDiaryNutrients,
	isoDayOffset,
	type NutritionDiaryOperation,
	type NutritionOperationEnvelope,
	PERSONAL_FOOD_TEXT_LIMIT,
	rescaleToQuantity,
	rescaleToSelection,
	shiftIsoDate,
	validateNutrientValues,
} from "@foundry/core";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireSubject, requireUserId } from "./lib/auth";
import { assertIsoDate, bumpDayRevision, daySnapshot } from "./lib/diaryDays";
import { appError, checked, withRuleErrors } from "./lib/errors";
import { requireFoodPhotoOwner } from "./lib/foodPhotos";
import { withOperationReceipt } from "./lib/operationReceipt";
import {
	bilingual,
	comboGroup,
	diaryDay,
	diaryNutrientCorrection,
	diaryPartSnapshotFields,
	diarySnapshotFields,
	mealSlot,
} from "./lib/validators";

const MAX_BATCH = 100;
const MAX_CALENDAR_DAYS = 62;

/** `findEntry` normalizes a server id, so a stale or foreign one is just not found. */
const target = v.union(
	v.object({ kind: v.literal("serverId"), id: v.string() }),
	v.object({ kind: v.literal("clientEntryId"), id: v.string() }),
);

const operationArgs = {
	operationId: v.string(),
	expectedSubject: v.string(),
	operation: v.union(
		v.object({
			kind: v.literal("create"),
			entry: v.object({ ...diarySnapshotFields, clientEntryId: v.string() }),
		}),
		v.object({
			kind: v.literal("createBatch"),
			date: v.string(),
			meal: mealSlot,
			entries: v.array(
				v.object({
					...diaryPartSnapshotFields,
					comboGroup: v.optional(comboGroup),
					clientEntryId: v.string(),
				}),
			),
			replaces: v.optional(v.array(target)),
		}),
		v.object({
			kind: v.literal("update"),
			target,
			quantity: v.optional(v.number()),
			selection: v.optional(
				v.object({
					serving: bilingual,
					quantity: v.number(),
					amount: v.number(),
					personalMeasureId: v.union(v.string(), v.null()),
				}),
			),
			correction: v.optional(diaryNutrientCorrection),
			date: v.optional(v.string()),
			meal: v.optional(mealSlot),
		}),
		v.object({
			kind: v.literal("group"),
			targets: v.array(target),
			comboGroup,
		}),
		v.object({ kind: v.literal("remove"), target }),
		v.object({ kind: v.literal("removeBatch"), targets: v.array(target) }),
		v.object({
			kind: v.literal("moveBatch"),
			targets: v.array(target),
			date: v.string(),
			meal: mealSlot,
		}),
	),
} satisfies Record<keyof NutritionOperationEnvelope, unknown>;

type Entry = Doc<"nutritionDiaryEntries">;
type Target = { kind: "serverId" | "clientEntryId"; id: string };

function assertPositive(value: number, field: string) {
	if (!Number.isFinite(value) || value <= 0)
		throw appError("notPositive", field);
}

function assertText(value: string, field: string) {
	if (!value.trim()) throw appError("required", field);
	if (value.length > PERSONAL_FOOD_TEXT_LIMIT) throw appError("tooLong", field);
}

function assertBatchSize(items: readonly unknown[], field: string) {
	if (items.length < 1) throw appError("required", field);
	if (items.length > MAX_BATCH) throw appError("tooLarge", field);
}

function assertSnapshot(snapshot: {
	date: string;
	name: Bilingual;
	serving: Bilingual;
	quantity: number;
	amount: number;
	nutrients: unknown;
}) {
	assertIsoDate(snapshot.date);
	assertPositive(snapshot.quantity, "quantity");
	assertPositive(snapshot.amount, "amount");
	assertText(snapshot.name.en, "name.en");
	assertText(snapshot.name.nl, "name.nl");
	assertText(snapshot.serving.en, "serving.en");
	assertText(snapshot.serving.nl, "serving.nl");
	checked(validateNutrientValues(snapshot.nutrients));
}

async function findEntry(ctx: MutationCtx, userId: string, target: Target) {
	if (target.kind === "serverId") {
		const id = ctx.db.normalizeId("nutritionDiaryEntries", target.id);
		const entry = id ? await ctx.db.get(id) : null;
		return entry?.userId === userId ? entry : null;
	}
	return ctx.db
		.query("nutritionDiaryEntries")
		.withIndex("by_user_client_entry", (q) =>
			q.eq("userId", userId).eq("clientEntryId", target.id),
		)
		.first();
}

async function requireEntry(ctx: MutationCtx, userId: string, target: Target) {
	const entry = await findEntry(ctx, userId, target);
	if (!entry) throw appError("notFound", "target");
	return entry;
}

/** The entries of a batch that still exist; a stale target is skipped. */
async function batchEntries(
	ctx: MutationCtx,
	userId: string,
	targets: readonly Target[],
) {
	assertBatchSize(targets, "targets");
	const seen = new Set<string>();
	const entries: Entry[] = [];
	for (const target of targets) {
		const key = `${target.kind}:${target.id}`;
		if (seen.has(key)) throw appError("duplicate", "targets");
		seen.add(key);
		const entry = await findEntry(ctx, userId, target);
		if (entry) entries.push(entry);
	}
	return entries;
}

/** A Logged Combo is changed as a whole or not at all. */
async function assertWholeCombos(
	ctx: MutationCtx,
	userId: string,
	entries: readonly Entry[],
) {
	const selected = new Set(entries.map((entry) => String(entry._id)));
	const groups = new Set(
		entries.flatMap((entry) => (entry.comboGroup ? [entry.comboGroup.id] : [])),
	);
	for (const groupId of groups) {
		const parts = await ctx.db
			.query("nutritionDiaryEntries")
			.withIndex("by_user_combo_group", (q) =>
				q.eq("userId", userId).eq("comboGroup.id", groupId),
			)
			.take(MAX_BATCH + 1);
		if (parts.some((entry) => !selected.has(String(entry._id))))
			throw appError("partialCombo", "targets");
	}
}

async function assertClientEntryAvailable(
	ctx: MutationCtx,
	userId: string,
	clientEntryId: string,
) {
	if (!clientEntryId.trim() || clientEntryId.length > 200)
		throw appError("invalid", "clientEntryId");
	const existing = await ctx.db
		.query("nutritionDiaryEntries")
		.withIndex("by_user_client_entry", (q) =>
			q.eq("userId", userId).eq("clientEntryId", clientEntryId),
		)
		.first();
	if (existing) throw appError("duplicate", "clientEntryId");
}

/**
 * The patch for an edit of a logged entry: meal, date, quantity or serving,
 * or nutrient corrections. Quantities rescale the stored snapshot, never the
 * food it came from, which may since have changed or gone.
 */
function entryPatch(
	entry: Entry,
	operation: Extract<NutritionDiaryOperation, { kind: "update" }>,
) {
	const { meal, date, quantity, selection, correction } = operation;
	if (date !== undefined) assertIsoDate(date);
	const patch: Partial<Entry> = {};
	if (meal !== undefined) patch.meal = meal;
	if (date !== undefined) patch.date = date;
	if (
		(meal !== undefined && meal !== entry.meal) ||
		(date !== undefined && date !== entry.date)
	)
		patch.comboGroup = undefined;
	if (selection !== undefined) {
		if (quantity !== undefined) throw appError("invalid", "selection");
		assertPositive(selection.quantity, "quantity");
		assertPositive(selection.amount, "amount");
		const next = rescaleToSelection(entry, selection);
		Object.assign(patch, {
			quantity: next.quantity,
			amount: next.amount,
			nutrients: next.nutrients,
			serving: next.serving,
			personalMeasureId: selection.personalMeasureId ?? undefined,
		});
	} else if (quantity !== undefined) {
		assertPositive(quantity, "quantity");
		const next = rescaleToQuantity(entry, quantity);
		Object.assign(patch, {
			quantity: next.quantity,
			amount: next.amount,
			nutrients: next.nutrients,
			serving: next.serving,
		});
	}
	if (correction) {
		if (quantity !== undefined || selection !== undefined)
			throw appError("invalid", "correction");
		Object.assign(
			patch,
			withRuleErrors(() => correctDiaryNutrients(entry, correction)),
		);
	}
	return patch;
}

/** What one operation changed: its entries and the diary days it touched. */
type Applied = {
	entryIds: Id<"nutritionDiaryEntries">[];
	clientEntryIds: string[];
	dates: Set<string>;
};

async function apply(
	ctx: MutationCtx,
	userId: string,
	operation: NutritionDiaryOperation,
): Promise<Applied> {
	const applied: Applied = {
		entryIds: [],
		clientEntryIds: [],
		dates: new Set(),
	};
	const touched = (entry: Entry) => {
		applied.entryIds.push(entry._id);
		if (entry.clientEntryId) applied.clientEntryIds.push(entry.clientEntryId);
	};
	const insert = async (
		row: Omit<Entry, "_id" | "_creationTime" | "userId" | "loggedAt">,
	) => {
		if (row.visual?.kind === "photo" && row.visual.storageId)
			await requireFoodPhotoOwner(
				ctx,
				userId,
				row.visual.storageId as Id<"_storage">,
			);
		const id = await ctx.db.insert("nutritionDiaryEntries", {
			...row,
			userId,
			loggedAt: Date.now(),
		});
		applied.entryIds.push(id);
		if (row.clientEntryId) applied.clientEntryIds.push(row.clientEntryId);
		applied.dates.add(row.date);
	};

	switch (operation.kind) {
		case "create": {
			assertSnapshot(operation.entry);
			await assertClientEntryAvailable(
				ctx,
				userId,
				operation.entry.clientEntryId,
			);
			await insert(operation.entry);
			break;
		}
		case "createBatch": {
			assertIsoDate(operation.date);
			assertBatchSize(operation.entries, "entries");
			const ids = new Set<string>();
			for (const entry of operation.entries) {
				assertSnapshot({ ...entry, date: operation.date });
				if (ids.has(entry.clientEntryId))
					throw appError("duplicate", "clientEntryId");
				ids.add(entry.clientEntryId);
				await assertClientEntryAvailable(ctx, userId, entry.clientEntryId);
			}
			const replaced = operation.replaces
				? await batchEntries(ctx, userId, operation.replaces)
				: [];
			await assertWholeCombos(ctx, userId, replaced);
			for (const entry of replaced) {
				await ctx.db.delete(entry._id);
				applied.dates.add(entry.date);
			}
			for (const entry of operation.entries)
				await insert({ ...entry, date: operation.date, meal: operation.meal });
			break;
		}
		case "update": {
			const entry = await requireEntry(ctx, userId, operation.target);
			const patch = entryPatch(entry, operation);
			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(entry._id, patch);
				applied.dates.add(entry.date);
				if (operation.date !== undefined) applied.dates.add(operation.date);
			}
			touched(entry);
			break;
		}
		case "group": {
			assertText(operation.comboGroup.id, "comboGroup.id");
			assertText(operation.comboGroup.comboId, "comboGroup.comboId");
			assertText(operation.comboGroup.name, "comboGroup.name");
			const entries = await batchEntries(ctx, userId, operation.targets);
			const [first] = entries;
			if (
				!first ||
				entries.some(
					(entry) => entry.date !== first.date || entry.meal !== first.meal,
				)
			)
				throw appError("invalid", "targets");
			await assertWholeCombos(ctx, userId, entries);
			for (const entry of entries) {
				await ctx.db.patch(entry._id, { comboGroup: operation.comboGroup });
				if (entry.clientEntryId) touched(entry);
			}
			applied.dates.add(first.date);
			break;
		}
		case "remove": {
			const entry = await requireEntry(ctx, userId, operation.target);
			await ctx.db.delete(entry._id);
			applied.dates.add(entry.date);
			touched(entry);
			break;
		}
		case "removeBatch":
		case "moveBatch": {
			const entries = await batchEntries(ctx, userId, operation.targets);
			await assertWholeCombos(ctx, userId, entries);
			if (operation.kind === "moveBatch") assertIsoDate(operation.date);
			for (const entry of entries) {
				applied.dates.add(entry.date);
				touched(entry);
				if (operation.kind === "removeBatch") await ctx.db.delete(entry._id);
				else {
					await ctx.db.patch(entry._id, {
						date: operation.date,
						meal: operation.meal,
						comboGroup: undefined,
					});
					applied.dates.add(operation.date);
				}
			}
			break;
		}
	}
	return applied;
}

/**
 * The one writer of diary entries. Each operation runs once per operation id,
 * and every day it touches gets a new revision.
 */
export const applyOperation = mutation({
	args: operationArgs,
	returns: v.object({
		entryIds: v.array(v.id("nutritionDiaryEntries")),
		clientEntryIds: v.array(v.string()),
	}),
	handler: async (ctx, { operationId, ...envelope }) => {
		const userId = await requireSubject(ctx, envelope.expectedSubject);
		return withOperationReceipt(
			ctx,
			"nutritionDiaryOperationReceipts",
			{ userId, operationId, payload: envelope },
			async () => {
				const { dates, ...entries } = await apply(
					ctx,
					userId,
					envelope.operation as NutritionDiaryOperation,
				);
				for (const date of dates) await bumpDayRevision(ctx, userId, date);
				return entries;
			},
		);
	},
});

export const day = query({
	args: { date: v.string() },
	returns: diaryDay,
	handler: async (ctx, { date }) => {
		const userId = await requireUserId(ctx);
		assertIsoDate(date);
		return daySnapshot(ctx, userId, date);
	},
});

/** The days in a range of at most 62 that have entries; one read per day. */
export const loggedDates = query({
	args: { startDate: v.string(), endDate: v.string() },
	returns: v.array(v.string()),
	handler: async (ctx, { startDate, endDate }) => {
		const userId = await requireUserId(ctx);
		assertIsoDate(startDate, "startDate");
		assertIsoDate(endDate, "endDate");
		const count = isoDayOffset(startDate, endDate) + 1;
		if (count < 1 || count > MAX_CALENDAR_DAYS)
			throw appError("invalid", "endDate");
		const dates = Array.from({ length: count }, (_, day) =>
			shiftIsoDate(startDate, day),
		);
		const present = await Promise.all(
			dates.map(async (date) => {
				const row = await ctx.db
					.query("nutritionDiaryEntries")
					.withIndex("by_user_date", (q) =>
						q.eq("userId", userId).eq("date", date),
					)
					.first();
				return row ? date : null;
			}),
		);
		return present.filter((date): date is string => date !== null);
	},
});
