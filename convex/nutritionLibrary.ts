import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { canonicalJson, normalizePersonalFood, type PersonalFood } from "@workouts/core";
import { mutation, query } from "./_generated/server";
import { libraryRecordKind, librarySchemaVersion } from "./nutritionLibraryTables";

const libraryRecord = v.object({
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
	normalizePersonalFood(payload as PersonalFood);
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
	if (typeof provenance.nutritionSource !== "string" || !["manual", "nevo", "openfoodfacts"].includes(provenance.nutritionSource)) {
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
function assertPayload(id: string, kind: "food" | "combo", payload: string, schemaVersion: 1 | 2) {
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
		? ["classification", "nutritionBasis", "estimated", "description"].some((key) => candidate[key] !== undefined)
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
	schemaVersion?: 1 | 2;
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

export const list = query({
	args: { paginationOpts: paginationOptsValidator },
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
			page: page.page.map(asRecord),
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
export const applyOperation = mutation({
	args: operationArgs,
	returns: v.object({ record: libraryRecord }),
	handler: async (ctx, args) => {
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
			return JSON.parse(receipt.result) as { record: ReturnType<typeof asRecord> };
		}

		const target =
			args.operation.kind === "upsert"
				? args.operation.record
				: { id: args.operation.recordId, kind: args.operation.recordKind };
		assertId(target.id, "Library record ID");
		if (args.operation.expectedRevision < 0 || !Number.isInteger(args.operation.expectedRevision)) {
			throw new Error("Expected revision is invalid.");
		}
		if (args.operation.kind === "upsert") {
			assertPayload(target.id, target.kind, args.operation.record.payload, args.operation.record.schemaVersion ?? 1);
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
		if (currentRevision !== args.operation.expectedRevision) {
			throw new Error("Conflict: this library record changed on another device.");
		}
		const schemaVersion = args.operation.kind === "upsert"
			? args.operation.record.schemaVersion ?? 1
			: current?.schemaVersion ?? 1;
		if (schemaVersion < (current?.schemaVersion ?? 1)) {
			throw new Error("This library record requires a newer app; payload schema downgrade rejected.");
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
		};
		if (current) await ctx.db.replace(current._id, next);
		else await ctx.db.insert("nutritionLibraryRecords", next);
		const record = asRecord(next);
		const result = { record };
		await ctx.db.insert("nutritionLibraryOperationReceipts", {
			userId,
			operationId: args.operationId,
			payload,
			result: canonicalJson(result),
			createdAt: Date.now(),
		});
		return result;
	},
});
