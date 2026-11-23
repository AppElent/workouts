/**
 * What an exercise's history says at a glance (APP-255): the 1RM trend, the
 * best set, recent volume, and every session with what each set was worth.
 * Pure, so the overview screen stays a layout.
 */
import { calculateOneRepMax, convertLoad, type LoadUnit } from "@foundry/core";

const DAY = 24 * 60 * 60 * 1000;
const VOLUME_DAYS = 28;
const TREND_WEEKS = 12;

type HistorySet = {
	_id: string;
	sessionId: string;
	sessionDate: number;
	sessionName?: string | null;
	setNumber: number;
	weight: number;
	unit: LoadUnit;
	reps: number;
	rpe?: number;
	setType: string;
};
type OneRepMax = { value: number; unit: LoadUnit; date: number };

export const dayOf = (time: number) => {
	const date = new Date(time);
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	).getTime();
};

/** One point per day, the highest; several records on a day would draw a spike. */
export function dailyBest(records: readonly OneRepMax[]) {
	const byDay = new Map<number, number>();
	for (const record of records) {
		const day = dayOf(record.date);
		const kg = convertLoad(record.value, record.unit, "kg");
		byDay.set(day, Math.max(byDay.get(day) ?? 0, kg));
	}
	return [...byDay.entries()]
		.sort(([a], [b]) => a - b)
		.map(([date, kg]) => ({ date, kg }));
}

export function exerciseInsight(
	history: readonly HistorySet[],
	records: readonly OneRepMax[],
	now: number,
	/** A hold counts seconds, so there is no load per rep to add up. */
	timed = false,
) {
	const working = history.filter((set) => set.setType !== "warmup");
	const kgOf = (set: HistorySet) => convertLoad(set.weight, set.unit, "kg");

	let best: { kg: number; reps: number; date: number } | null = null;
	for (const set of working) {
		const kg = kgOf(set);
		if (!best || kg > best.kg || (kg === best.kg && set.reps > best.reps))
			best = { kg, reps: set.reps, date: set.sessionDate };
	}

	const volumeBetween = (from: number, to: number) =>
		timed
			? 0
			: working
					.filter((set) => set.sessionDate >= from && set.sessionDate < to)
					.reduce((sum, set) => sum + Math.max(0, kgOf(set)) * set.reps, 0);
	const volume = volumeBetween(now - VOLUME_DAYS * DAY, now + DAY);
	const volumeBefore = volumeBetween(
		now - 2 * VOLUME_DAYS * DAY,
		now - VOLUME_DAYS * DAY,
	);

	const sessionIds = new Set(history.map((set) => set.sessionId));
	const firstDate = history.reduce<number | null>(
		(first, set) =>
			first === null ? set.sessionDate : Math.min(first, set.sessionDate),
		null,
	);

	const points = dailyBest(records);
	const recent = points.filter(
		(point) => point.date >= now - TREND_WEEKS * 7 * DAY,
	);
	const trend =
		recent.length >= 2
			? {
					kg:
						Math.round(((recent.at(-1)?.kg ?? 0) - (recent[0]?.kg ?? 0)) * 10) /
						10,
					weeks: Math.max(
						1,
						Math.round(
							((recent.at(-1)?.date ?? now) - (recent[0]?.date ?? now)) /
								(7 * DAY),
						),
					),
				}
			: null;

	const bestEstimate = timed
		? null
		: working.reduce<number | null>((top, set) => {
				const kg = kgOf(set);
				if (kg <= 0) return top;
				const value = calculateOneRepMax(kg, set.reps).value;
				return top === null ? value : Math.max(top, value);
			}, null);

	const groups = new Map<string, HistorySet[]>();
	for (const set of history)
		groups.set(set.sessionId, [...(groups.get(set.sessionId) ?? []), set]);
	const sessions = [...groups.values()]
		.map((sets) => {
			const ordered = [...sets].sort((a, b) => a.setNumber - b.setNumber);
			const rows = ordered.map((set) => {
				const kg = kgOf(set);
				const estimate =
					timed || kg <= 0 || set.setType === "warmup"
						? null
						: calculateOneRepMax(kg, set.reps).value;
				return {
					id: set._id,
					weight: set.weight,
					unit: set.unit,
					reps: set.reps,
					rpe: set.rpe ?? null,
					setType: set.setType,
					estimate,
					record:
						estimate !== null &&
						bestEstimate !== null &&
						Math.round(estimate) >= Math.round(bestEstimate),
				};
			});
			const top = rows.reduce<number | null>(
				(max, row) =>
					row.estimate === null
						? max
						: max === null
							? row.estimate
							: Math.max(max, row.estimate),
				null,
			);
			const first = ordered[0] as HistorySet;
			return {
				sessionId: first.sessionId,
				date: first.sessionDate,
				name: first.sessionName ?? null,
				rows,
				best: top,
			};
		})
		.sort((a, b) => b.date - a.date);

	return {
		best,
		volume: Math.round(volume),
		volumeChange:
			volumeBefore > 0
				? Math.round(((volume - volumeBefore) / volumeBefore) * 100)
				: null,
		sessionCount: sessionIds.size,
		firstDate,
		points,
		trend,
		sessions,
	};
}
