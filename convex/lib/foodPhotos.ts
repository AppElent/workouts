import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "./errors";

/** A stored food photo may only be referenced by the account that uploaded it. */
export async function requireFoodPhotoOwner(
	ctx: Pick<QueryCtx, "db">,
	userId: string,
	storageId: Id<"_storage">,
) {
	const photo = await ctx.db
		.query("nutritionFoodPhotos")
		.withIndex("by_storage", (q) => q.eq("storageId", storageId))
		.unique();
	if (!photo || photo.userId !== userId)
		throw appError("notFound", "storageId");
}
