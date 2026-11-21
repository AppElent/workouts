/**
 * What the active strength session is doing right now: the next open set and
 * the rest countdown. The Live Activity and the session screens read this one
 * shape, so keep it stable.
 */
import { isTimedExercise, type LoadUnit } from "@foundry/core";
import { useMemo, useSyncExternalStore } from "react";
import { useExercise } from "../../../data/exercises";
import { useActiveSession } from "../../../data/session-data";
import {
	nextOpenRow,
	type PlanSet,
	repeatSetOf,
	rowsOf,
	type SessionPlan,
} from "../session-plan";
import { useRestState } from "./rest-timer";
import { workspaceKey, workspaceStore } from "./session-workspace";
import { useStrengthSessions } from "./strength-session-context";

export interface SessionNow {
	/** The session's own name; null for a free session. */
	sessionName: string | null;
	/** The next open set's exercise; null when every set is done or no plan is on this device. */
	exerciseName: string | null;
	/**
	 * 1-based position of the next open set among its exercise's working sets,
	 * as the rest notification counts; null while the next set is a warm-up.
	 */
	setIndex: number | null;
	/** Working sets of that exercise; null while the next set is a warm-up. */
	setCount: number | null;
	/** Planned load in kg; 0 on bodyweight. */
	kg: number | null;
	/**
	 * The unit the set reads in on the session screen. Absent means kg; `kg`
	 * above stays canonical either way.
	 */
	unit?: LoadUnit;
	/** A pound load exactly as typed, so it reads back the same. */
	typedLbs?: number;
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
	| "setIndex"
	| "setCount"
	| "kg"
	| "unit"
	| "typedLbs"
	| "reps"
	| "durationSeconds"
> & { exerciseId: string };

/** The next open set of a plan, as the Live Activity and the header read it. */
export function nextSetOf(plan: SessionPlan | null): NextSet | null {
	if (!plan) return null;
	const row = nextOpenRow(plan);
	if (!row) {
		// A free exercise offers one more set like its last, as the Now card does.
		const repeat = repeatSetOf(plan);
		if (!repeat) return null;
		return {
			...loadOf(repeat.template),
			setIndex: repeat.number,
			setCount: repeat.number,
		};
	}
	const working = rowsOf(plan, row.exerciseId).filter(
		(item) => item.kind !== "warmup",
	);
	const warmup = row.kind === "warmup";
	return {
		...loadOf(row),
		setIndex: warmup
			? null
			: working.findIndex((item) => item.id === row.id) + 1,
		setCount: warmup ? null : working.length,
	};
}

function loadOf(row: PlanSet) {
	const timed = isTimedExercise(row.exerciseId);
	return {
		exerciseId: row.exerciseId,
		kg: row.kg,
		unit: row.unit,
		...(row.typedLbs === undefined ? {} : { typedLbs: row.typedLbs }),
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
	// Only the current exercise: the whole catalog pages in otherwise.
	const exerciseName = useExercise(next?.exerciseId)?.name ?? null;
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
			unit: next?.unit,
			typedLbs: next?.typedLbs,
			reps: next?.reps ?? null,
			durationSeconds: next?.durationSeconds ?? null,
			restEndsAt: rest.over ? null : rest.endsAt,
			startedAt,
		};
	}, [sessionName, exerciseName, next, rest.endsAt, rest.over, startedAt]);
}
