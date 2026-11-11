import { createContext, useContext } from "react";

export interface StrengthSessions {
	/** The signed-in account; null while signed out. */
	subject: string | null;
	/** Keeps a session in sync while anything shows it; returns the release. */
	open: (sessionId: string) => () => void;
	/** Writes that must not overlap for one session; false when one is running. */
	run: (sessionId: string, action: () => Promise<unknown>) => Promise<boolean>;
}
export const StrengthSessionContext = createContext<StrengthSessions | null>(
	null,
);
export function useStrengthSessions() {
	const value = useContext(StrengthSessionContext);
	if (!value)
		throw new Error("Strength sessions require the StrengthSessionProvider");
	return value;
}
