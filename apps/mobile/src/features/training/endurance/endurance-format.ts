import {
	formatPace,
	paceSecondsPerKilometer,
	speedKilometersPerHour,
} from "@foundry/core";

/** Pace for a run, km/h with one decimal for a ride, "—" when it has no rate. */
export function formatEnduranceRate(
	sport: string,
	meters: number,
	seconds: number,
	locale: string,
): string {
	if (sport === "running")
		return formatPace(paceSecondsPerKilometer(meters, seconds)) ?? "—";
	const speed = speedKilometersPerHour(meters, seconds);
	return speed === null || !Number.isFinite(speed)
		? "—"
		: `${speed.toLocaleString(locale, { maximumFractionDigits: 1 })} km/h`;
}

/** A distance in kilometres to two decimals, without the unit. */
export function formatKilometers(meters: number, locale: string): string {
	return (meters / 1000).toLocaleString(locale, { maximumFractionDigits: 2 });
}
