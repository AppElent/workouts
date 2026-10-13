/** Fake server projection for screen fixtures; Convex APIs own behavioral tests. */
import {
	correctDiaryNutrients,
	type NutritionDiaryOperation,
	type NutritionDiarySnapshot,
	rescaleNutrients,
	totalNutrients,
} from "@workouts/core";
import type {
	LocalProjectionHint,
	NutritionCachedDay,
	NutritionLocalOperation,
	NutritionProjectedDay,
	NutritionProjectedEntry,
} from "../data/nutrition-local-repository";

function entryForSnapshot(
	snapshot: NutritionDiarySnapshot,
	pendingOperationId?: string,
): NutritionProjectedEntry {
	return {
		_id: `client:${snapshot.clientEntryId ?? pendingOperationId ?? "local"}`,
		...snapshot,
		...(pendingOperationId ? { pendingOperationId } : {}),
	};
}

function entryMatches(
	entry: NutritionProjectedEntry,
	target:
		| { kind: "serverId"; id: string }
		| { kind: "clientEntryId"; id: string },
) {
	return target.kind === "serverId"
		? entry._id === target.id
		: entry.clientEntryId === target.id;
}

function applyUpdate(
	entries: NutritionProjectedEntry[],
	operation: Extract<NutritionDiaryOperation, { kind: "update" }>,
	operationId: string,
	hint?: LocalProjectionHint,
) {
	let entry = entries.find((candidate) =>
		entryMatches(candidate, operation.target),
	);
	if (!entry && hint?.targetEntry) {
		entry = entryForSnapshot(hint.targetEntry);
		entries.push(entry);
	}
	if (!entry) return;
	if (
		operation.correction &&
		(operation.quantity !== undefined || operation.selection)
	) {
		throw new Error("A nutrient correction cannot change the amount");
	}
	const oldQuantity = entry.quantity;
	const quantity =
		operation.selection?.quantity ?? operation.quantity ?? oldQuantity;
	const factor = operation.selection
		? operation.selection.amount / entry.amount
		: quantity / oldQuantity;
	const moved =
		(operation.date !== undefined && operation.date !== entry.date) ||
		(operation.meal !== undefined && operation.meal !== entry.meal);
	const next = {
		...entry,
		...(operation.date ? { date: operation.date } : {}),
		...(operation.meal ? { meal: operation.meal } : {}),
		...(operation.selection
			? {
					quantity,
					amount: operation.selection.amount,
					serving: operation.selection.serving,
					personalMeasureId: operation.selection.personalMeasureId ?? undefined,
					nutrients: rescaleNutrients(entry.nutrients, factor),
				}
			: operation.quantity
				? {
						quantity,
						amount: entry.amount * factor,
						nutrients: rescaleNutrients(entry.nutrients, factor),
					}
				: {}),
		pendingOperationId: operationId,
	};
	if (operation.correction)
		Object.assign(next, correctDiaryNutrients(next, operation.correction));
	if (moved) {
		delete next.comboGroup;
	}
	const index = entries.indexOf(entry);
	entries[index] = next;
}

function applyGroup(
	entries: NutritionProjectedEntry[],
	operation: Extract<NutritionDiaryOperation, { kind: "group" }>,
	operationId: string,
) {
	for (const target of operation.targets) {
		const index = entries.findIndex((entry) => entryMatches(entry, target));
		if (index < 0) continue;
		entries[index] = {
			...entries[index],
			comboGroup: operation.comboGroup,
			pendingOperationId: operationId,
		};
	}
}

export function projectFixtureDay(
	base: NutritionCachedDay | undefined,
	date: string,
	operations: readonly NutritionLocalOperation[],
): NutritionProjectedDay {
	const entries = (base?.entries ?? []).map((entry) => ({ ...entry }));
	const pendingOperationIds: string[] = [];
	for (const local of operations) {
		if (local.status === "acknowledged") continue;
		const operation = local.envelope.operation;
		if (operation.kind === "create") {
			if (
				operation.entry.date === date &&
				!entries.some(
					(entry) => entry.clientEntryId === operation.entry.clientEntryId,
				)
			) {
				entries.push(entryForSnapshot(operation.entry, local.operationId));
			}
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "createBatch") {
			if (operation.date === date) {
				for (const entry of operation.entries) {
					if (
						!entries.some(
							(candidate) => candidate.clientEntryId === entry.clientEntryId,
						)
					) {
						entries.push(
							entryForSnapshot(
								{ ...entry, date: operation.date, meal: operation.meal },
								local.operationId,
							),
						);
					}
				}
			}
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "update") {
			applyUpdate(entries, operation, local.operationId, local.hint);
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "group") {
			applyGroup(entries, operation, local.operationId);
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "remove") {
			const index = entries.findIndex((entry) =>
				entryMatches(entry, operation.target),
			);
			if (index >= 0) entries.splice(index, 1);
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "removeBatch") {
			for (const target of operation.targets) {
				const index = entries.findIndex((entry) => entryMatches(entry, target));
				if (index >= 0) entries.splice(index, 1);
			}
			pendingOperationIds.push(local.operationId);
		}
		if (operation.kind === "moveBatch") {
			for (const target of operation.targets) {
				applyUpdate(
					entries,
					{
						kind: "update",
						target,
						date: operation.date,
						meal: operation.meal,
					},
					local.operationId,
				);
			}
			pendingOperationIds.push(local.operationId);
		}
	}
	const visible = entries.filter((entry) => entry.date === date);
	return {
		date,
		revision: base?.revision ?? 0,
		complete: base?.complete ?? false,
		entries: visible,
		totals: totalNutrients(visible.map((entry) => entry.nutrients)),
		pendingOperationIds: [...new Set(pendingOperationIds)],
	};
}
