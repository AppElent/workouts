/**
 * PROTOTYPE — #46, decision 5: cold-launch resume.
 *
 * The web app redirects from `__root.tsx` whenever `workoutSessions.getActive`
 * returns a session. Variants B and C take that literally and use this hook;
 * variant A deliberately does not, and shows a banner instead.
 *
 * Fires at most once per mount. An effect that re-ran on every `active` change
 * would drag you back into the session the moment you navigated away from it —
 * which is a different, and much worse, design than the one being tested.
 */
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useShellData } from "./use-shell-data";

export function useResumeRedirect() {
	const router = useRouter();
	const { active } = useShellData();
	const fired = useRef(false);

	useEffect(() => {
		if (fired.current || active === undefined) return;
		fired.current = true;
		if (active) router.replace("/session");
	}, [active, router]);
}
