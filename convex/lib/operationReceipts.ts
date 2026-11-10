import { canonicalJson } from "@foundry/core";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";

export const operationReceiptKind = v.union(
	v.literal("oneRepMax"),
	v.literal("bodyMetric"),
	v.literal("wodResult"),
);

type OperationReceiptKind = "oneRepMax" | "bodyMetric" | "wodResult";

/**
 * Makes a create mutation safe to retry. The first call with an operation ID
 * writes and stores a receipt; a retry with the same ID and payload returns
 * the stored result, and a different payload under the same ID is rejected.
 * Without an operation ID the write runs as before.
 */
export async function withOperationReceipt<Result extends string>(
	ctx: MutationCtx,
	userId: string,
	receipt: {
		operationId: string | undefined;
		kind: OperationReceiptKind;
		payload: unknown;
	},
	write: () => Promise<Result>,
): Promise<Result> {
	const { operationId, kind } = receipt;
	if (!operationId) return write();
	if (operationId.length > 200) throw new Error("Operation ID is too long.");
	const payload = canonicalJson(receipt.payload);
	const existing = await ctx.db
		.query("operationReceipts")
		.withIndex("by_user_operation", (q) =>
			q.eq("userId", userId).eq("operationId", operationId),
		)
		.unique();
	if (existing) {
		if (existing.kind !== kind || existing.payload !== payload)
			throw new ConvexError(
				"This operation was already submitted with other details.",
			);
		return existing.resultId as Result;
	}
	const resultId = await write();
	await ctx.db.insert("operationReceipts", {
		userId,
		operationId,
		kind,
		payload,
		resultId,
	});
	return resultId;
}
