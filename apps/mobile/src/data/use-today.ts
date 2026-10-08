/**
 * Today's date that keeps up with the clock.
 *
 * A screen that reads `todayIsoDate()` once on mount keeps showing yesterday
 * after midnight, and a backgrounded app can sleep through several midnights.
 * So today is re-read at the next local midnight and whenever the app becomes
 * active again.
 */
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { type IsoDate, todayIsoDate } from "./calendar-day";

function msUntilNextMidnight(now: Date): number {
	const next = new Date(now);
	next.setHours(24, 0, 0, 0);
	return next.getTime() - now.getTime();
}

export function useToday(): IsoDate {
	const [today, setToday] = useState(todayIsoDate);

	// biome-ignore lint/correctness/useExhaustiveDependencies: each new day schedules the next midnight.
	useEffect(() => {
		const refresh = () => setToday(todayIsoDate());
		refresh();
		// A small margin so the timer never lands just before the boundary.
		const timer = setTimeout(refresh, msUntilNextMidnight(new Date()) + 1000);
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") refresh();
		});
		return () => {
			clearTimeout(timer);
			subscription.remove();
		};
	}, [today]);

	return today;
}
