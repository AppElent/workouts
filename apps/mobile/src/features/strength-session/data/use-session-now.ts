/**
 * What the active strength session is doing right now: the next open set and
 * the rest countdown. The Live Activity and the session screens read this one
 * shape, so keep it stable.
 */
import { isTimedExercise } from "@foundry/core";
import { useMemo, useSyncExternalStore } from "react";
import { useExercises } from "../../../data/exercises";
import { useActiveSession } from "../../../data/session-data";
import { nextOpenRow, rowsOf, type SessionPlan } from "../session-plan";
import { useRestState } from "./rest-timer";
import { workspaceKey, workspaceStore } from "./session-workspace";
import { useStrengthSessions } from "./strength-session-context";

export interface SessionNow {
	/** The session's own name; null for a free session. */
	sessionName: string | null;
	/** The next open set's exercise; null when every set is done or no plan is on this device. */
	exerciseName: string | null;
	/** 1-based position of the next open set among its exercise's sets. */
	setIndex: number | null;
	setCount: number | null;
	/** Planned load in kg; 0 on bodyweight. */
	kg: number | null;
	/** Planned reps; null on a timed hold. */
	reps: number | null;
	/** Planned seconds on a timed hold; null otherwise. */
	durationSeconds: number | null;
	/** Epoch ms the rest countdown ends at; null while not resting, and once it has run out. */
	restEndsAt: number | null;
	/** Epoch ms the session started. */
	startedAt: number;
}

type NextSet = Pick<
	SessionNow,
	"setIndex" | "setCount" | "kg" | "reps" | "durationSeconds"
> & { exerciseId: string };

/** The next open set of a plan, as the Live Activity and the header read it. */
export function nextSetOf(plan: SessionPlan | null): NextSet | null {
	if (!plan) return null;
	const row = nextOpenRow(plan);
	if (!row) return null;
	const rows = rowsOf(plan, row.exerciseId);
	const timed = isTimedExercise(row.exerciseId);
	return {
		exerciseId: row.exerciseId,
		setIndex: rows.findIndex((item) => item.id === row.id) + 1,
		setCount: rows.length,
		kg: row.kg,
		reps: timed ? null : row.reps,
		durationSeconds: timed ? row.reps : null,
	};
}

const noop = () => () => undefined;

/** Null while no strength session is active (or it is still loading). */
export function useSessionNow(): SessionNow | null {
	const { subject } = useStrengthSessions();
	const active = useActiveSession();
	const rest = useRestState();
	const catalog = useExercises();
	const key = subject && active ? workspaceKey(subject, active._id) : "";
	const subscribe = useMemo(
		() =>
			key
				? (listener: () => void) => workspaceStore.subscribe(key, listener)
				: noop,
		[key],
	);
	const plan = useSyncExternalStore(subscribe, () =>
		key ? workspaceStore.plan(key) : null,
	);
	const next = useMemo(() => nextSetOf(plan), [plan]);
	const exerciseName = next
		? (catalog.find((item) => item._id === next.exerciseId)?.name ?? null)
		: null;
	const sessionName = active?.name ?? null;
	const startedAt = active?.startTime;
	return useMemo(() => {
		if (startedAt === undefined) return null;
		return {
			sessionName,
			exerciseName,
			setIndex: next?.setIndex ?? null,
			setCount: next?.setCount ?? null,
			kg: next?.kg ?? null,
			reps: next?.reps ?? null,
			durationSeconds: next?.durationSeconds ?? null,
			restEndsAt: rest.over ? null : rest.endsAt,
			startedAt,
		};
	}, [sessionName, exerciseName, next, rest.endsAt, rest.over, startedAt]);
}
