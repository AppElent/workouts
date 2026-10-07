import {
	type IsoDate,
	isoDateToLocalDate,
	shiftIsoDate,
} from "../../../data/calendar-day";
import { fmt } from "../../../i18n";
import type { goalEditorEn } from "../../../i18n/messages/goal-editor";

/** The saved goal version in force on the chosen date, as `forDate` reports it. */
export type GoalVersionSummary = {
	/** How many goals that version has; zero means none apply. */
	goals: number;
	effectiveFrom: IsoDate | null;
	nextEffectiveFrom: IsoDate | null;
};

export function formatGoalDay(iso: IsoDate, locale: string): string {
	try {
		return isoDateToLocalDate(iso).toLocaleDateString(locale, {
			day: "numeric",
			month: "short",
		});
	} catch {
		return iso;
	}
}

/**
 * The footer under "Applies from": which days a save will touch and what the
 * days around them keep. `lead` is the sentence worth emphasising, if any.
 */
export function goalsAppliesFrom({
	date,
	today,
	requestedDate,
	version,
	locale,
	copy,
}: {
	date: IsoDate;
	today: IsoDate;
	/** The diary day the editor was opened from, if any. */
	requestedDate: IsoDate | undefined;
	version: GoalVersionSummary;
	locale: string;
	copy: typeof goalEditorEn;
}): { lead?: string; body: string } {
	const day = (iso: IsoDate) => formatGoalDay(iso, locale);
	if (date > today) return { body: fmt(copy.future, { date: day(date) }) };
	if (date === today) {
		if (version.effectiveFrom === today)
			return { body: fmt(copy.replacesFrom, { date: day(today) }) };
		if (version.effectiveFrom)
			return {
				body: fmt(copy.currentSince, { date: day(version.effectiveFrom) }),
			};
		return { body: copy.firstGoals };
	}
	const next = version.nextEffectiveFrom;
	const through =
		next && next <= today ? day(shiftIsoDate(next, -1)) : copy.throughToday;
	const before =
		version.effectiveFrom === date
			? fmt(copy.replacesFrom, { date: day(date) })
			: version.effectiveFrom
				? fmt(copy.earlierKeep, { date: day(version.effectiveFrom) })
				: version.goals > 0
					? undefined
					: copy.earlierNone;
	const opened =
		requestedDate === date ? fmt(copy.openedFrom, { date: day(date) }) : "";
	return {
		lead: fmt(copy.alsoThrough, { from: day(date), through }),
		body: [before, opened].filter(Boolean).join(" "),
	};
}
