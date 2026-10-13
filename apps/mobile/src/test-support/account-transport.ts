import type { NutritionOperationEnvelope } from "@foundry/core";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { type FunctionArgs, getFunctionName } from "convex/server";
import { api } from "../convex/api";
import type { CaptureDraft } from "../data/nutrition-capture-draft";
import {
	createNutritionLocalRepository,
	type NutritionServerDayResult,
} from "../data/nutrition-local-repository";
import type { CaptureDraftFixture } from "./capture-draft-fixture";
import { projectFixtureDay } from "./diary-operation-fixture";
import { SQLiteTestDatabase } from "./sqlite-test-database";

/** Screen fixture server: acknowledgement and subsequent reads share account state.
 * Backend behavior itself is tested through convex-test, not this adapter.
 */
export function installAccountTransport(drafts: CaptureDraftFixture) {
	const mutation = jest.mocked(useMutation).getMockImplementation();
	const query = jest.mocked(useQuery).getMockImplementation();
	const paginated = jest.mocked(usePaginatedQuery).getMockImplementation();
	const remote = mutation?.(api.nutritionDiary.applyOperation);
	const legacy = {
		create: mutation?.(api.nutritionDiary.log),
		update: mutation?.(api.nutritionDiary.update),
		remove: mutation?.(api.nutritionDiary.remove),
		combo: mutation?.(api.nutritionDiary.logCombo),
	};
	const server = createNutritionLocalRepository(new SQLiteTestDatabase());
	const days = new Map<string, NutritionServerDayResult>();
	const notes = new Map(drafts.list("test-user").map((d) => [d.id, d]));
	const receipts = new Map<string, unknown>();
	const readDay = (date: string, initialize = false) => {
		if (!days.has(date)) {
			const initial = query?.(api.nutritionDiary.day, { date }) as
				| NutritionServerDayResult
				| undefined;
			if (initial === undefined && !initialize) return undefined;
			const day = {
				date,
				revision: 0,
				entries: (initial?.entries ?? []).map((e) => ({ ...e, date })),
				totals: initial?.totals ?? {},
			};
			days.set(date, day);
			server.putDay("test-user", {
				...day,
				subject: "test-user",
				complete: true,
				updatedAt: 0,
			});
		}
		return required(days.get(date));
	};
	const apply = jest.fn(async (args: NutritionOperationEnvelope) => {
		if (receipts.has(args.operationId)) return receipts.get(args.operationId);
		const operation = args.operation;
		// Older screen fixtures observe the original API arguments. Keep that adapter
		// at the fake-server boundary; the production provider has no legacy bypass.
		const legacyWriter =
			operation.kind === "create"
				? legacy.create
				: operation.kind === "createBatch"
					? legacy.combo
					: operation.kind === "update"
						? legacy.update
						: operation.kind === "remove"
							? legacy.remove
							: undefined;
		if (legacyWriter && remote === legacyWriter) {
			await legacyWriter(legacyArgs(operation) as never);
		} else {
			const result = await remote?.(args as never);
			if (result !== undefined) return result;
			if (legacyWriter) await legacyWriter(legacyArgs(operation) as never);
		}
		if (operation.kind === "create") readDay(operation.entry.date, true);
		if (
			operation.kind === "createBatch" ||
			operation.kind === "moveBatch" ||
			(operation.kind === "update" && operation.date)
		)
			readDay(required(operation.date), true);
		const pending = [
			{
				sequence: 1,
				subject: "test-user",
				operationId: args.operationId,
				envelope: args,
				status: "queued" as const,
				attempts: 0,
				nextAttemptAt: 0,
				createdAt: 0,
			},
		];
		const changed = [...days.keys()].map((date) => {
			const projected = projectFixtureDay(
				server.getDay("test-user", date),
				date,
				pending,
			);
			const entries = projected.entries.map(
				({ pendingOperationId: _pending, ...entry }) => ({
					...entry,
					_id: entry._id.startsWith("local:")
						? `server:${entry.clientEntryId}`
						: entry._id,
				}),
			);
			return {
				date,
				revision: required(readDay(date)).revision + 1,
				entries,
				totals: projected.totals,
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
		server.recordAcknowledged("test-user", args, result);
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
							createdAt: old?.createdAt ?? args.createdAt ?? Date.now(),
							updatedAt: Date.now(),
						};
			if (result) notes.set(args.id, result);
			else notes.delete(args.id);
			receipts.set(args.operationId, result);
			return result;
		},
	);
	jest.mocked(useMutation).mockImplementation(((ref: never) => {
		const name = getFunctionName(ref);
		return name === "nutritionDiary:applyOperation"
			? apply
			: name === "nutritionDrafts:save"
				? saveNote
				: mutation?.(ref);
	}) as never);
	jest.mocked(useQuery).mockImplementation(((
		ref: never,
		args: { date?: string; id?: string } | "skip",
	) => {
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
	}) as never);
	jest.mocked(usePaginatedQuery).mockImplementation(((
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
	}) as never);
	return { apply, saveNote, notes };
}
function legacyArgs(operation: NutritionOperationEnvelope["operation"]) {
	if (operation.kind === "create") return operation.entry;
	if (operation.kind === "update") {
		const { kind: _kind, target, ...patch } = operation;
		return { id: target.id, ...patch };
	}
	if (operation.kind === "remove") return { id: operation.target.id };
	if (operation.kind === "createBatch")
		return {
			date: operation.date,
			meal: operation.meal,
			combo: {
				id: operation.entries[0]?.comboGroup?.comboId,
				name: operation.entries[0]?.comboGroup?.name,
			},
			parts: operation.entries.map(
				({ clientEntryId: _id, comboGroup: _group, ...part }) => part,
			),
		};
	return operation;
}

function required<T>(value: T | undefined): T {
	if (value === undefined) throw new Error("Missing fixture argument");
	return value;
}
