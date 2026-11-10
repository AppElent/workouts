/**
 * "Show this day when you are back on the diary."
 *
 * Screens over the diary can log into another day. A mounted diary follows
 * the request at once — it is underneath, not unmounted — so the back
 * gesture, the back button and a programmatic close all find the same day.
 * A diary that is not mounted yet starts on the day it was asked to show.
 */
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

type Request = { readonly date: string };

let pending: Request | undefined;
const listeners = new Set<() => void>();

export function requestDiaryDate(date: string) {
	pending = { date };
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Calls `onRequest` with each requested day; a request is applied once. */
export function useDiaryDateRequest(onRequest: (date: string) => void) {
	const request = useSyncExternalStore(subscribe, () => pending);
	const handler = useRef(onRequest);
	handler.current = onRequest;
	useLayoutEffect(() => {
		if (!request) return;
		if (pending === request) pending = undefined;
		handler.current(request.date);
	}, [request]);
}
