import { requireFoodPhotoOwner } from "./nutritionFoodPhotos";
import { libraryIndexFields } from "./lib/nutritionLibraryIndex";
import { paginationOptsValidator } from "convex/server";
import { v, type Infer } from "convex/values";
import { canonicalJson, normalizePersonalFood, type PersonalFood } from "@workouts/core";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { libraryRecordKind, librarySchemaVersion } from "./nutritionLibraryTables";

const libraryRecord = v.object({
	subject: v.optional(v.string()),
	schemaVersion: v.optional(librarySchemaVersion),
	id: v.string(),
	kind: libraryRecordKind,
	payload: v.union(v.string(), v.null()),
	revision: v.number(),
	deleted: v.boolean(),
});

const operation = v.union(
	v.object({
		kind: v.literal("upsert"),
		record: v.object({ id: v.string(), kind: libraryRecordKind, payload: v.string(), schemaVersion: v.optional(librarySchemaVersion) }),
		expectedRevision: v.number(),
	}),
	v.object({
		kind: v.literal("remove"),
		recordId: v.string(),
		recordKind: libraryRecordKind,
		expectedRevision: v.number(),
	}),
);

const operationArgs = {
	version: v.literal(1),
	operationId: v.string(),
	expectedSubject: v.string(),
	operation,
};

async function requireUser(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

function assertId(value: string, label: string) {
	if (value.trim().length === 0 || value.length > 200) {
		throw new Error(`${label} is invalid.`);
	}
}

const NUTRIENT_KEYS = [
	"energy", "protein", "carbs", "fat", "saturatedFat", "fibre", "sugars", "salt",
] as const;

function asObject(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${label} is invalid.`);
	}
	return value as Record<string, unknown>;
}

function assertText(value: unknown, label: string) {
	if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) {
		throw new Error(`${label} is invalid.`);
	}
}

function assertBilingual(value: unknown, label: string) {
	const candidate = asObject(value, label);
	assertText(candidate.en, `${label} English`);
	assertText(candidate.nl, `${label} Dutch`);
}

function assertFinite(value: unknown, label: string, positive = false) {
	if (typeof value !== "number" || !Number.isFinite(value) || (positive && value <= 0)) {
		throw new Error(`${label} is invalid.`);
	}
}

function assertNutrients(value: unknown) {
	const nutrients = asObject(value, "Nutrients");
	for (const key of NUTRIENT_KEYS) {
		const nutrient = asObject(nutrients[key], `Nutrient ${key}`);
		if (nutrient.kind === "value") {
			assertFinite(nutrient.amount, `Nutrient ${key}`);
			if ((nutrient.amount as number) < 0) throw new Error(`Nutrient ${key} must be zero or greater.`);
		}
		else if (nutrient.kind !== "trace" && nutrient.kind !== "absent") {
			throw new Error(`Nutrient ${key} is invalid.`);
		}
	}
}

function assertFoodPayload(payload: Record<string, unknown>, id: string) {
	if (payload.id !== id) throw new Error("Food payload identity is invalid.");
	const food = normalizePersonalFood(payload as PersonalFood);
	if (food.visual?.kind === "photo" && !food.visual.storageId) {
		throw new Error("Device-local Food photos cannot be backed up.");
	}
}

function assertComboProvenance(value: unknown, reference: Record<string, unknown>) {
	const provenance = asObject(value, "Combo provenance");
	if (reference.kind === "oneOff") {
		if (provenance.source !== "oneOff") throw new Error("Combo provenance is invalid.");
		return;
	}
	if (provenance.sourceId !== reference.foodId) throw new Error("Combo reference is invalid.");
	if (reference.kind === "shipped") {
		if (provenance.source !== "shipped") throw new Error("Combo provenance is invalid.");
		assertText(provenance.dataset, "Combo dataset");
		assertText(provenance.edition, "Combo dataset edition");
		assertFinite(provenance.sourceCode, "Combo source code");
		assertBilingual(provenance.sourceName, "Combo source name");
		if (typeof provenance.saltDerived !== "boolean") throw new Error("Combo provenance is invalid.");
		return;
	}
	if (provenance.source !== "personal" && provenance.source !== "import") {
		throw new Error("Combo provenance is invalid.");
	}
	if (typeof provenance.nutritionSource !== "string" || !["manual", "nevo", "lidl", "openfoodfacts"].includes(provenance.nutritionSource)) {
		throw new Error("Combo provenance is invalid.");
	}
	if (typeof provenance.locallyEdited !== "boolean") throw new Error("Combo provenance is invalid.");
}

function assertComboPayload(payload: Record<string, unknown>, id: string) {
	if (payload.id !== id) throw new Error("Combo payload identity is invalid.");
	assertText(payload.name, "Combo name");
	if (!Array.isArray(payload.parts) || payload.parts.length === 0) throw new Error("Combo parts are invalid.");
	for (const part of payload.parts) {
		const candidate = asObject(part, "Combo part");
		assertText(candidate.id, "Combo part ID");
		const reference = asObject(candidate.reference, "Combo reference");
		if (typeof reference.kind !== "string" || !["shipped", "personal", "oneOff"].includes(reference.kind)) {
			throw new Error("Combo reference is invalid.");
		}
		if (reference.kind !== "oneOff") assertText(reference.foodId, "Combo reference ID");
		const snapshot = asObject(candidate.snapshot, "Combo snapshot");
		assertBilingual(snapshot.name, "Combo snapshot name");
		assertBilingual(snapshot.serving, "Combo snapshot serving");
		assertFinite(snapshot.quantity, "Combo quantity", true);
		assertFinite(snapshot.amount, "Combo amount", true);
		if (snapshot.baseUnit !== "g" && snapshot.baseUnit !== "ml" && snapshot.baseUnit !== "serving") throw new Error("Combo unit is invalid.");
		if (snapshot.estimated !== undefined && snapshot.estimated !== true) throw new Error("Combo estimate status is invalid.");
		assertNutrients(snapshot.nutrients);
		assertComboProvenance(snapshot.provenance, reference);
	}
	assertFinite(payload.createdAt, "Combo creation timestamp");
	assertFinite(payload.updatedAt, "Combo update timestamp");
}

/** Full server validation keeps malformed JSON from becoming a future restore. */
function assertPayload(id: string, kind: "food" | "combo", payload: string, schemaVersion: 1 | 2 | 3) {
	if (payload.length === 0 || payload.length > 200_000) {
		throw new Error("Library payload is invalid.");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(payload);
	} catch {
		throw new Error("Library payload is invalid.");
	}
	const candidate = asObject(parsed, "Library payload");
	if (kind === "food") assertFoodPayload(candidate, id);
	else assertComboPayload(candidate, id);
	const needsCurrentVersion = kind === "food"
		? ["classification", "nutritionBasis", "estimated", "description", "visual"].some((key) => candidate[key] !== undefined)
		: (candidate.parts as { snapshot: { estimated?: true; baseUnit: string } }[]).some(({ snapshot }) => snapshot.estimated !== undefined || snapshot.baseUnit === "serving");
	if (schemaVersion < 2 && needsCurrentVersion) {
		throw new Error("These library fields require payload schema version 2.");
	}
}

function canonicalPayload(args: { version: 1; expectedSubject: string; operation: unknown }) {
	return canonicalJson({
		version: args.version,
		expectedSubject: args.expectedSubject,
		operation: args.operation,
	});
}

function asRecord(row: {
	recordId: string;
	recordKind: "food" | "combo";
	payload?: string;
	schemaVersion?: 1 | 2 | 3;
	revision: number;
	deleted: boolean;
}) {
	return {
		id: row.recordId,
		schemaVersion: row.schemaVersion ?? 1,
		kind: row.recordKind,
		payload: row.payload ?? null,
		revision: row.revision,
		deleted: row.deleted,
	};
}

async function serveRecord(ctx: Pick<QueryCtx, "storage" | "db">, row: Parameters<typeof asRecord>[0], photoVersion = 3) {
    const record = asRecord(row);
    if (!record.deleted && record.kind === "food" && record.payload) {
        const food: PersonalFood = JSON.parse(record.payload);
        if (food.visual?.kind === "photo" && food.visual.storageId) {
            const storageId = ctx.db.system.normalizeId("_storage", food.visual.storageId);
            const uri = storageId ? await ctx.storage.getUrl(storageId) : null;
            record.payload = JSON.stringify({...food, visual: uri ? {...food.visual, uri} : undefined});
        }
    }
    if (photoVersion < 3 && record.kind === "food" && record.payload) {
        const food: PersonalFood = JSON.parse(record.payload);
        if (food.visual?.kind === "remote" || (food.visual?.kind === "photo" && food.visual.storageId)) record.payload = JSON.stringify({...food,visual:undefined});
    }
    return record;
}

export const list = query({
	args: { paginationOpts: paginationOptsValidator, photoVersion: v.optional(v.literal(3)) },
	returns: v.object({
		page: v.array(libraryRecord),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const page = await ctx.db
			.query("nutritionLibraryRecords")
			.withIndex("by_user_and_updated_at", (q) => q.eq("userId", userId))
			.order("asc")
			.paginate(args.paginationOpts);
		return {
			page: await Promise.all(page.page.map((row) => serveRecord(ctx, row, args.photoVersion ?? 2))),
			isDone: page.isDone,
			continueCursor: page.continueCursor,
		};
	},
});

/**
 * Optimistic-concurrency write with an immutable operation receipt. Deletions
 * are rows, never physical deletes, so a delayed old update cannot resurrect a
 * library item after it was removed on another device.
 */
async function applyLibraryOperation(ctx: MutationCtx, args: Infer<typeof operationEnvelope>, online = false, migration = false): Promise<{ record: ReturnType<typeof asRecord>; preservedRecords?: ReturnType<typeof asRecord>[] }> {
		const userId = await requireUser(ctx);
		if (args.expectedSubject !== userId) throw new Error("Subject mismatch.");
		assertId(args.operationId, "Operation ID");
		const payload = canonicalPayload(args);
		const receipt = await ctx.db
			.query("nutritionLibraryOperationReceipts")
			.withIndex("by_user_and_operation", (q) =>
				q.eq("userId", userId).eq("operationId", args.operationId),
			)
			.first();
		if (receipt) {
			if (receipt.payload !== payload) {
				throw new Error("Operation ID was already used with a different payload.");
			}
			return JSON.parse(receipt.result) as { record: ReturnType<typeof asRecord>; preservedRecords?: ReturnType<typeof asRecord>[] };
		}

		const target =
			args.operation.kind === "upsert"
				? args.operation.record
				: { id: args.operation.recordId, kind: args.operation.recordKind };
		if (!target.id.trim() || target.id.length > 512) throw new Error("Library record ID is invalid.");
		if (args.operation.expectedRevision < 0 || !Number.isInteger(args.operation.expectedRevision)) {
			throw new Error("Expected revision is invalid.");
		}
		if (args.operation.kind === "upsert") {
			assertPayload(target.id, target.kind, args.operation.record.payload, args.operation.record.schemaVersion ?? 1);
            if (target.kind === "food") {
                const food: PersonalFood = JSON.parse(args.operation.record.payload);
                if (food.visual?.kind === "photo" && food.visual.storageId) {
                    const storageId = ctx.db.system.normalizeId("_storage", food.visual.storageId);
                    if (!storageId) throw new Error("Food photo identifier is invalid.");
                    await requireFoodPhotoOwner(ctx, storageId);
                }
                if (food.visual?.kind === "remote" && (food.provenance.nutritionSource !== "openfoodfacts" || food.visual.uri !== food.provenance.imageUrl)) throw new Error("Provider photos must reference this Open Food Facts import.");
                if ((food.visual?.kind === "remote" || (food.visual?.kind === "photo" && food.visual.storageId)) && (args.operation.record.schemaVersion ?? 1) < 3) throw new Error("Account photos require payload schema version 3.");
            }
		}
		const current = await ctx.db
			.query("nutritionLibraryRecords")
			.withIndex("by_user_and_record", (q) =>
				q.eq("userId", userId).eq("recordId", target.id),
			)
			.first();
		const currentRevision = current?.revision ?? 0;
		if (current && current.recordKind !== target.kind) {
			throw new Error("Library record kind cannot change.");
		}
		if (online && args.operation.kind === "upsert" && (current?.deleted || (!current && args.operation.expectedRevision > 0))) {
			throw new Error("This library record was deleted.");
		}
		if (!online && !migration && currentRevision !== args.operation.expectedRevision) {
			throw new Error("Conflict: this library record changed on another device.");
		}
		const schemaVersion = args.operation.kind === "upsert"
			? args.operation.record.schemaVersion ?? 1
			: current?.schemaVersion ?? 1;
		const olderSchema = schemaVersion < (current?.schemaVersion ?? 1);
		if (olderSchema && !migration) {
			throw new Error("This library record requires a newer app; payload schema downgrade rejected.");
		}
		const preservedRecords: ReturnType<typeof asRecord>[] = [];
        if (migration && current && (olderSchema || currentRevision !== args.operation.expectedRevision || (current.deleted && args.operation.kind === "upsert"))) {
            // A conflicting deletion never erases a newer live version. A conflicting
            // upsert keeps both versions as independently editable records.
            if (args.operation.kind === "remove") {
                const result = { record: await serveRecord(ctx, current) };
                await ctx.db.insert("nutritionLibraryOperationReceipts", { userId, operationId: args.operationId, payload, result: canonicalJson(result), createdAt: Date.now() });
                return result;
            }
            const copyId = `legacy:${args.operationId}`;
            const preserveLocal = current.deleted || olderSchema;
            const sourcePayload = preserveLocal ? args.operation.record.payload : current.payload!;
            const copyPayload = JSON.parse(sourcePayload);
            copyPayload.id = copyId;
            if (typeof copyPayload.name === "string") copyPayload.name = `${copyPayload.name.slice(0, 475)} (Recovered copy)`;
            else copyPayload.name = { en: `${copyPayload.name.en.slice(0, 475)} (Recovered copy)`, nl: `${copyPayload.name.nl.slice(0, 475)} (Herstelde kopie)` };
            const copy = { userId, recordId: copyId, recordKind: target.kind, payload: JSON.stringify(copyPayload), schemaVersion: preserveLocal ? args.operation.record.schemaVersion ?? 1 : current.schemaVersion ?? 1, revision: 1, deleted: false, updatedAt: Date.now() };
            assertPayload(copyId, copy.recordKind, copy.payload, copy.schemaVersion);
            await ctx.db.insert("nutritionLibraryRecords", { ...copy, ...libraryIndexFields(copy.recordKind, copy.payload) });
            preservedRecords.push(await serveRecord(ctx, copy));
            if (preserveLocal) {
                const result = { record: await serveRecord(ctx, current), preservedRecords };
                await ctx.db.insert("nutritionLibraryOperationReceipts", { userId, operationId: args.operationId, payload, result: canonicalJson(result), createdAt: Date.now() });
                return result;
            }
        }
        const revision = currentRevision + 1;
		const next = {
			userId,
			recordId: target.id,
			recordKind: target.kind,
			schemaVersion,
			revision,
			deleted: args.operation.kind === "remove",
			...(args.operation.kind === "upsert" ? { payload: args.operation.record.payload } : {}),
			updatedAt: Date.now(),
            ...libraryIndexFields(target.kind, args.operation.kind === "upsert" ? args.operation.record.payload : undefined),
		};
		if (current) await ctx.db.replace(current._id, next);
		else await ctx.db.insert("nutritionLibraryRecords", next);
		const record = await serveRecord(ctx, next);
		const result = { record, ...(preservedRecords.length ? { preservedRecords } : {}) };
		await ctx.db.insert("nutritionLibraryOperationReceipts", {
			userId,
			operationId: args.operationId,
			payload,
			result: canonicalJson(result),
			createdAt: Date.now(),
		});
		return result;
}

const operationEnvelope = v.object(operationArgs);

/** Retained for migration and older clients with durable revision-based journals. */
export const applyOperation = mutation({
	args: operationArgs,
	returns: v.object({ record: libraryRecord }),
	handler: (ctx, args) => applyLibraryOperation(ctx, args),
});

/** Ordinary online edits use server acceptance order; tombstones are final. */
export const save = mutation({
	args: operationArgs,
	returns: v.object({ record: libraryRecord }),
	handler: (ctx, args) => applyLibraryOperation(ctx, args, true),
});

/** Only old durable journals use this endpoint. Both conflicting versions survive. */
export const migrateOperation = mutation({
    args: operationArgs,
    returns: v.object({ record: libraryRecord, preservedRecords: v.optional(v.array(libraryRecord)) }),
    handler: (ctx, args) => applyLibraryOperation(ctx, args, false, true),
});

const category = v.union(v.literal("food"), v.literal("recipe"), v.literal("combo"));
export const browse = query({
 args: { query: v.string(), category: v.optional(category), paginationOpts: paginationOptsValidator, photoVersion: v.optional(v.literal(3)) },
 returns: v.object({ page: v.array(libraryRecord), isDone: v.boolean(), continueCursor: v.string() }),
 handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  if (args.query.length > 200) throw new Error("Search is too long.");
  const text = args.query.trim();
  const records = ctx.db.query("nutritionLibraryRecords");
  const selected = text ? records.withSearchIndex("search_library", q => {
   const search = q.search("searchText", text).eq("userId", userId).eq("deleted", false);
   return args.category ? search.eq("category", args.category) : search;
  }) : args.category ? records.withIndex("by_user_deleted_category_name", q => q.eq("userId", userId).eq("deleted", false).eq("category", args.category)) : records.withIndex("by_user_deleted_name", q => q.eq("userId", userId).eq("deleted", false));
  const result = await selected.paginate({ ...args.paginationOpts, numItems: Math.min(100, args.paginationOpts.numItems) });
  return { page: await Promise.all(result.page.map(async row => ({ ...await serveRecord(ctx, row, args.photoVersion ?? 2), subject: userId }))), isDone: result.isDone, continueCursor: result.continueCursor };
 },
});

/** Resolve selected records and their personal Combo sources, with a hard read bound. */
export const getMany = query({
 args: { ids: v.array(v.string()), forkIds: v.optional(v.array(v.string())), barcode: v.optional(v.string()), photoVersion: v.optional(v.literal(3)) },
 returns: v.array(libraryRecord),
 handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  if (args.ids.length > 100 || (args.forkIds?.length ?? 0) > 100) throw new Error("Request at most 100 library identities.");
  const records = new Map<string, ReturnType<typeof asRecord>>();
  async function get(id: string) {
   const row = await ctx.db.query("nutritionLibraryRecords").withIndex("by_user_and_record", q => q.eq("userId", userId).eq("recordId", id)).unique();
   if (row) records.set(row.recordId, await serveRecord(ctx, row, args.photoVersion ?? 2));
  }
  await Promise.all([...new Set(args.ids)].map(get));
  for (const forkId of args.forkIds ?? []) {
   const row = await ctx.db.query("nutritionLibraryRecords").withIndex("by_user_fork", q => q.eq("userId", userId).eq("forkedFrom", forkId).eq("deleted", false)).first();
   if (row) records.set(row.recordId, await serveRecord(ctx, row, args.photoVersion ?? 2));
  }
  if (args.barcode) {
   const row = await ctx.db.query("nutritionLibraryRecords").withIndex("by_user_barcode", q => q.eq("userId", userId).eq("barcode", args.barcode).eq("deleted", false)).first();
   if (row) records.set(row.recordId, await serveRecord(ctx, row, args.photoVersion ?? 2));
  }
  const sources = new Set<string>();
  // Resolve sources for the selected Combo, not every Combo in a shortcut list.
  for (const record of records.values()) if (args.ids.length === 1 && record.kind === "combo" && !record.deleted && record.payload) {
   for (const part of JSON.parse(record.payload).parts) if (part.reference.kind === "personal" && !records.has(part.reference.foodId)) sources.add(part.reference.foodId);
  }
  if (sources.size > 100) throw new Error("Resolve fewer Combos at once.");
  await Promise.all([...sources].map(get));
  return [...records.values()].map(record => ({ ...record, subject: userId }));
 },
});
