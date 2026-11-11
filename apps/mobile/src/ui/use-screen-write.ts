import { type AppErrorMessages, convexErrorMessage } from "@foundry/core";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { useToast } from "./toast";

/**
 * What a failed write shows: the catalog's or server's explanation of a Convex
 * error, else the screen's own message. Local errors carry English text.
 */
export function writeFailureMessage(
	error: unknown,
	messages: AppErrorMessages,
	fallback: string,
) {
	return error instanceof ConvexError
		? convexErrorMessage(error, messages, fallback)
		: fallback;
}

export function useWriteFailureMessage() {
	const { errors } = useI18n().t;
	return useCallback(
		(error: unknown, fallback: string) =>
			writeFailureMessage(error, errors, fallback),
		[errors],
	);
}

type WriteOptions = {
	/** Writes with a shared key wait their turn; the default key is `""`. */
	readonly key?: string | readonly string[];
	/** Offered on the failure toast, e.g. to try again. */
	readonly failureAction?: {
		readonly label: string;
		readonly onPress: () => void;
	};
};

/**
 * Writes as a screen runs them: one write per key at a time, its keys pending
 * meanwhile, and a toast explaining a failure.
 */
export function useScreenWrite() {
	const toast = useToast();
	const failureMessage = useWriteFailureMessage();
	const running = useRef(new Set<string>());
	const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	/**
	 * Resolves with the write's result, or `undefined` when it failed, one of
	 * its keys was already writing, or the screen has gone.
	 */
	const run = useCallback(
		async <T>(
			failure: string,
			write: () => Promise<T>,
			{ key = "", failureAction }: WriteOptions = {},
		): Promise<T | undefined> => {
			const list = typeof key === "string" ? [key] : key;
			if (list.some((entry) => running.current.has(entry))) return undefined;
			for (const entry of list) running.current.add(entry);
			setPending((current) => new Set([...current, ...list]));
			try {
				const result = await write();
				return mounted.current ? result : undefined;
			} catch (error) {
				toast.error(
					failureMessage(error, failure),
					failureAction ? { action: failureAction } : undefined,
				);
				return undefined;
			} finally {
				for (const entry of list) running.current.delete(entry);
				if (mounted.current)
					setPending((current) => {
						const next = new Set(current);
						for (const entry of list) next.delete(entry);
						return next;
					});
			}
		},
		[toast, failureMessage],
	);

	return useMemo(
		() => ({
			run,
			busy: pending.size > 0,
			isPending: (key = "") => pending.has(key),
		}),
		[pending, run],
	);
}
