/**
 * Mirrors the active strength session onto the Live Activity: starts it when a
 * session is active (also after a restart), updates it when the next set or
 * the rest changes, and ends it when the session finishes or is discarded.
 */
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useActiveSession } from "../../../data/session-data";
import { useI18n } from "../../../i18n";
import { endSessionActivity, showSessionActivity } from "./live-activity";
import { liveActivityProps } from "./live-activity-props";
import { useRestState } from "./rest-timer";
import { useSessionNow } from "./use-session-now";

/**
 * A Live Activity can outlive the app. Once Clerk has loaded with nobody
 * signed in (also on a relaunch after sign-out, where the session provider
 * never mounts), none may keep showing the last user's workout.
 */
export function useEndActivityWhenSignedOut(
	isLoaded: boolean,
	userId: string | null | undefined,
) {
	useEffect(() => {
		if (isLoaded && !userId) endSessionActivity();
	}, [isLoaded, userId]);
}

export function SessionLiveActivity() {
	const active = useActiveSession();
	const now = useSessionNow();
	const { over } = useRestState();
	const { t, locale } = useI18n();
	const loading = active === undefined;
	const copy = useMemo(
		() => ({
			...t.strength.plan.liveActivity,
			freeSession: t.strength.freeSession,
		}),
		[t],
	);
	// iOS starts an activity only from the foreground: try again on coming back.
	const [foregrounds, setForegrounds] = useState(0);
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") setForegrounds((count) => count + 1);
		});
		return () => sub.remove();
	}, []);
	useEffect(() => {
		void foregrounds; // a retry trigger only
		// Keep whatever runs while the session is still loading (or offline).
		if (loading) return;
		if (!now) endSessionActivity();
		else showSessionActivity(liveActivityProps(now, copy, locale, over));
	}, [loading, now, over, copy, locale, foregrounds]);
	// Unmounts only when the account changes: a signed-out phone shows no session.
	useEffect(() => endSessionActivity, []);
	return null;
}
