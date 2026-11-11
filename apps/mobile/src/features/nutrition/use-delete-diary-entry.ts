/**
 * Deleting one diary entry, wherever the user asked for it.
 *
 * There are three routes to this in the app — the entry editor's visible
 * Delete, the diary row's revealed swipe action, and the same row's long-press
 * menu — and all of them must raise the same verb-specific confirmation
 * before anything is removed. Three copies of that sentence would
 * be three chances for one of them to drift into deleting silently, so there
 * is one copy and it lives here.
 *
 * The confirmation is what makes the swipe safe rather than the swipe being
 * restrained enough to be safe on its own — `ui/swipeable-row.tsx` does both.
 */

import type { MealSlot } from "@foundry/core";
import { useCallback } from "react";
import type { DiaryEntry } from "../../data/nutrition-day";
import { useNutritionDiary } from "../../data/nutrition-diary";
import { formatLongDate } from "../../dates/calendar-day";
import { fmt, useI18n } from "../../i18n";
import { useConfirm } from "../../ui/confirm-dialog";
import { useScreenWrite } from "../../ui/use-screen-write";

interface DeleteDiaryEntryRequest {
	entry: DiaryEntry;
	meal: MealSlot;
	date: string;
}

/** Resolves `true` only when an entry was actually removed. */
type DeleteDiaryEntry = (request: DeleteDiaryEntryRequest) => Promise<boolean>;

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
	const confirm = useConfirm();
	const diary = useNutritionDiary();
	const screenWrite = useScreenWrite();
	const { run } = screenWrite;

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
			const removed = await run(
				t.nutrition.entryEditor.deleteFailure,
				async () => {
					await diary.remove({ kind: "serverId", id: entry.id });
					return true;
				},
			);
			return removed ?? false;
		},
		[confirm, diary, locale, run, t],
	);

	return { deleteEntry, deleting: screenWrite.busy };
}
