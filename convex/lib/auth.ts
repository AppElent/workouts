import type { Auth } from "convex/server";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "./errors";

type AuthCtx = { auth: Auth };

type OwnedTable = {
	[T in TableNames]: "userId" extends keyof Doc<T> ? T : never;
}[TableNames];

export async function getOptionalUserId(ctx: AuthCtx) {
	return (await ctx.auth.getUserIdentity())?.subject ?? null;
}

export async function requireUserId(ctx: AuthCtx) {
	const userId = await getOptionalUserId(ctx);
	if (!userId) throw appError("unauthenticated");
	return userId;
}

/**
 * Another account's row reads as missing, so a caller cannot probe which ids
 * exist.
 */
export async function getOwned<T extends OwnedTable>(
	ctx: Pick<QueryCtx, "db">,
	userId: string,
	id: Id<T>,
): Promise<Doc<T> | null> {
	const row = await ctx.db.get(id);
	return row && (row as { userId?: string }).userId === userId ? row : null;
}

export async function requireOwned<T extends OwnedTable>(
	ctx: Pick<QueryCtx, "db">,
	userId: string,
	id: Id<T>,
): Promise<Doc<T>> {
	const row = await getOwned(ctx, userId, id);
	if (!row) throw appError("notFound");
	return row;
}

/**
 * The caller, who must still be the account a device started its work for:
 * a sign-in switch in between fails with `accountChanged`.
 */
export async function requireSubject(ctx: AuthCtx, expectedSubject: string) {
	const userId = await requireUserId(ctx);
	if (userId !== expectedSubject) throw appError("accountChanged");
	return userId;
}
