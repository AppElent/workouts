import {
	canonicalJson,
	formatQuantity,
	rescaleNutrients,
	totalNutrients,
} from "@workouts/core";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { NutritionDiaryOperation } from "@workouts/core";
import {
	diaryPartSnapshotFields,
	diarySnapshotFields,
	mealSlot,
} from "./nutritionDiaryModel";
import { operationArgs, operationResult } from "./nutritionOperationModel";

async function requireUser(ctx: QueryCtx | MutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

async function requireOwnedEntry(
	ctx: MutationCtx,
	userId: string,
	id: Id<"nutritionDiaryEntries">,
) {
	const entry = await ctx.db.get(id);
	if (!entry || entry.userId !== userId) throw new Error("Unauthorized");
	return entry;
}

const DIARY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT_LENGTH = 500;

function assertDiaryDate(date: string) {
	if (!DIARY_DATE_PATTERN.test(date)) throw new Error("Invalid diary date.");
	const [year, month, day] = date.split("-").map(Number);
	const candidate = new Date(Date.UTC(year, month - 1, day));
	if (
		candidate.getUTCFullYear() !== year ||
		candidate.getUTCMonth() !== month - 1 ||
		candidate.getUTCDate() !== day
	) {
		throw new Error("Invalid diary date.");
	}
}

function assertFinitePositive(value: number, label: string) {
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
}

function assertText(value: string, label: string) {
	if (value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) {
		throw new Error(`${label} is invalid.`);
	}
}

function assertSnapshot(snapshot: {
	date: string;
	meal: string;
	name: { en: string; nl: string };
	serving: { en: string; nl: string };
	quantity: number;
	amount: number;
	nutrients: Record<string, { kind: string; amount?: number }>;
}) {
	assertDiaryDate(snapshot.date);
	assertFinitePositive(snapshot.quantity, "Quantity");
	assertFinitePositive(snapshot.amount, "Amount");
	assertText(snapshot.name.en, "English name");
	assertText(snapshot.name.nl, "Dutch name");
	assertText(snapshot.serving.en, "English serving");
	assertText(snapshot.serving.nl, "Dutch serving");
	for (const key of [
		"energy",
		"protein",
		"carbs",
		"fat",
		"saturatedFat",
		"fibre",
		"sugars",
		"salt",
	]) {
		const nutrient = snapshot.nutrients[key];
		if (!nutrient) throw new Error(`Missing nutrient: ${key}.`);
		if (
			nutrient.kind === "value" &&
			(typeof nutrient.amount !== "number" ||
				!Number.isFinite(nutrient.amount) ||
				nutrient.amount < 0)
		) {
			throw new Error(`Invalid nutrient: ${key}.`);
		}
		if (
			nutrient.kind !== "value" &&
			nutrient.kind !== "trace" &&
			nutrient.kind !== "absent"
		) {
			throw new Error(`Invalid nutrient: ${key}.`);
		}
	}
}

function assertClientEntryId(value: string) {
	if (value.trim().length === 0 || value.length > 200) {
		throw new Error("Client entry ID is invalid.");
	}
}

async function ownedEntry(
	ctx: MutationCtx,
	userId: string,
	target:
		| { kind: "serverId"; id: Id<"nutritionDiaryEntries"> }
		| { kind: "clientEntryId"; id: string },
) {
	const entry =
		target.kind === "serverId"
			? await ctx.db.get(target.id)
			: await ctx.db
					.query("nutritionDiaryEntries")
					.withIndex("by_user_client_entry", (q) =>
						q.eq("userId", userId).eq("clientEntryId", target.id),
					)
					.first();
	if (!entry || entry.userId !== userId) throw new Error("Unauthorized");
	return entry;
}

function backendTarget(
	target:
		| Extract<NutritionDiaryOperation, { kind: "update" | "remove" }>["target"]
		| Extract<NutritionDiaryOperation, { kind: "group" }>["targets"][number],
):
	| { kind: "serverId"; id: Id<"nutritionDiaryEntries"> }
	| { kind: "clientEntryId"; id: string } {
	if (target.kind === "serverId") {
		// The public Convex validator has already checked this as a real table id;
		// the shared pure contract intentionally stays free of Convex brands.
		return { kind: "serverId", id: target.id as Id<"nutritionDiaryEntries"> };
	}
	return target;
}

async function assertClientEntryAvailable(
	ctx: MutationCtx,
	userId: string,
	clientEntryId: string,
) {
	assertClientEntryId(clientEntryId);
	const existing = await ctx.db
		.query("nutritionDiaryEntries")
		.withIndex("by_user_client_entry", (q) =>
			q.eq("userId", userId).eq("clientEntryId", clientEntryId),
		)
		.first();
	if (existing) throw new Error("Client entry ID already exists.");
}

async function getRevision(ctx: QueryCtx | MutationCtx, userId: string, date: string) {
	const row = await ctx.db
		.query("nutritionDiaryDayVersions")
		.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
		.first();
	return row?.revision ?? 0;
}

async function bumpRevision(ctx: MutationCtx, userId: string, date: string) {
	const row = await ctx.db
		.query("nutritionDiaryDayVersions")
		.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
		.first();
	if (row) {
		const revision = row.revision + 1;
		await ctx.db.patch(row._id, { revision });
		return revision;
	}
	await ctx.db.insert("nutritionDiaryDayVersions", { userId, date, revision: 1 });
	return 1;
}

async function daySnapshot(ctx: QueryCtx | MutationCtx, userId: string, date: string) {
	const entries = await ctx.db
		.query("nutritionDiaryEntries")
		.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
		.collect();
	return {
		date,
		entries,
		totals: totalNutrients(entries.map((entry) => entry.nutrients)),
		revision: await getRevision(ctx, userId, date),
	};
}

async function affectedDays(
	ctx: MutationCtx,
	userId: string,
	dates: Iterable<string>,
) {
	return Promise.all(
		[...new Set(dates)].sort().map((date) => daySnapshot(ctx, userId, date)),
	);
}

/**
 * `serving` is a snapshot string — "Glass (200 ml) × 1" — not a reference back
 * to the food, so a quantity edit updates only the multiplier at the end of
 * it. This is string surgery on the snapshot, never a re-read of the source.
 */
function rescaleServingLabel(label: string, quantity: number, locale: "en" | "nl") {
	const separator = label.lastIndexOf(" × ");
	const name = separator === -1 ? label : label.slice(0, separator);
	return `${name} × ${formatQuantity(quantity, locale)}`;
}

export const log = mutation({
	args: diarySnapshotFields,
	handler: async (ctx, snapshot) => {
		const userId = await requireUser(ctx);
		assertSnapshot(snapshot);
		if (snapshot.clientEntryId) {
			await assertClientEntryAvailable(ctx, userId, snapshot.clientEntryId);
		}
		const id = await ctx.db.insert("nutritionDiaryEntries", {
			userId,
			...snapshot,
			loggedAt: Date.now(),
		});
		await bumpRevision(ctx, userId, snapshot.date);
		return id;
	},
});

/**
 * Materializes a device-local Combo in one atomic mutation. The group stamp is
 * minted once and copied onto every immutable diary snapshot; it is never a
 * parent record and therefore cannot make an entry depend on the local Combo.
 */
export const logCombo = mutation({
	args: {
		date: v.string(),
		meal: mealSlot,
		combo: v.object({ id: v.string(), name: v.string() }),
		parts: v.array(v.object(diaryPartSnapshotFields)),
	},
	handler: async (ctx, { date, meal, combo, parts }) => {
		const userId = await requireUser(ctx);
		assertDiaryDate(date);
		assertText(combo.id, "Combo identity");
		assertText(combo.name, "Combo name");
		if (parts.length === 0) throw new Error("A Combo needs at least one part.");
		for (const part of parts) {
			assertSnapshot({ ...part, date, meal });
		}
		const loggedAt = Date.now();
		const comboGroup = {
			id: crypto.randomUUID(),
			comboId: combo.id,
			name: combo.name.trim(),
		};
		const ids: Id<"nutritionDiaryEntries">[] = [];
		for (const part of parts) {
			ids.push(
				await ctx.db.insert("nutritionDiaryEntries", {
					userId,
					date,
					meal,
					...part,
					comboGroup,
					loggedAt,
				}),
			);
		}
		await bumpRevision(ctx, userId, date);
		return ids;
	},
});

export const day = query({
	args: { date: v.string() },
	handler: async (ctx, { date }) => {
		const userId = await requireUser(ctx);
		assertDiaryDate(date);
		return daySnapshot(ctx, userId, date);
	},
});

/**
 * Corrects an entry already logged: its meal, its calendar date, or its
 * quantity — any subset, in one save.
 *
 * A quantity change rescales the stored snapshot by the ratio of new to old
 * quantity. It never reads a shipped or Personal Food again — entries are
 * immutable snapshots (spec #68), so "editing" a quantity means transforming
 * the figures already on the entry, not re-deriving them from a source that
 * may since have changed, forked, or disappeared.
 */
export const update = mutation({
	args: {
		id: v.id("nutritionDiaryEntries"),
		quantity: v.optional(v.number()),
		selection: v.optional(v.object({
			serving: v.object({ en: v.string(), nl: v.string() }),
			quantity: v.number(),
			amount: v.number(),
			personalMeasureId: v.union(v.string(), v.null()),
		})),
		meal: v.optional(
			v.union(
				v.literal("breakfast"),
				v.literal("lunch"),
				v.literal("dinner"),
				v.literal("snacks"),
			),
		),
		date: v.optional(v.string()),
	},
	returns: v.id("nutritionDiaryEntries"),
	handler: async (ctx, { id, quantity, selection, meal, date }) => {
		const userId = await requireUser(ctx);
		const entry = await requireOwnedEntry(ctx, userId, id);

		if (date !== undefined) assertDiaryDate(date);

		const patch: Partial<typeof entry> = {};
		if (meal !== undefined) patch.meal = meal;
		if (date !== undefined) patch.date = date;
		if (
			(meal !== undefined && meal !== entry.meal) ||
			(date !== undefined && date !== entry.date)
		) {
			patch.comboGroup = undefined;
		}
		if (selection !== undefined) {
			if (quantity !== undefined) {
				throw new Error("Choose either quantity or a serving selection.");
			}
			assertFinitePositive(selection.quantity, "Quantity");
			assertFinitePositive(selection.amount, "Amount");
			const factor = selection.amount / entry.amount;
			patch.quantity = selection.quantity;
			patch.amount = selection.amount;
			patch.nutrients = rescaleNutrients(entry.nutrients, factor);
			patch.serving = selection.serving;
			patch.personalMeasureId = selection.personalMeasureId ?? undefined;
		} else if (quantity !== undefined) {
			if (!(quantity > 0)) throw new Error("Quantity must be greater than zero.");
			const factor = quantity / entry.quantity;
			patch.quantity = quantity;
			patch.amount = entry.amount * factor;
			patch.nutrients = rescaleNutrients(entry.nutrients, factor);
			patch.serving = {
				en: rescaleServingLabel(entry.serving.en, quantity, "en"),
				nl: rescaleServingLabel(entry.serving.nl, quantity, "nl"),
			};
		}

		if (Object.keys(patch).length > 0) await ctx.db.patch(id, patch);
		if (Object.keys(patch).length > 0) {
			await bumpRevision(ctx, userId, entry.date);
			if (date !== undefined && date !== entry.date) {
				await bumpRevision(ctx, userId, date);
			}
		}
		return id;
	},
});

export const remove = mutation({
	args: { id: v.id("nutritionDiaryEntries") },
	handler: async (ctx, { id }) => {
		const userId = await requireUser(ctx);
		const entry = await requireOwnedEntry(ctx, userId, id);
		await ctx.db.delete(id);
		await bumpRevision(ctx, userId, entry.date);
	},
});

export const applyOperation = mutation({
	args: operationArgs,
	returns: operationResult,
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		if (args.expectedSubject !== userId) throw new Error("Subject mismatch.");
		if (args.operationId.trim().length === 0 || args.operationId.length > 200) {
			throw new Error("Operation ID is invalid.");
		}

		const payload = canonicalJson({
			version: args.version,
			expectedSubject: args.expectedSubject,
			operation: args.operation,
		});
		const previous = await ctx.db
			.query("nutritionDiaryOperationReceipts")
			.withIndex("by_user_operation", (q) =>
				q.eq("userId", userId).eq("operationId", args.operationId),
			)
			.first();
		if (previous) {
			if (previous.payload !== payload) {
				throw new Error("Operation ID was already used with a different payload.");
			}
			return JSON.parse(previous.result) as {
				entryIds: Id<"nutritionDiaryEntries">[];
				clientEntryIds: string[];
				days: unknown[];
			};
		}

		const affectedDates = new Set<string>();
		const entryIds: Id<"nutritionDiaryEntries">[] = [];
		const clientEntryIds: string[] = [];
		const operation = args.operation as unknown as NutritionDiaryOperation;

		if (operation.kind === "create") {
			assertSnapshot(operation.entry);
			assertClientEntryId(operation.entry.clientEntryId);
			await assertClientEntryAvailable(ctx, userId, operation.entry.clientEntryId);
			const id = await ctx.db.insert("nutritionDiaryEntries", {
				userId,
				...operation.entry,
				loggedAt: Date.now(),
			});
			entryIds.push(id);
			clientEntryIds.push(operation.entry.clientEntryId);
			affectedDates.add(operation.entry.date);
		}

		if (operation.kind === "createBatch") {
			assertDiaryDate(operation.date);
			if (operation.entries.length < 1 || operation.entries.length > 100) {
				throw new Error("A batch must contain between 1 and 100 entries.");
			}
			const ids = new Set<string>();
			for (const entry of operation.entries) {
				assertSnapshot({ ...entry, date: operation.date, meal: operation.meal });
				assertClientEntryId(entry.clientEntryId);
				if (ids.has(entry.clientEntryId)) throw new Error("Duplicate client entry ID.");
				ids.add(entry.clientEntryId);
				await assertClientEntryAvailable(ctx, userId, entry.clientEntryId);
			}
			for (const entry of operation.entries) {
				const id = await ctx.db.insert("nutritionDiaryEntries", {
					userId,
					date: operation.date,
					meal: operation.meal,
					...entry,
					loggedAt: Date.now(),
				});
				entryIds.push(id);
				clientEntryIds.push(entry.clientEntryId);
			}
			affectedDates.add(operation.date);
		}

		if (operation.kind === "update") {
			const entry = await ownedEntry(ctx, userId, backendTarget(operation.target));
			const oldDate = entry.date;
			if (operation.date !== undefined) assertDiaryDate(operation.date);
			const patch: Partial<typeof entry> = {};
			if (operation.meal !== undefined) patch.meal = operation.meal;
			if (operation.date !== undefined) patch.date = operation.date;
			if (
				(operation.meal !== undefined && operation.meal !== entry.meal) ||
				(operation.date !== undefined && operation.date !== entry.date)
			) {
				patch.comboGroup = undefined;
			}
			if (operation.selection !== undefined) {
				if (operation.quantity !== undefined) {
					throw new Error("Choose either quantity or a serving selection.");
				}
				assertFinitePositive(operation.selection.quantity, "Quantity");
				assertFinitePositive(operation.selection.amount, "Amount");
				const factor = operation.selection.amount / entry.amount;
				patch.quantity = operation.selection.quantity;
				patch.amount = operation.selection.amount;
				patch.nutrients = rescaleNutrients(entry.nutrients, factor);
				patch.serving = operation.selection.serving;
				patch.personalMeasureId =
					operation.selection.personalMeasureId ?? undefined;
			} else if (operation.quantity !== undefined) {
				assertFinitePositive(operation.quantity, "Quantity");
				const factor = operation.quantity / entry.quantity;
				patch.quantity = operation.quantity;
				patch.amount = entry.amount * factor;
				patch.nutrients = rescaleNutrients(entry.nutrients, factor);
				patch.serving = {
					en: rescaleServingLabel(entry.serving.en, operation.quantity, "en"),
					nl: rescaleServingLabel(entry.serving.nl, operation.quantity, "nl"),
				};
			}
			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(entry._id, patch);
				affectedDates.add(oldDate);
				if (operation.date !== undefined) affectedDates.add(operation.date);
			}
			entryIds.push(entry._id);
			if (entry.clientEntryId) clientEntryIds.push(entry.clientEntryId);
		}

		if (operation.kind === "group") {
			if (operation.targets.length < 1 || operation.targets.length > 100) {
				throw new Error("A Logged Combo must contain between 1 and 100 entries.");
			}
			assertText(operation.comboGroup.id, "Logged Combo ID");
			assertText(operation.comboGroup.comboId, "Combo ID");
			assertText(operation.comboGroup.name, "Combo name");
			const entries = [];
			const seen = new Set<string>();
			for (const target of operation.targets) {
				const key = `${target.kind}:${target.id}`;
				if (seen.has(key)) throw new Error("Duplicate diary entry target.");
				seen.add(key);
				entries.push(await ownedEntry(ctx, userId, backendTarget(target)));
			}
			const [first] = entries;
			if (
				!first ||
				entries.some(
					(entry) => entry.date !== first.date || entry.meal !== first.meal,
				)
			) {
				throw new Error("Logged Combo entries must share one date and Meal Slot.");
			}
			const selectedIds = new Set(entries.map((entry) => String(entry._id)));
			const existingGroupIds = new Set(
				entries
					.map((entry) => entry.comboGroup?.id)
					.filter((id): id is string => id !== undefined),
			);
			if (existingGroupIds.size > 0) {
				for (const groupId of existingGroupIds) {
					const existingParts = await ctx.db
						.query("nutritionDiaryEntries")
						.withIndex("by_user_combo_group", (query) =>
							query.eq("userId", userId).eq("comboGroup.id", groupId),
						)
						.take(operation.targets.length + 1);
					if (
						existingParts.some(
						(entry) =>
							!selectedIds.has(String(entry._id)),
						)
					) {
						throw new Error(
							"Existing Logged Combos must be selected as a whole.",
						);
					}
				}
			}
			for (const entry of entries) {
				await ctx.db.patch(entry._id, { comboGroup: operation.comboGroup });
				if (entry.clientEntryId) {
					entryIds.push(entry._id);
					clientEntryIds.push(entry.clientEntryId);
				}
			}
			affectedDates.add(first.date);
		}

		if (operation.kind === "remove") {
			const entry = await ownedEntry(ctx, userId, backendTarget(operation.target));
			await ctx.db.delete(entry._id);
			affectedDates.add(entry.date);
			entryIds.push(entry._id);
			if (entry.clientEntryId) clientEntryIds.push(entry.clientEntryId);
		}

		for (const date of affectedDates) await bumpRevision(ctx, userId, date);
		const result = {
			entryIds,
			clientEntryIds,
			days: await affectedDays(ctx, userId, affectedDates),
		};
		await ctx.db.insert("nutritionDiaryOperationReceipts", {
			userId,
			operationId: args.operationId,
			payload,
			result: JSON.stringify(result),
			createdAt: Date.now(),
		});
		return result;
	},
});
