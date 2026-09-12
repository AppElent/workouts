/**
 * Deleting one diary entry, wherever the user asked for it.
 *
 * There are three routes to this in the app — the entry editor's visible
 * Delete, the diary row's revealed swipe action, and the same row's long-press
 * menu — and spec #68 requires all of them to raise the same verb-specific
 * confirmation before anything is removed. Three copies of that sentence would
 * be three chances for one of them to drift into deleting silently, so there
 * is one copy and it lives here.
 *
 * The confirmation is what makes the swipe safe rather than the swipe being
 * restrained enough to be safe on its own — `ui/swipeable-row.tsx` does both.
 */
import { useCallback, useState } from "react";
import { fmt, useI18n } from "../i18n";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { useToast } from "../ui/toast";
import { formatLongDate } from "./calendar-day";
import type { DiaryEntry, MealSlot } from "./nutrition-day";
import { useNutritionOperations } from "./nutrition-operation-service";

export interface DeleteDiaryEntryRequest {
	entry: DiaryEntry;
	meal: MealSlot;
	date: string;
}

/** Resolves `true` only when an entry was actually removed. */
export type DeleteDiaryEntry = (
	request: DeleteDiaryEntryRequest,
) => Promise<boolean>;

export interface DeleteDiaryEntryApi {
	deleteEntry: DeleteDiaryEntry;
	/**
	 * True only while the write is in flight — deliberately not while the
	 * confirmation is open. A Delete button that reads "Deleting…" behind a
	 * dialog still asking permission has told the user the wrong thing.
	 */
	deleting: boolean;
}

export function useDeleteDiaryEntry(): DeleteDiaryEntryApi {
	const { t, locale } = useI18n();
	const toast = useToast();
	const confirm = useConfirm();
	const operations = useNutritionOperations();
	const [deleting, setDeleting] = useState(false);

	const deleteEntry = useCallback(
		async ({ entry, meal, date }: DeleteDiaryEntryRequest) => {
			const confirmed = await confirm({
				title: t.nutrition.entryEditor.deleteConfirmTitle,
				// Names the entry, the slot and the day, because the row that was
				// swiped may already have scrolled out from under the dialog.
				message: fmt(t.nutrition.entryEditor.deleteConfirmMessage, {
					name: entry.name[locale],
					meal: t.nutrition.meals[meal],
					date: formatLongDate(date, locale),
				}),
				confirmLabel: t.nutrition.entryEditor.delete,
				cancelLabel: t.nutrition.entryEditor.keepEntry,
				destructive: true,
			});
			if (!confirmed) return false;
			setDeleting(true);
			try {
				const subject = operations.getSubject();
				if (!subject) throw new Error("Not signed in.");
				const removed = await new Promise<boolean>((resolve) =>
					operations.remove(
						subject,
						{ kind: "serverId", id: entry.id },
						{
							targetEntry: {
								_id: entry.id,
								date,
								meal,
								name: entry.name,
								serving: entry.serving,
								quantity: entry.quantity,
								amount: entry.amount,
								baseUnit: entry.baseUnit,
								nutrients: entry.nutrients,
								provenance: entry.provenance,
								...(entry.comboGroup ? { comboGroup: entry.comboGroup } : {}),
							},
						},
						(error) => {
							setDeleting(false);
							toast.error(
								convexErrorMessage(
									error,
									t.nutrition.entryEditor.deleteFailure,
								),
							);
							resolve(false);
						},
						() => {
							setDeleting(false);
							resolve(true);
						},
					),
				);
				return removed;
			} catch (error) {
				toast.error(
					convexErrorMessage(error, t.nutrition.entryEditor.deleteFailure),
				);
				return false;
			} finally {
				setDeleting(false);
			}
		},
		[confirm, locale, operations, t, toast],
	);

	return { deleteEntry, deleting };
}
