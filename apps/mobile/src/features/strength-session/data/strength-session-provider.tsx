/**
 * Owns the account's strength sessions on this device: the rest timer, the
 * write lock, and the sync of every session a screen or sheet has open.
 */
import { useAuth } from "@clerk/expo";
import { type ReactNode, useMemo, useRef, useState } from "react";
import type { Id } from "../../../convex/api";
import { RestTimerProvider } from "./rest-timer";
import { SessionSync } from "./session-sync";
import {
	StrengthSessionContext,
	type StrengthSessions,
} from "./strength-session-context";

export function StrengthSessionProvider({ children }: { children: ReactNode }) {
	const { userId } = useAuth();
	return (
		<AccountSessions key={userId ?? "signed-out"} subject={userId ?? null}>
			{children}
		</AccountSessions>
	);
}
function counted(
	current: ReadonlyMap<string, number>,
	sessionId: string,
	change: 1 | -1,
) {
	const next = new Map(current);
	const count = (next.get(sessionId) ?? 0) + change;
	if (count > 0) next.set(sessionId, count);
	else next.delete(sessionId);
	return next;
}
function AccountSessions({
	subject,
	children,
}: {
	subject: string | null;
	children: ReactNode;
}) {
	const [open, setOpen] = useState<ReadonlyMap<string, number>>(new Map());
	const locks = useRef(new Set<string>());
	const value = useMemo<StrengthSessions>(
		() => ({
			subject,
			open(sessionId) {
				setOpen((current) => counted(current, sessionId, 1));
				return () => setOpen((current) => counted(current, sessionId, -1));
			},
			async run(sessionId, action) {
				if (!subject || locks.current.has(sessionId)) return false;
				locks.current.add(sessionId);
				try {
					await action();
					return true;
				} finally {
					locks.current.delete(sessionId);
				}
			},
		}),
		[subject],
	);
	return (
		<StrengthSessionContext.Provider value={value}>
			<RestTimerProvider subject={subject}>
				{children}
				{subject
					? [...open.keys()].map((sessionId) => (
							<SessionSync
								key={sessionId}
								subject={subject}
								sessionId={sessionId as Id<"workoutSessions">}
							/>
						))
					: null}
			</RestTimerProvider>
		</StrengthSessionContext.Provider>
	);
}
