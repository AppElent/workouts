import type { PersonalFood } from "@foundry/core";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
	internalMutation,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";

async function subject(ctx: Pick<QueryCtx, "auth">) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Unauthenticated");
	return identity.subject;
}

export async function requireFoodPhotoOwner(
	ctx: Pick<QueryCtx, "db" | "auth">,
	storageId: Id<"_storage">,
) {
	const userId = await subject(ctx);
	const photo = await ctx.db
		.query("nutritionFoodPhotos")
		.withIndex("by_storage", (q) => q.eq("storageId", storageId))
		.unique();
	if (!photo || photo.userId !== userId)
		throw new Error("This photo belongs to another account.");
}

export const generateUploadUrl = mutation({
	args: { expectedSubject: v.string() },
	returns: v.string(),
	handler: async (ctx, { expectedSubject }) => {
		if ((await subject(ctx)) !== expectedSubject)
			throw new Error("Subject mismatch.");
		return await ctx.storage.generateUploadUrl();
	},
});

export const registerUpload = mutation({
	args: { storageId: v.id("_storage"), expectedSubject: v.string() },
	returns: v.null(),
	handler: async (ctx, { storageId, expectedSubject }) => {
		const userId = await subject(ctx);
		if (userId !== expectedSubject) throw new Error("Subject mismatch.");
		const existing = await ctx.db
			.query("nutritionFoodPhotos")
			.withIndex("by_storage", (q) => q.eq("storageId", storageId))
			.unique();
		if (existing) {
			if (existing.userId !== userId)
				throw new Error("This photo belongs to another account.");
			return null;
		}
		const file = await ctx.db.system.get(storageId);
		if (
			!file ||
			(file.contentType !== undefined && file.contentType !== "image/jpeg") ||
			file.size > 2_000_000
		)
			throw new Error("Upload a JPEG photo smaller than 2 MB.");
		await ctx.db.insert("nutritionFoodPhotos", { userId, storageId });
		return null;
	},
});

export const url = query({
	args: { storageId: v.id("_storage") },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, { storageId }) => {
		const userId = await subject(ctx);
		const photo = await ctx.db
			.query("nutritionFoodPhotos")
			.withIndex("by_storage", (q) => q.eq("storageId", storageId))
			.unique();
		return photo?.userId === userId
			? await ctx.storage.getUrl(storageId)
			: null;
	},
});

/** Explicit, bounded adoption of provider images; nutrition snapshots stay unchanged. */
export const useProviderImages = internalMutation({
	args: {
		expectedSubject: v.string(),
		table: v.union(v.literal("library"), v.literal("diary")),
		dryRun: v.optional(v.boolean()),
		paginationOpts: paginationOptsValidator,
	},
	returns: v.object({
		changed: v.number(),
		scanned: v.number(),
		isDone: v.boolean(),
		continueCursor: v.string(),
	}),
	handler: async (ctx, args) => {
		// Only authenticated deployment operators can invoke this internal function.
		const userId = args.expectedSubject;
		let changed = 0;
		if (args.table === "library") {
			const page = await ctx.db
				.query("nutritionLibraryRecords")
				.withIndex("by_user_and_record", (q) => q.eq("userId", userId))
				.paginate(args.paginationOpts);
			for (const row of page.page) {
				if (row.deleted || row.recordKind !== "food" || !row.payload) continue;
				const food: PersonalFood = JSON.parse(row.payload);
				const uri = food.provenance.imageUrl;
				if (
					food.provenance.nutritionSource !== "openfoodfacts" ||
					food.visual ||
					!uri?.startsWith("https://")
				)
					continue;
				if (args.dryRun) {
					changed++;
					continue;
				}
				await ctx.db.patch(row._id, {
					payload: JSON.stringify({ ...food, visual: { kind: "remote", uri } }),
					schemaVersion: 3,
					revision: row.revision + 1,
					updatedAt: Date.now(),
				});
				changed++;
			}
			return {
				changed,
				scanned: page.page.length,
				isDone: page.isDone,
				continueCursor: page.continueCursor,
			};
		}
		const page = await ctx.db
			.query("nutritionDiaryEntries")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.paginate(args.paginationOpts);
		const dates = new Set<string>();
		const urls = new Map<string, string | null>();
		for (const row of page.page) {
			if (
				row.visual?.kind !== "photo" ||
				row.visual.storageId ||
				!row.visual.uri.startsWith("file://") ||
				row.provenance.source !== "import" ||
				row.provenance.nutritionSource !== "openfoodfacts"
			)
				continue;
			const sourceId = row.provenance.sourceId;
			if (!urls.has(sourceId)) {
				const direct = await ctx.db
					.query("nutritionLibraryRecords")
					.withIndex("by_user_and_record", (q) =>
						q.eq("userId", userId).eq("recordId", sourceId),
					)
					.unique();
				const foodRow =
					direct ??
					(await ctx.db
						.query("nutritionLibraryRecords")
						.withIndex("by_user_and_record", (q) =>
							q.eq("userId", userId).eq("recordId", `device:${sourceId}`),
						)
						.unique());
				const food: PersonalFood | undefined =
					foodRow && !foodRow.deleted && foodRow.payload
						? JSON.parse(foodRow.payload)
						: undefined;
				urls.set(
					sourceId,
					food?.provenance.nutritionSource === "openfoodfacts"
						? (food.provenance.imageUrl ?? null)
						: null,
				);
			}
			const uri = urls.get(sourceId);
			if (!uri?.startsWith("https://")) continue;
			if (args.dryRun) {
				changed++;
				continue;
			}
			await ctx.db.patch(row._id, { visual: { kind: "remote", uri } });
			dates.add(row.date);
			changed++;
		}
		for (const date of dates) {
			const version = await ctx.db
				.query("nutritionDiaryDayVersions")
				.withIndex("by_user_date", (q) =>
					q.eq("userId", userId).eq("date", date),
				)
				.unique();
			if (version)
				await ctx.db.patch(version._id, { revision: version.revision + 1 });
			else
				await ctx.db.insert("nutritionDiaryDayVersions", {
					userId,
					date,
					revision: 1,
				});
		}
		return {
			changed,
			scanned: page.page.length,
			isDone: page.isDone,
			continueCursor: page.continueCursor,
		};
	},
});
