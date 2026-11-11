import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireSubject } from "./lib/auth";
import { appError } from "./lib/errors";
import { requireFoodPhotoOwner } from "./lib/foodPhotos";

const MAX_PHOTO_BYTES = 2_000_000;

export const generateUploadUrl = mutation({
	args: { expectedSubject: v.string() },
	returns: v.string(),
	handler: async (ctx, { expectedSubject }) => {
		await requireSubject(ctx, expectedSubject);
		return await ctx.storage.generateUploadUrl();
	},
});

/** Claims an uploaded JPEG of at most 2 MB for the caller's account. */
export const registerUpload = mutation({
	args: { storageId: v.id("_storage"), expectedSubject: v.string() },
	returns: v.null(),
	handler: async (ctx, { storageId, expectedSubject }) => {
		const userId = await requireSubject(ctx, expectedSubject);
		const existing = await ctx.db
			.query("nutritionFoodPhotos")
			.withIndex("by_storage", (q) => q.eq("storageId", storageId))
			.unique();
		if (existing) {
			await requireFoodPhotoOwner(ctx, userId, storageId);
			return null;
		}
		const file = await ctx.db.system.get(storageId);
		if (!file) throw appError("notFound", "storageId");
		if (file.contentType !== undefined && file.contentType !== "image/jpeg")
			throw appError("invalid", "contentType");
		if (file.size > MAX_PHOTO_BYTES) throw appError("tooLarge", "size");
		await ctx.db.insert("nutritionFoodPhotos", { userId, storageId });
		return null;
	},
});
