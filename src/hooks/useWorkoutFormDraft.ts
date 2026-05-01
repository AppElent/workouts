import type { Id } from "@convex/_generated/dataModel";

type SetType = "warmup" | "working" | "drop" | "failure";

export interface FormDraft {
	weight: number;
	reps: number;
	rpe: number;
	setType: SetType;
}

export function loadFormDraft(
	sessionId: Id<"workoutSessions">,
	exerciseId: Id<"exercises">,
): FormDraft | null {
	try {
		const raw = localStorage.getItem(`workout-form-${sessionId}-${exerciseId}`);
		return raw ? (JSON.parse(raw) as FormDraft) : null;
	} catch {
		return null;
	}
}

export function saveFormDraft(
	sessionId: Id<"workoutSessions">,
	exerciseId: Id<"exercises">,
	draft: FormDraft,
): void {
	try {
		localStorage.setItem(
			`workout-form-${sessionId}-${exerciseId}`,
			JSON.stringify(draft),
		);
	} catch {
		// storage unavailable (e.g. private browsing quota exceeded)
	}
}

export function loadOrderDraft(
	sessionId: Id<"workoutSessions">,
): Id<"exercises">[] | null {
	try {
		const raw = localStorage.getItem(`workout-order-${sessionId}`);
		return raw ? (JSON.parse(raw) as Id<"exercises">[]) : null;
	} catch {
		return null;
	}
}

export function saveOrderDraft(
	sessionId: Id<"workoutSessions">,
	order: Id<"exercises">[],
): void {
	try {
		localStorage.setItem(`workout-order-${sessionId}`, JSON.stringify(order));
	} catch {}
}

export function clearSessionDrafts(sessionId: Id<"workoutSessions">): void {
	try {
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (
				key?.startsWith(`workout-form-${sessionId}-`) ||
				key === `workout-order-${sessionId}`
			) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			localStorage.removeItem(key);
		}
	} catch {}
}
