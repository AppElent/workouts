import { useAuth } from "@clerk/expo";
import Storage from "expo-sqlite/kv-store";
import {
	createContext,
	type ReactNode,
	useContext,
	useRef,
	useState,
} from "react";
import { z } from "zod";

const fieldsSchema = z.object({
	weight: z.string(),
	reps: z.string(),
	rpe: z.string(),
	unit: z.enum(["kg", "lbs"]),
	setType: z.enum(["warmup", "working", "drop", "failure"]),
});
const draftSchema = z.object({
	sessionId: z.string(),
	exerciseId: z.string(),
	fields: fieldsSchema,
	// Written atomically with the draft BEFORE sending a Log request. Never replayed in the background.
	attempt: z
		.object({
			operationId: z.string(),
			setNumber: z.number().int().positive(),
			fields: fieldsSchema,
		})
		.optional(),
});
export type SetFields = z.infer<typeof fieldsSchema>;
export type SetDraft = z.infer<typeof draftSchema>;
const draftsSchema = z.array(draftSchema);
function storageKey(subject: string) {
	return `strength-set-drafts:v1:${subject}`;
}
function sameDraft(
	a: Pick<SetDraft, "sessionId" | "exerciseId">,
	b: Pick<SetDraft, "sessionId" | "exerciseId">,
) {
	return a.sessionId === b.sessionId && a.exerciseId === b.exerciseId;
}
export function newLogOperationId() {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`set-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
	);
}
function read(subject: string | null | undefined): {
	drafts: SetDraft[];
	error: boolean;
} {
	if (!subject) return { drafts: [], error: false };
	try {
		const raw = Storage.getItemSync(storageKey(subject));
		return {
			drafts: raw ? draftsSchema.parse(JSON.parse(raw)) : [],
			error: false,
		};
	} catch {
		return { drafts: [], error: true };
	}
}
function useDraftStore(subject: string | null | undefined) {
	const [state, setState] = useState(() => read(subject));
	const current = useRef(state);
	const locks = useRef(new Set<string>());
	const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
	function persist(drafts: SetDraft[]) {
		if (!subject || current.current.error)
			throw new Error("Local set storage is unavailable.");
		try {
			Storage.setItemSync(
				storageKey(subject),
				JSON.stringify(draftsSchema.parse(drafts)),
			);
		} catch (error) {
			current.current = { ...current.current, error: true };
			setState(current.current);
			throw error;
		}
		current.current = { drafts, error: false };
		setState(current.current);
	}
	return {
		subject,
		drafts: state.drafts,
		storageError: state.error,
		busy,
		retryStorage() {
			current.current = read(subject);
			setState(current.current);
		},
		get(sessionId: string, exerciseId: string) {
			return current.current.drafts.find((draft) =>
				sameDraft(draft, { sessionId, exerciseId }),
			);
		},
		put(draft: SetDraft) {
			persist([
				...current.current.drafts.filter(
					(existing) => !sameDraft(existing, draft),
				),
				draft,
			]);
		},
		remove(sessionId: string, exerciseId: string) {
			persist(
				current.current.drafts.filter(
					(draft) => !sameDraft(draft, { sessionId, exerciseId }),
				),
			);
		},
		clearSession(sessionId: string) {
			persist(
				current.current.drafts.filter((draft) => draft.sessionId !== sessionId),
			);
		},
		/** All local Log/Save/Delete/Finish/Cancel actions share this session lock. */
		async run(sessionId: string, action: () => Promise<unknown>) {
			if (!subject || locks.current.has(sessionId)) return false;
			locks.current.add(sessionId);
			setBusy(new Set(locks.current));
			try {
				await action();
				return true;
			} finally {
				locks.current.delete(sessionId);
				setBusy(new Set(locks.current));
			}
		},
	};
}
const SetDraftContext = createContext<ReturnType<typeof useDraftStore> | null>(
	null,
);
function SubjectSetDrafts({
	subject,
	children,
}: {
	subject: string | null | undefined;
	children: ReactNode;
}) {
	const store = useDraftStore(subject);
	return (
		<SetDraftContext.Provider value={store}>
			{children}
		</SetDraftContext.Provider>
	);
}
export function SetDraftsProvider({ children }: { children: ReactNode }) {
	const { userId } = useAuth();
	return (
		<SubjectSetDrafts key={userId ?? "signed-out"} subject={userId}>
			{children}
		</SubjectSetDrafts>
	);
}
export function useSetDrafts() {
	const value = useContext(SetDraftContext);
	if (!value) throw new Error("Set drafts require the signed-in provider.");
	return value;
}
