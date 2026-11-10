/**
 * The device-local half of a strength session. The plan survives restarts in
 * the local store, per account and session; logged sets remain on the server
 * and are reconciled in. Screens read through `useSessionWorkspace`, and the
 * strength session provider keeps every open session in sync.
 */
import {
	convertLoad,
	DEFAULT_REST_SECONDS,
	getWeightStep,
} from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import type { RequestForQueries } from "convex/react";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQueries } from "../../../convex/query-cache";
import { useExercises } from "../../../data/exercises";
import {
	accountKeyspace,
	type LocalKey,
	readLocal,
	readLocalJson,
	registerAccountStore,
	removeLocal,
	writeLocal,
	writeLocalJson,
} from "../../../local-store/local-store";
import {
	allRows,
	type ExerciseFacts,
	type PlanSet,
	type SessionPlan,
} from "../session-plan";
import type { RestTimerApi } from "./rest-timer";
import { cancelClockAlerts } from "./session-notifications";
import { useStrengthSessions } from "./strength-session-context";
import { useStrengthSession } from "./use-strength-session";

const PLANS = "strength-session-plan:v1";
const plans = accountKeyspace(PLANS);
const restDefaults = accountKeyspace("strength-rest-default:v1");

export type NoticeUndo = () => void | Promise<void>;
export interface SessionNotice {
	id: number;
	text: string;
	highlight?: boolean;
	undoLabel?: string;
	undo?: NoticeUndo;
	retryLabel?: string;
	retry?: () => void;
}
interface Entry {
	subject: string;
	planKey: LocalKey;
	draftsKey: LocalKey;
	plan: SessionPlan | null;
	/** Unsaved changes to already logged sets, by row. */
	drafts: Record<string, PlanSet>;
	notice: SessionNotice | null;
	holds: number;
	seen: Set<string> | null;
	/** The last write failed: the plan lives only in memory. */
	storageError: boolean;
	listeners: Set<() => void>;
	inFlight: Set<string>;
}
const entries = new Map<string, Entry>();
let noticeId = 0;
function parsePlan(value: unknown): SessionPlan {
	const plan = value as Partial<SessionPlan> | null;
	if (
		plan?.version === 1 &&
		Array.isArray(plan.order) &&
		plan.sets &&
		plan.groups &&
		plan.manual
	)
		return plan as SessionPlan;
	throw new Error("Not a session plan");
}
function parseDrafts(value: unknown): Record<string, PlanSet> {
	if (value && typeof value === "object")
		return value as Record<string, PlanSet>;
	throw new Error("Not session drafts");
}
/** The store key of one account's session; reading it loads that session. */
export function workspaceKey(subject: string, sessionId: string): string {
	const planKey = plans.key(subject, sessionId);
	if (entries.has(planKey)) return planKey;
	const draftsKey = plans.key(subject, sessionId, "drafts");
	const plan = readLocalJson(planKey, parsePlan);
	const drafts = readLocalJson(draftsKey, parseDrafts);
	entries.set(planKey, {
		subject,
		planKey,
		draftsKey,
		plan: plan.ok ? plan.value : null,
		drafts: drafts.ok ? (drafts.value ?? {}) : {},
		notice: null,
		holds: 0,
		seen: null,
		storageError: !plan.ok,
		listeners: new Set(),
		inFlight: new Set(),
	});
	return planKey;
}
function entryFor(key: string): Entry {
	const entry = entries.get(key);
	if (!entry) throw new Error("Open a session workspace through workspaceKey");
	return entry;
}
function emit(entry: Entry) {
	for (const listener of entry.listeners) listener();
}
function forget(entry: Entry) {
	entry.plan = null;
	entry.drafts = {};
	entry.notice = null;
	entry.seen = null;
	emit(entry);
}
export const workspaceStore = {
	plan: (key: string) => entryFor(key).plan,
	draft: (key: string, rowId: string): PlanSet | undefined =>
		entryFor(key).drafts[rowId],
	setDraft(key: string, rowId: string, row: PlanSet | null) {
		const entry = entryFor(key);
		const { [rowId]: _old, ...rest } = entry.drafts;
		entry.drafts = row ? { ...rest, [rowId]: row } : rest;
		if (!writeLocalJson(entry.draftsKey, entry.drafts))
			entry.storageError = true;
		emit(entry);
	},
	setPlan(key: string, plan: SessionPlan) {
		const entry = entryFor(key);
		if (entry.plan === plan) return;
		entry.plan = plan;
		entry.storageError = !writeLocalJson(entry.planKey, plan);
		emit(entry);
	},
	update(key: string, change: (plan: SessionPlan) => SessionPlan) {
		const plan = entryFor(key).plan;
		if (plan) workspaceStore.setPlan(key, change(plan));
	},
	clear(key: string) {
		const entry = entryFor(key);
		const removed = removeLocal(entry.planKey) && removeLocal(entry.draftsKey);
		if (!removed) entry.storageError = true;
		forget(entry);
	},
	notify(key: string, notice: Omit<SessionNotice, "id"> | null) {
		const entry = entryFor(key);
		noticeId += 1;
		entry.notice = notice ? { ...notice, id: noticeId } : null;
		emit(entry);
	},
	dismissNotice(key: string, id: number) {
		const entry = entryFor(key);
		if (entry.notice?.id !== id) return;
		entry.notice = null;
		emit(entry);
	},
	notice: (key: string) => entryFor(key).notice,
	storageError: (key: string) => entryFor(key).storageError,
	/** While held, nothing reconciles: a multi-step write is mid-flight. */
	async hold<T>(key: string, action: () => Promise<T>) {
		const entry = entryFor(key);
		entry.holds += 1;
		emit(entry);
		try {
			return await action();
		} finally {
			entry.holds -= 1;
			emit(entry);
		}
	},
	held: (key: string) => entryFor(key).holds > 0,
	inFlight: (key: string) => entryFor(key).inFlight,
	seen: (key: string) => entryFor(key).seen,
	markSeen(key: string, ids: string[]) {
		const entry = entryFor(key);
		entry.seen = new Set([...(entry.seen ?? []), ...ids]);
	},
	subscribe(key: string, listener: () => void) {
		const entry = entryFor(key);
		entry.listeners.add(listener);
		return () => {
			entry.listeners.delete(listener);
		};
	},
};
// Replaces the keyspace's own registration so open screens forget the plan too.
registerAccountStore({
	name: PLANS,
	clear(subject) {
		plans.clear(subject);
		for (const entry of entries.values())
			if (entry.subject === subject) forget(entry);
	},
});

/** Everything an ended session leaves on the device: its plan, clock alerts and rest. */
export function endSession(key: string, rest: Pick<RestTimerApi, "stop">) {
	const plan = entryFor(key).plan;
	if (plan) cancelClockAlerts(plan);
	workspaceStore.clear(key);
	rest.stop();
}

/** The rest a new session starts with; changed from any session's menu. */
export function savedRestDefault(subject: string) {
	const seconds = Number(readLocal(restDefaults.key(subject)));
	return seconds > 0 ? seconds : DEFAULT_REST_SECONDS;
}
export function saveRestDefault(subject: string, seconds: number) {
	writeLocal(restDefaults.key(subject), String(seconds));
}

type SessionExercise = NonNullable<Doc<"workoutSessions">["exercises"]>[number];
export type RawReferences = SessionExercise["references"];
type RawReference = NonNullable<RawReferences>["measured"];
export type LastSet = Pick<Doc<"sets">, "weight" | "unit" | "reps">;
const toKg = (reference: RawReference | undefined) =>
	reference ? convertLoad(reference.value, reference.unit, "kg") : null;
export function factsFrom(
	exercise: Pick<Exercise, "equipment" | "weightIncrement"> | undefined,
	references: RawReferences | undefined,
	last: LastSet | null | undefined,
): ExerciseFacts {
	const manual = toKg(references?.manual);
	return {
		bodyweight: exercise?.equipment === "bodyweight",
		stepKg: getWeightStep(
			exercise?.equipment ?? "barbell",
			exercise?.weightIncrement,
		),
		measured: toKg(references?.measured),
		estimated: toKg(references?.estimated),
		measuredDate: references?.measured?.date ?? null,
		savedManual:
			manual !== null && references?.manual
				? { value: manual, date: references.manual.date }
				: null,
		last: last
			? { kg: convertLoad(last.weight, last.unit, "kg"), reps: last.reps }
			: null,
	};
}

const noop = () => () => undefined;
/** A session as the screens and sheets see it; opening one keeps it in sync. */
export function useSessionWorkspace(sessionId?: Id<"workoutSessions">) {
	const { subject, open } = useStrengthSessions();
	useEffect(() => (sessionId ? open(sessionId) : undefined), [open, sessionId]);
	return useWorkspace(subject, sessionId);
}
export function useWorkspace(
	subject: string | null,
	sessionId?: Id<"workoutSessions">,
) {
	const key = subject && sessionId ? workspaceKey(subject, sessionId) : "";
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
	const notice = useSyncExternalStore(subscribe, () =>
		key ? workspaceStore.notice(key) : null,
	);
	const held = useSyncExternalStore(subscribe, () =>
		key ? workspaceStore.held(key) : false,
	);
	const drafts = useSyncExternalStore(subscribe, () =>
		key ? entryFor(key).drafts : EMPTY_DRAFTS,
	);
	const storageError = useSyncExternalStore(subscribe, () =>
		key ? workspaceStore.storageError(key) : false,
	);
	const data = useStrengthSession(sessionId);
	const catalog = useExercises();
	const session = data.session instanceof Error ? undefined : data.session;
	const sets = Array.isArray(data.sets) ? data.sets : undefined;
	const exerciseIds = useMemo(
		() => [
			...new Set([
				...(session?.exercises?.map((item) => item.exerciseId as string) ?? []),
				...(plan ? allRows(plan).map((row) => row.exerciseId) : []),
			]),
		],
		[session?.exercises, plan],
	);
	const idsKey = exerciseIds.join("|");
	const lastQueries = useMemo((): RequestForQueries => {
		if (!sessionId) return {};
		return Object.fromEntries(
			idsKey
				.split("|")
				.filter(Boolean)
				.map((exerciseId) => [
					`last:${exerciseId}`,
					{
						query: api.sets.getLastForExercise,
						args: { exerciseId, excludeSessionId: sessionId },
					},
				]),
		);
	}, [idsKey, sessionId]);
	const lastResults = useQueries(lastQueries);
	const factsById = useMemo(() => {
		const map = new Map<string, ExerciseFacts>();
		for (const exerciseId of idsKey.split("|").filter(Boolean)) {
			const last = lastResults[`last:${exerciseId}`];
			map.set(
				exerciseId,
				factsFrom(
					catalog.find((item) => item._id === exerciseId),
					session?.exercises?.find((item) => item.exerciseId === exerciseId)
						?.references,
					last instanceof Error ? null : (last as LastSet),
				),
			);
		}
		return map;
	}, [idsKey, lastResults, catalog, session?.exercises]);
	const getFacts = useMemo(
		() => (exerciseId: string) =>
			factsById.get(exerciseId) ??
			factsFrom(
				catalog.find((item) => item._id === exerciseId),
				undefined,
				null,
			),
		[factsById, catalog],
	);
	const own = Boolean(session && session.userId === subject);
	const active = own && session?.status === "active";
	const nameOf = useMemo(
		() => (exerciseId: string) =>
			catalog.find((item) => item._id === exerciseId)?.name ?? "",
		[catalog],
	);
	return {
		subject,
		key,
		sessionId,
		plan,
		notice,
		held,
		drafts,
		data,
		session,
		sets,
		wods: Array.isArray(data.wods) ? data.wods : undefined,
		catalog,
		getFacts,
		nameOf,
		own,
		active,
		online: data.online,
		writable: Boolean(active && data.verified && data.online),
		lastResults,
		factsById,
		storageError,
	};
}
const EMPTY_DRAFTS: Record<string, PlanSet> = {};
export type SessionWorkspace = ReturnType<typeof useSessionWorkspace>;
