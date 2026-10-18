/** Fake server diary rules for screen fixtures; Convex APIs own behavioral tests. */
import {
	correctDiaryNutrients,
	type NutritionDiaryOperation,
	type NutritionDiarySnapshot,
	type NutritionOperationTarget,
	rescaleToQuantity,
	rescaleToSelection,
	totalNutrients,
} from "@foundry/core";
import type {
	NutritionCachedDay,
	NutritionServerEntry,
} from "../data/nutrition-local-repository";

function entryForSnapshot(
	snapshot: NutritionDiarySnapshot,
): NutritionServerEntry {
	return { _id: `server:${snapshot.clientEntryId ?? "local"}`, ...snapshot };
}

function entryMatches(
	entry: NutritionServerEntry,
	target: NutritionOperationTarget,
) {
	return target.kind === "serverId"
		? entry._id === target.id
		: entry.clientEntryId === target.id;
}

function applyUpdate(
	entries: NutritionServerEntry[],
	operation: Extract<NutritionDiaryOperation, { kind: "update" }>,
) {
	const entry = entries.find((candidate) =>
		entryMatches(candidate, operation.target),
	);
	if (!entry) return;
	if (
		operation.correction &&
		(operation.quantity !== undefined || operation.selection)
	) {
		throw new Error("A nutrient correction cannot change the amount");
	}
	const moved =
		(operation.date !== undefined && operation.date !== entry.date) ||
		(operation.meal !== undefined && operation.meal !== entry.meal);
	const rescaled = operation.selection
		? {
				...rescaleToSelection(entry, operation.selection),
				personalMeasureId: operation.selection.personalMeasureId ?? undefined,
			}
		: operation.quantity
			? rescaleToQuantity(entry, operation.quantity)
			: entry;
	const next = {
		...rescaled,
		...(operation.date ? { date: operation.date } : {}),
		...(operation.meal ? { meal: operation.meal } : {}),
	};
	if (operation.correction)
		Object.assign(next, correctDiaryNutrients(next, operation.correction));
	if (moved) {
		delete next.comboGroup;
	}
	entries[entries.indexOf(entry)] = next;
}

/** One acknowledged operation applied to a day the fixture server holds. */
export function applyFixtureOperation(
	base: NutritionCachedDay | undefined,
	date: string,
	operation: NutritionDiaryOperation,
) {
	const entries = (base?.entries ?? []).map((entry) => ({ ...entry }));
	const add = (snapshot: NutritionDiarySnapshot) => {
		if (
			!entries.some((entry) => entry.clientEntryId === snapshot.clientEntryId)
		)
			entries.push(entryForSnapshot(snapshot));
	};
	const removeTarget = (target: NutritionOperationTarget) => {
		const index = entries.findIndex((entry) => entryMatches(entry, target));
		if (index >= 0) entries.splice(index, 1);
	};
	switch (operation.kind) {
		case "create":
			if (operation.entry.date === date) add(operation.entry);
			break;
		case "createBatch":
			if (operation.date === date)
				for (const entry of operation.entries)
					add({ ...entry, date: operation.date, meal: operation.meal });
			break;
		case "update":
			applyUpdate(entries, operation);
			break;
		case "group":
			for (const target of operation.targets) {
				const index = entries.findIndex((entry) => entryMatches(entry, target));
				if (index >= 0)
					entries[index] = {
						...entries[index],
						comboGroup: operation.comboGroup,
					};
			}
			break;
		case "remove":
			removeTarget(operation.target);
			break;
		case "removeBatch":
			for (const target of operation.targets) removeTarget(target);
			break;
		case "moveBatch":
			for (const target of operation.targets)
				applyUpdate(entries, {
					kind: "update",
					target,
					date: operation.date,
					meal: operation.meal,
				});
			break;
	}
	const visible = entries.filter((entry) => entry.date === date);
	return {
		entries: visible,
		totals: totalNutrients(visible.map((entry) => entry.nutrients)),
	};
}
