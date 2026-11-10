import { useCallback, useMemo } from "react";
import {
	type LoggedEntries,
	type NutritionDiary,
	useNutritionDiary,
} from "../../data/nutrition-diary";
import { useI18n } from "../../i18n";
import { useToast } from "../../ui/toast";
import { useScreenWrite } from "../../ui/use-screen-write";

/** Diary writes run through `useScreenWrite`, plus the undoable "logged" toast. */
export function useDiaryWrite() {
	const diary = useNutritionDiary();
	const toast = useToast();
	const { t } = useI18n();
	const copy = t.nutrition.logFood;
	const screen = useScreenWrite();
	const { run: runScreen } = screen;

	const run = useCallback(
		<T>(
			failure: string,
			write: (diary: NutritionDiary) => Promise<T>,
			key = "",
		) => runScreen(failure, () => write(diary), { key }),
		[diary, runScreen],
	);

	/** A success toast whose action takes back what was just logged. */
	const confirmLogged = useCallback(
		(message: string, logged: LoggedEntries) =>
			toast.success(message, {
				action: {
					label: copy.undo,
					onPress: () => {
						logged.undo().catch(() => toast.error(copy.undoFailure));
					},
				},
			}),
		[copy.undo, copy.undoFailure, toast],
	);

	return useMemo(
		() => ({
			diary,
			run,
			confirmLogged,
			busy: screen.busy,
			isPending: screen.isPending,
		}),
		[confirmLogged, diary, run, screen.busy, screen.isPending],
	);
}
