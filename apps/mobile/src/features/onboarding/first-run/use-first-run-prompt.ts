import { useAuth } from "@clerk/expo";
import { useQuery_experimental } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { api } from "../../../convex/api";
import { markFirstRunOffered, wasFirstRunOffered } from "./first-run-offered";

/**
 * Opens the First Run once for an empty account: no Nutrition Goals and no
 * history, as `account.firstRun` decides on the server. Accounts with goals or
 * history never see it, and neither does an account this device already
 * offered it to.
 *
 * The prompt is optional, so it reads through the non-throwing
 * `useQuery_experimental` (as `src/data/training-marker.ts` does): a slow,
 * failed, or offline lookup, or a backend without the query yet, leaves it
 * absent instead of erroring the tab shell that hosts it.
 */
export function useFirstRunPrompt() {
	const { userId } = useAuth();
	const router = useRouter();
	const status = useQuery_experimental({
		query: api.account.firstRun,
		args: {},
	});
	const empty = status.status === "success" && status.data?.empty === true;
	const opened = useRef(false);

	useEffect(() => {
		if (opened.current || !userId || !empty) return;
		opened.current = true;
		if (wasFirstRunOffered(userId)) return;
		markFirstRunOffered(userId);
		router.push("/first-run");
	}, [empty, router, userId]);
}
