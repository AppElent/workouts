/**
 * "Show this day when you are back on screen."
 *
 * The log food screen is pushed over the diary and can change the day it logs
 * into. Without this, going back lands on the diary's old day while the new
 * entries sit somewhere else. The request is applied as soon as it is made —
 * the diary is underneath, not unmounted — so the back gesture, the back
 * button and a programmatic close all find the same day.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

type Request = { readonly date: string; readonly id: number };

let current: Request | undefined;
const listeners = new Set<() => void>();

export function requestDiaryDate(date: string) {
	current = { date, id: (current?.id ?? 0) + 1 };
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Calls `onRequest` for each date requested while the diary is mounted. */
export function useDiaryDateRequest(onRequest: (date: string) => void) {
	const request = useSyncExternalStore(subscribe, () => current);
	// Requests made before this diary mounted belong to an earlier one.
	const seen = useRef(request?.id);
	const handler = useRef(onRequest);
	handler.current = onRequest;
	useEffect(() => {
		if (!request || request.id === seen.current) return;
		seen.current = request.id;
		handler.current(request.date);
	}, [request]);
}
