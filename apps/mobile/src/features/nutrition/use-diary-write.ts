import { ConvexError } from "convex/values";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type LoggedEntries,
	type NutritionDiary,
	useNutritionDiary,
} from "../../data/nutrition-diary";
import { useI18n } from "../../i18n";
import { useConvexErrorMessage } from "../../i18n/errors";
import { useToast } from "../../ui/toast";

/** What a failed save shows: the server's explanation, else the screen's own. */
export function useWriteFailureMessage() {
	const errorMessage = useConvexErrorMessage();
	return useCallback(
		(error: unknown, fallback: string) =>
			error instanceof ConvexError ? errorMessage(error, fallback) : fallback,
		[errorMessage],
	);
}

/**
 * Diary writes as a screen runs them: one write per key at a time, its key
 * pending meanwhile, a toast when it fails, and nothing touched after the
 * screen is gone.
 */
export function useDiaryWrite() {
	const diary = useNutritionDiary();
	const toast = useToast();
	const { t } = useI18n();
	const writeFailureMessage = useWriteFailureMessage();
	const copy = t.nutrition.logFood;
	const running = useRef(new Set<string>());
	const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const settle = useCallback((key: string) => {
		running.current.delete(key);
		if (!mounted.current) return;
		setPending((keys) => {
			const next = new Set(keys);
			next.delete(key);
			return next;
		});
	}, []);

	/** Resolves with the write's result, or `undefined` when it failed or was already running. */
	const run = useCallback(
		async <T>(
			failure: string,
			write: (diary: NutritionDiary) => Promise<T>,
			key = "",
		): Promise<T | undefined> => {
			if (running.current.has(key)) return undefined;
			running.current.add(key);
			setPending((keys) => new Set(keys).add(key));
			try {
				const result = await write(diary);
				return mounted.current ? result : undefined;
			} catch (error) {
				if (mounted.current) toast.error(writeFailureMessage(error, failure));
				return undefined;
			} finally {
				settle(key);
			}
		},
		[diary, settle, toast, writeFailureMessage],
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
			busy: pending.size > 0,
			isPending: (key = "") => pending.has(key),
		}),
		[confirmLogged, diary, pending, run],
	);
}
