import { canonicalJson } from "@foundry/core";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError } from "./errors";

const receiptCodecs = {
	strengthLogReceipts: {
		read: (receipt: Doc<"strengthLogReceipts">) => receipt.setId,
		write: (setId: Doc<"strengthLogReceipts">["setId"]) => ({ setId }),
	},
	nutritionDiaryOperationReceipts: {
		read: (receipt: Doc<"nutritionDiaryOperationReceipts">): unknown =>
			JSON.parse(receipt.result),
		write: (result: unknown) => ({
			result: JSON.stringify(result),
			createdAt: Date.now(),
		}),
	},
	nutritionLibraryOperationReceipts: {
		read: (receipt: Doc<"nutritionLibraryOperationReceipts">): unknown =>
			JSON.parse(receipt.result),
		write: (result: unknown) => ({
			result: JSON.stringify(result),
			createdAt: Date.now(),
		}),
	},
	nutritionCaptureDraftReceipts: {
		read: (receipt: Doc<"nutritionCaptureDraftReceipts">) => receipt.result,
		write: (result: Doc<"nutritionCaptureDraftReceipts">["result"]) => ({
			result,
		}),
	},
};

type ReceiptTable = keyof typeof receiptCodecs;
type Codec<T extends ReceiptTable, R> = {
	read: (receipt: Doc<T>) => R;
	write: (result: R) => object;
};

export function findReceipt<T extends ReceiptTable>(
	ctx: QueryCtx | MutationCtx,
	table: T,
	userId: string,
	operationId: string,
): Promise<Doc<T> | null> {
	// Every receipt table has this index; the union of tables hides it.
	return ctx.db
		.query(table as "strengthLogReceipts")
		.withIndex("by_user_and_operation", (q) =>
			q.eq("userId", userId).eq("operationId", operationId),
		)
		.unique() as Promise<Doc<T> | null>;
}

/**
 * Runs a client operation at most once. A retry with the same id and payload
 * returns the first run's result; a different payload is `operationConflict`.
 */
export async function withOperationReceipt<
	T extends ReceiptTable,
	R extends ReturnType<(typeof receiptCodecs)[T]["read"]>,
>(
	ctx: MutationCtx,
	table: T,
	operation: { userId: string; operationId: string; payload: unknown },
	run: () => Promise<R>,
): Promise<R> {
	const { userId, operationId } = operation;
	if (!operationId.trim() || operationId.length > 200)
		throw appError("invalid", "operationId");
	const payload = canonicalJson(operation.payload);
	const codec = receiptCodecs[table] as unknown as Codec<T, R>;
	const receipt = await findReceipt(ctx, table, userId, operationId);
	if (receipt) {
		if (receipt.payload !== payload) throw appError("operationConflict");
		return codec.read(receipt);
	}
	const result = await run();
	await ctx.db.insert(table, {
		userId,
		operationId,
		payload,
		...codec.write(result),
	} as never);
	return result;
}
