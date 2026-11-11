import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { useToast } from "#/components/ui/toast";
import { useConvexErrorMessage } from "#/lib/convexError";

/** Starts a session from a routine and opens it, or explains why it can't. */
export function useStartRoutine() {
	const navigate = useNavigate();
	const toast = useToast();
	const errorMessage = useConvexErrorMessage();
	const startSession = useMutation(api.routines.startSession);
	const [starting, setStarting] = useState(false);

	async function start(routineId: Id<"routines">) {
		if (starting) return;
		setStarting(true);
		try {
			const sessionId = await startSession({ routineId });
			void navigate({ to: "/log/$sessionId", params: { sessionId } });
		} catch (error) {
			toast.error(
				"Couldn't start workout",
				errorMessage(error, "Please try again."),
			);
		} finally {
			setStarting(false);
		}
	}

	return { start, starting };
}
