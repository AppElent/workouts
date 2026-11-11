import type {
	ComboGroup,
	MealSlot,
	NutritionDiaryOperation,
	NutritionDiaryPartSnapshot,
	NutritionDiarySnapshot,
	NutritionOperationTarget,
} from "@foundry/core";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useMemo } from "react";
import { api } from "../convex/api";
import {
	accountSlot,
	mintUuid,
	useAccountSlot,
	useAccountWrite,
} from "./account-write";
import {
	prepareDiaryPhotoOperation,
	useFoodPhotoUpload,
} from "./nutrition-food-photo-upload";
import {
	comboPortion,
	comboSourceKey,
	type FoodUse,
	useRecordFoodUse,
} from "./nutrition-shortcuts";

type DiaryTarget = NutritionOperationTarget;

type DiaryEntryPatch = Omit<
	Extract<NutritionDiaryOperation, { kind: "update" }>,
	"kind" | "target"
>;

export type LoggedEntries = {
	readonly clientEntryIds: readonly string[];
	/** Removes what was logged, in one operation. */
	undo(): Promise<void>;
};

type ComboReference = { readonly id: string; readonly name: string };

type AcknowledgedWrite = {
	readonly operation: NutritionDiaryOperation;
	readonly at: number;
};

const JOURNAL = accountSlot((): AcknowledgedWrite[] => []);
const JOURNAL_LIMIT = 100;

export type NutritionDiary = {
	log(entry: NutritionDiarySnapshot, use?: FoodUse): Promise<LoggedEntries>;
	/** With a combo, the entries are one Logged Combo of it. */
	logBatch(
		date: string,
		meal: MealSlot,
		entries: readonly NutritionDiaryPartSnapshot[],
		combo?: ComboReference,
	): Promise<LoggedEntries>;
	/** Logs one Combo as a Logged Combo and remembers its count for the next +. */
	logCombo(
		combo: ComboReference,
		date: string,
		meal: MealSlot,
		parts: readonly NutritionDiaryPartSnapshot[],
		quantity: number,
	): Promise<LoggedEntries>;
	update(target: DiaryTarget, patch: DiaryEntryPatch): Promise<void>;
	remove(target: DiaryTarget): Promise<void>;
	/** Removes whole selections: a Logged Combo must be selected as a whole. */
	removeBatch(targets: readonly DiaryTarget[]): Promise<void>;
	move(
		targets: readonly DiaryTarget[],
		date: string,
		meal: MealSlot,
	): Promise<void>;
	group(targets: readonly DiaryTarget[], combo: ComboReference): Promise<void>;
	/** Logs `entries` and removes `replaced` in one write. */
	replace(
		replaced: readonly DiaryTarget[],
		date: string,
		meal: MealSlot,
		entries: readonly NutritionDiaryPartSnapshot[],
		combo?: ComboReference,
	): Promise<LoggedEntries>;
	/** Whether this session logged anything to that day and meal at or after `since`. */
	loggedSince(date: string, meal: MealSlot, since: number): boolean;
};

type ServerOperation = FunctionArgs<
	typeof api.nutritionDiary.applyOperation
>["operation"];

/** Core carries server ids as strings; Convex validates them as table ids. */
function toServerOperation(operation: NutritionDiaryOperation) {
	return operation as ServerOperation;
}

const byClientEntryId = (id: string): DiaryTarget => ({
	kind: "clientEntryId",
	id,
});

function createdEntries(operation: NutritionDiaryOperation) {
	if (operation.kind === "create")
		return {
			date: operation.entry.date,
			meal: operation.entry.meal,
			ids: [operation.entry.clientEntryId],
		};
	if (operation.kind === "createBatch")
		return {
			date: operation.date,
			meal: operation.meal,
			ids: operation.entries.map((entry) => entry.clientEntryId),
		};
	return undefined;
}

export function useNutritionDiary(): NutritionDiary {
	const account = useAccountWrite();
	const journal = useAccountSlot(JOURNAL);
	const applyOperation = useMutation(api.nutritionDiary.applyOperation);
	const upload = useFoodPhotoUpload();
	const recordUse = useRecordFoodUse();
	return useMemo(() => {
		/**
		 * `input` is the operation without the ids it mints: a retry of the same
		 * input sends the operation of its first try.
		 */
		async function send(
			input: unknown,
			operation: () => NutritionDiaryOperation,
			use?: FoodUse,
		): Promise<NutritionDiaryOperation> {
			const sent = await account.send({
				identity: input,
				prepare: () => prepareDiaryPhotoOperation(operation(), upload),
				deliver: async (prepared, { subject, operationId }) => {
					await applyOperation({
						operationId,
						expectedSubject: subject,
						operation: toServerOperation(prepared),
					});
					return prepared;
				},
			});
			journal.push({ operation: sent, at: Date.now() });
			if (journal.length > JOURNAL_LIMIT) journal.shift();
			const created = createdEntries(sent);
			if (use && created && account.subject)
				recordUse(account.subject, use, created.meal);
			return sent;
		}
		async function removeBatch(targets: readonly DiaryTarget[]) {
			await send({ kind: "removeBatch", targets }, () => ({
				kind: "removeBatch",
				targets,
			}));
		}
		function logged(operation: NutritionDiaryOperation): LoggedEntries {
			const clientEntryIds = createdEntries(operation)?.ids ?? [];
			return {
				clientEntryIds,
				undo: () => removeBatch(clientEntryIds.map(byClientEntryId)),
			};
		}
		async function logBatch(
			date: string,
			meal: MealSlot,
			entries: readonly NutritionDiaryPartSnapshot[],
			combo?: ComboReference,
			use?: FoodUse,
			replaces?: readonly DiaryTarget[],
		) {
			const comboGroup: Omit<ComboGroup, "id"> | undefined = combo && {
				comboId: combo.id,
				name: combo.name,
			};
			const parts = entries.map(
				({
					clientEntryId: _id,
					comboGroup: _group,
					date: _date,
					meal: _meal,
					...part
				}: NutritionDiaryPartSnapshot & {
					clientEntryId?: string;
					date?: string;
					meal?: MealSlot;
				}) => part,
			);
			return logged(
				await send(
					{ kind: "createBatch", date, meal, parts, comboGroup, replaces },
					() => {
						const group = comboGroup && { id: mintUuid(), ...comboGroup };
						return {
							kind: "createBatch",
							date,
							meal,
							entries: parts.map((part) => ({
								...part,
								...(group ? { comboGroup: group } : {}),
								clientEntryId: mintUuid(),
							})),
							...(replaces ? { replaces } : {}),
						};
					},
					use,
				),
			);
		}
		return {
			async log(entry, use) {
				const { clientEntryId: _id, ...snapshot } = entry;
				return logged(
					await send(
						{ kind: "create", snapshot },
						() => ({
							kind: "create",
							entry: { ...snapshot, clientEntryId: mintUuid() },
						}),
						use,
					),
				);
			},
			logBatch: (date, meal, entries, combo) =>
				logBatch(date, meal, entries, combo),
			logCombo: (combo, date, meal, parts, quantity) =>
				logBatch(date, meal, parts, combo, {
					sourceKey: comboSourceKey(combo.id),
					portion: comboPortion(quantity),
				}),
			async update(target, patch) {
				await send({ kind: "update", target, ...patch }, () => ({
					kind: "update",
					target,
					...patch,
				}));
			},
			async remove(target) {
				await send({ kind: "remove", target }, () => ({
					kind: "remove",
					target,
				}));
			},
			removeBatch,
			async move(targets, date, meal) {
				await send({ kind: "moveBatch", targets, date, meal }, () => ({
					kind: "moveBatch",
					targets,
					date,
					meal,
				}));
			},
			async group(targets, combo) {
				const comboGroup = { comboId: combo.id, name: combo.name };
				await send({ kind: "group", targets, comboGroup }, () => ({
					kind: "group",
					targets,
					comboGroup: { id: mintUuid(), ...comboGroup },
				}));
			},
			replace: (replaced, date, meal, entries, combo) =>
				logBatch(date, meal, entries, combo, undefined, replaced),
			loggedSince: (date, meal, since) =>
				journal.some((write) => {
					if (write.at < since) return false;
					const created = createdEntries(write.operation);
					return created?.date === date && created.meal === meal;
				}),
		};
	}, [account, journal, applyOperation, upload, recordUse]);
}
