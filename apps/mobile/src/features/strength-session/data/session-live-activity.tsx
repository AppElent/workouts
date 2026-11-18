/**
 * Mirrors the active strength session onto the Live Activity: starts it when a
 * session is active (also after a restart), updates it when the next set or
 * the rest changes, and ends it when the session finishes or is discarded.
 */
import { useEffect } from "react";
import { useActiveSession } from "../../../data/session-data";
import { useI18n } from "../../../i18n";
import { endSessionActivity, showSessionActivity } from "./live-activity";
import { liveActivityProps } from "./live-activity-props";
import { useRestState } from "./rest-timer";
import { useSessionNow } from "./use-session-now";

export function SessionLiveActivity() {
	const active = useActiveSession();
	const now = useSessionNow();
	const { over } = useRestState();
	const { t, locale } = useI18n();
	const loading = active === undefined;
	const copy = t.strength.plan.liveActivity;
	useEffect(() => {
		// Keep whatever runs while the session is still loading (or offline).
		if (loading) return;
		if (!now) endSessionActivity();
		else {
			// A finished rest clears the countdown; until then the system timer runs it.
			const shown = over ? { ...now, restEndsAt: null } : now;
			showSessionActivity(liveActivityProps(shown, copy, locale));
		}
	}, [loading, now, over, copy, locale]);
	return null;
}
