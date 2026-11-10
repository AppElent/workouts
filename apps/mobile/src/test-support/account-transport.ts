import type { NutritionOperationEnvelope } from "@foundry/core";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { type FunctionArgs, getFunctionName } from "convex/server";
import { api } from "../convex/api";
import type { CaptureDraft } from "../data/nutrition-capture-draft";
import type { CaptureDraftFixture } from "./capture-draft-fixture";
import {
	applyFixtureOperation,
	type FixtureEntry,
} from "./diary-operation-fixture";
import { underlying, wrapping } from "./mock-layers";

type FixtureDay = {
	date: string;
	revision: number;
	entries: FixtureEntry[];
	totals: unknown;
};

/** Screen fixture server: acknowledgement and subsequent reads share account state.
 * Backend behavior itself is tested through convex-test, not this adapter.
 */
export function installAccountTransport(drafts: CaptureDraftFixture) {
	const mutation = underlying(jest.mocked(useMutation).getMockImplementation());
	const query = underlying(jest.mocked(useQuery).getMockImplementation());
	const paginated = underlying(
		jest.mocked(usePaginatedQuery).getMockImplementation(),
	);
	const remote = mutation?.(api.nutritionDiary.applyOperation);
	const days = new Map<string, FixtureDay>();
	const notes = new Map(drafts.list("test-user").map((d) => [d.id, d]));
	const receipts = new Map<string, unknown>();
	const readDay = (date: string, initialize = false) => {
		if (!days.has(date)) {
			const initial = query?.(api.nutritionDiary.day, { date }) as
				| FixtureDay
				| undefined;
			if (initial === undefined && !initialize) return undefined;
			const day = {
				date,
				revision: 0,
				entries: (initial?.entries ?? []).map((entry) => ({ ...entry, date })),
				totals: initial?.totals ?? {},
			};
			days.set(date, day);
		}
		return required(days.get(date));
	};
	const apply = jest.fn(async (args: NutritionOperationEnvelope) => {
		if (receipts.has(args.operationId)) return receipts.get(args.operationId);
		const operation = args.operation;
		const remoteResult = await remote?.(args as never);
		if (remoteResult !== undefined) return remoteResult;
		if (operation.kind === "create") readDay(operation.entry.date, true);
		if (
			operation.kind === "createBatch" ||
			operation.kind === "moveBatch" ||
			(operation.kind === "update" && operation.date)
		)
			readDay(required(operation.date), true);
		const changed = [...days.keys()].map((date) => {
			const { entries, totals } = applyFixtureOperation(
				days.get(date),
				date,
				operation,
			);
			return {
				date,
				revision: required(readDay(date)).revision + 1,
				entries,
				totals,
			};
		});
		const created =
			operation.kind === "create"
				? [operation.entry.clientEntryId]
				: operation.kind === "createBatch"
					? operation.entries.map((e) => e.clientEntryId)
					: [];
		const result = {
			entryIds: created.map((id) => `server:${id}`),
			clientEntryIds: created,
			days: changed,
		};
		for (const day of changed) days.set(day.date, day);
		receipts.set(args.operationId, result);
		return result;
	});
	const saveNote = jest.fn(
		async (args: FunctionArgs<typeof api.nutritionDrafts.save>) => {
			if (receipts.has(args.operationId)) return receipts.get(args.operationId);
			const old = notes.get(args.id);
			const result: CaptureDraft | null =
				args.action === "remove"
					? null
					: {
							id: args.id,
							subject: args.expectedSubject,
							...required(args.input),
							createdAt: old?.createdAt ?? Date.now(),
							updatedAt: Date.now(),
						};
			if (result) notes.set(args.id, result);
			else notes.delete(args.id);
			receipts.set(args.operationId, result);
			return result;
		},
	);
	jest.mocked(useMutation).mockImplementation(
		wrapping((ref: never) => {
			const name = getFunctionName(ref);
			return name === "nutritionDiary:applyOperation"
				? apply
				: name === "nutritionDrafts:save"
					? saveNote
					: mutation?.(ref);
		}, mutation) as never,
	);
	jest.mocked(useQuery).mockImplementation(
		wrapping((ref: never, args: { date?: string; id?: string } | "skip") => {
			if (args === "skip") return undefined;
			const name = getFunctionName(ref);
			if (name === "nutritionDiary:day") return readDay(required(args.date));
			if (name === "nutritionDrafts:get")
				return notes.get(required(args.id)) ?? null;
			if (name === "nutritionDrafts:summary") {
				const other = [...notes.values()]
					.filter((d) => d.date !== args.date)
					.sort((a, b) => a.date.localeCompare(b.date));
				return { count: other.length, oldestDate: other[0]?.date ?? null };
			}
			return query?.(ref, args as never);
		}, query) as never,
	);
	jest.mocked(usePaginatedQuery).mockImplementation(
		wrapping(
			(
				ref: never,
				args: { startDate?: string; endDate?: string } | "skip",
				options: never,
			) => {
				if (getFunctionName(ref) !== "nutritionDrafts:list")
					return paginated?.(ref, args as never, options);
				return {
					results:
						args === "skip"
							? []
							: [...notes.values()].filter(
									(d) =>
										d.date >= required(args.startDate) &&
										d.date <= required(args.endDate),
								),
					status: args === "skip" ? "LoadingFirstPage" : "Exhausted",
					loadMore: jest.fn(),
				};
			},
			paginated,
		) as never,
	);
	return {
		apply,
		saveNote,
		notes,
		/** The fixture server's entries for a date, as the day query returns them. */
		entries: (date: string) => readDay(date)?.entries ?? [],
	};
}
function required<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("Missing fixture argument");
	return value;
}
