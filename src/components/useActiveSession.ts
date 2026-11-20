import { api } from "@convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";

/**
 * The signed-in person's running Strength Session for the app chrome. Skipped
 * while signed out: `getActive` requires sign-in, and the shell also wraps
 * public routes such as `/join/$token` and `/exercises`.
 */
export function useActiveSession() {
	const { isAuthenticated } = useConvexAuth();
	return useQuery(api.workoutSessions.getActive, isAuthenticated ? {} : "skip");
}
