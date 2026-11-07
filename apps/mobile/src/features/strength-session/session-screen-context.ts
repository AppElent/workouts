/** What every part of the open session screen shares. */
import { createContext, useContext } from "react";
import type { SessionActions } from "./data/session-actions";
import type { SessionWorkspace } from "./data/session-workspace";
import type { SessionPlan } from "./session-plan";

export type PickerRequest =
	| { mode: "add" }
	| { mode: "swap"; from: string }
	| { mode: "group"; groupId: string };
export interface SessionScreenValue {
	workspace: SessionWorkspace;
	actions: SessionActions;
	plan: SessionPlan;
	openEditor: (rowId: string) => void;
	openProfile: (exerciseId: string, rowId?: string) => void;
	openManual: (exerciseId: string) => void;
	openGroup: (groupId: string) => void;
	openPicker: (request: PickerRequest) => void;
	confirmDelete: (rowId: string) => void;
	toggleRow: (rowId: string) => void;
}
export const SessionScreenContext = createContext<SessionScreenValue | null>(
	null,
);
export function useSessionScreen() {
	const value = useContext(SessionScreenContext);
	if (!value) throw new Error("Session parts render inside the session screen");
	return value;
}
