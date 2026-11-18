/**
 * Turns `SessionNow` into the Live Activity's props. Everything the layout
 * shows is formatted here, in the app's locale and palette: the layout runs in
 * the widget extension and can reach neither i18n nor the theme.
 */
import { fmt, type Locale, type Messages, plural } from "../../../i18n";
import { darkColors } from "../../../theme/palette";
import { formatNumber, formatSeconds } from "../session-format";
import type { SessionNow } from "./use-session-now";

export interface LiveActivityProps {
	title: string;
	exercise: string | null;
	/** "Set 3 of 4". */
	setLine: string | null;
	/** "80 kg × 8", "+10 kg × 12", "45 s". */
	loadLine: string | null;
	startedAt: number;
	/** Null when not resting, or once the rest has ended. */
	restEndsAt: number | null;
	/** When this rest was last sent; the countdown's lower bound. */
	restFrom: number;
	labels: { rest: string; restOver: string; next: string };
	colors: { bg: string; accent: string; text: string; muted: string };
}

/**
 * Lime on dark, as on the session screen, in light and dark mode alike:
 * expo-widgets 58.0.28 reads the colour scheme outside a view, so a Live
 * Activity always sees "light" and cannot follow the system appearance.
 */
const COLORS: LiveActivityProps["colors"] = {
	bg: darkColors.bg,
	accent: darkColors.accent,
	text: darkColors.text,
	muted: darkColors.textMuted,
};

export type LiveActivityCopy = Messages["strength"]["plan"]["liveActivity"];

export function loadLineOf(
	now: Pick<SessionNow, "kg" | "reps" | "durationSeconds">,
	copy: LiveActivityCopy,
	locale: Locale,
): string | null {
	const load =
		now.kg !== null && now.kg > 0 ? `${formatNumber(now.kg, locale)} kg` : null;
	if (now.durationSeconds !== null) {
		const hold = formatSeconds(now.durationSeconds, locale);
		return load ? `${load} × ${hold}` : hold;
	}
	if (now.reps === null) return load;
	return load ? `${load} × ${now.reps}` : plural(locale, now.reps, copy.reps);
}

export function liveActivityProps(
	now: SessionNow,
	copy: LiveActivityCopy,
	locale: Locale,
	at = Date.now(),
): LiveActivityProps {
	const resting = now.restEndsAt !== null && now.restEndsAt > at;
	return {
		title: now.sessionName ?? copy.freeSession,
		exercise: now.exerciseName,
		setLine:
			now.setIndex !== null && now.setCount !== null
				? fmt(copy.setOf, { index: now.setIndex, count: now.setCount })
				: null,
		loadLine: now.exerciseName ? loadLineOf(now, copy, locale) : null,
		startedAt: now.startedAt,
		restEndsAt: resting ? now.restEndsAt : null,
		restFrom: at,
		labels: { rest: copy.rest, restOver: copy.restOver, next: copy.next },
		colors: COLORS,
	};
}

/** The props minus the send time, to skip updates that change nothing visible. */
export function contentKey(props: LiveActivityProps) {
	const { restFrom: _sent, ...rest } = props;
	return JSON.stringify(rest);
}
