/**
 * The device-local half of a strength session. The plan survives restarts in
 * kv storage, per account and session; logged sets remain on the server and
 * are reconciled in. Screens read through `useSessionWorkspace`.
 */
import { convertLoad, getWeightStep } from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import type { RequestForQueries } from "convex/react";
import Storage from "expo-sqlite/kv-store";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { api, type Id } from "../../../convex/api";
import { useQueries } from "../../../convex/query-cache";
import { useExercises } from "../../../data/exercises";
import { savedRestDefault } from "../components/rest-timer";
import {
	allRows,
	type ExerciseFacts,
	fillFromLast,
	importOldDraft,
	markFailed,
	markLogged,
	type PlanSet,
	reconcilePlan,
	type ServerSet,
	type SessionPlan,
	seedPlan,
	tickClocks,
} from "../session-plan";
import { useSetDrafts } from "./set-drafts";
import { useStrengthSession } from "./use-strength-session";

const PREFIX = "strength-session-plan:v1";
export function planKey(subject: string, sessionId: string) {
	return `${PREFIX}:${subject}:${sessionId}`;
}
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
	plan: SessionPlan | null;
	/** Unsaved changes to already logged sets, by row. */
	drafts: Record<string, PlanSet>;
	notice: SessionNotice | null;
	holds: number;
	seen: Set<string> | null;
	storageError: boolean;
	listeners: Set<() => void>;
	inFlight: Set<string>;
}
const entries = new Map<string, Entry>();
let noticeId = 0;
function isPlan(value: unknown): value is SessionPlan {
	const plan = value as Partial<SessionPlan> | null;
	return Boolean(
		plan &&
			plan.version === 1 &&
			Array.isArray(plan.order) &&
			plan.sets &&
			plan.groups &&
			plan.manual,
	);
}
const draftsKey = (key: string) => `${key}:drafts`;
function readDrafts(key: string): Record<string, PlanSet> {
	try {
		const parsed = JSON.parse(Storage.getItemSync(draftsKey(key)) ?? "{}");
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}
function entryFor(key: string): Entry {
	const known = entries.get(key);
	if (known) return known;
	let plan: SessionPlan | null = null;
	let storageError = false;
	try {
		const raw = Storage.getItemSync(key);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		plan = isPlan(parsed) ? parsed : null;
	} catch {
		storageError = true;
	}
	const entry: Entry = {
		plan,
		drafts: readDrafts(key),
		notice: null,
		holds: 0,
		seen: null,
		storageError,
		listeners: new Set(),
		inFlight: new Set(),
	};
	entries.set(key, entry);
	return entry;
}
function emit(entry: Entry) {
	for (const listener of entry.listeners) listener();
}
export const workspaceStore = {
	plan: (key: string) => entryFor(key).plan,
	draft: (key: string, rowId: string): PlanSet | undefined =>
		entryFor(key).drafts[rowId],
	setDraft(key: string, rowId: string, row: PlanSet | null) {
		const entry = entryFor(key);
		const { [rowId]: _old, ...rest } = entry.drafts;
		entry.drafts = row ? { ...rest, [rowId]: row } : rest;
		try {
			Storage.setItemSync(draftsKey(key), JSON.stringify(entry.drafts));
		} catch {
			entry.storageError = true;
		}
		emit(entry);
	},
	setPlan(key: string, plan: SessionPlan) {
		const entry = entryFor(key);
		if (entry.plan === plan) return;
		entry.plan = plan;
		try {
			Storage.setItemSync(key, JSON.stringify(plan));
			entry.storageError = false;
		} catch {
			// The plan keeps working from memory; the screen says it won't survive.
			entry.storageError = true;
		}
		emit(entry);
	},
	update(key: string, change: (plan: SessionPlan) => SessionPlan) {
		const plan = entryFor(key).plan;
		if (plan) workspaceStore.setPlan(key, change(plan));
	},
	clear(key: string) {
		const entry = entryFor(key);
		entry.plan = null;
		entry.drafts = {};
		entry.notice = null;
		entry.seen = null;
		try {
			Storage.removeItemSync(key);
			Storage.removeItemSync(draftsKey(key));
		} catch {
			entry.storageError = true;
		}
		emit(entry);
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
		entryFor(key).seen = new Set([...(entryFor(key).seen ?? []), ...ids]);
	},
	subscribe(key: string, listener: () => void) {
		const entry = entryFor(key);
		entry.listeners.add(listener);
		return () => {
			entry.listeners.delete(listener);
		};
	},
};
/** Only a confirmed account reset discards local session plans. */
export function clearAccountSessionPlans(subject: string) {
	const prefix = `${PREFIX}:${subject}:`;
	for (const key of Storage.getAllKeysSync())
		if (key.startsWith(prefix)) Storage.removeItemSync(key);
	for (const key of entries.keys())
		if (key.startsWith(prefix)) entries.delete(key);
}

type RawReference =
	| {
			value: number;
			unit: "kg" | "lbs";
			date: number;
	  }
	| null
	| undefined;
export type RawReferences = {
	measured?: RawReference;
	estimated?: RawReference;
	manual?: RawReference;
};
const toKg = (reference: RawReference) =>
	reference ? convertLoad(reference.value, reference.unit, "kg") : null;
export function factsFrom(
	exercise: Pick<Exercise, "equipment" | "weightIncrement"> | undefined,
	references: RawReferences | undefined,
	last: { weight: number; unit: "kg" | "lbs"; reps: number } | null | undefined,
): ExerciseFacts {
	return {
		bodyweight: exercise?.equipment === "bodyweight",
		stepKg: exercise
			? getWeightStep(exercise.equipment, exercise.weightIncrement)
			: 2.5,
		measured: toKg(references?.measured),
		estimated: toKg(references?.estimated),
		measuredDate: references?.measured?.date ?? null,
		savedManual: references?.manual
			? {
					value: toKg(references.manual) as number,
					date: references.manual.date,
				}
			: null,
		last: last
			? { kg: convertLoad(last.weight, last.unit, "kg"), reps: last.reps }
			: null,
	};
}

const noop = () => () => undefined;
export function useSessionWorkspace(sessionId?: Id<"workoutSessions">) {
	const store = useSetDrafts();
	const subject = store.subject;
	const key = subject && sessionId ? planKey(subject, sessionId) : "";
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
						?.references as RawReferences | undefined,
					last instanceof Error ? null : (last as never),
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
		storageError: key ? workspaceStore.storageError(key) : false,
	};
}
const EMPTY_DRAFTS: Record<string, PlanSet> = {};
export type SessionWorkspace = ReturnType<typeof useSessionWorkspace>;

/** Runs on the session screen: seeds, reconciles, ticks clocks, resolves receipts. */
export function useSessionSync(workspace: SessionWorkspace) {
	const { key, plan, data, session, sets, getFacts, active, held, factsById } =
		workspace;
	const importedDrafts = useRef(false);
	const store = useSetDrafts();
	useEffect(() => {
		if (!key || !session || !sets || !active || !data.verified || held) return;
		const exercises = (session.exercises ?? []).map((item) => ({
			exerciseId: item.exerciseId as string,
			plannedSets: item.plannedSets,
		}));
		const server = sets as unknown as ServerSet[];
		const current = workspaceStore.plan(key);
		if (!current) {
			workspaceStore.setPlan(
				key,
				seedPlan(exercises, server, getFacts, savedRestDefault()),
			);
			workspaceStore.markSeen(
				key,
				server.map((set) => set._id),
			);
			return;
		}
		const seen = workspaceStore.seen(key) ?? undefined;
		const next = reconcilePlan(current, exercises, server, getFacts, seen);
		workspaceStore.markSeen(
			key,
			server.map((set) => set._id),
		);
		workspaceStore.setPlan(key, next);
	}, [key, session, sets, active, data.verified, held, getFacts]);
	// Rows a routine left empty take last time's load once that query answers.
	useEffect(() => {
		if (!key || !plan || held) return;
		let next = plan;
		for (const [exerciseId, facts] of factsById) {
			if (workspace.lastResults[`last:${exerciseId}`] === undefined) continue;
			next = fillFromLast(next, exerciseId, facts);
		}
		if (next !== plan) workspaceStore.setPlan(key, next);
	}, [key, plan, held, factsById, workspace.lastResults]);
	// An older build's unfinished Set Draft becomes this plan's open input.
	useEffect(() => {
		if (!key || !plan || !workspace.sessionId || importedDrafts.current) return;
		importedDrafts.current = true;
		const local = store.drafts.filter(
			(draft) => draft.sessionId === workspace.sessionId,
		);
		if (!local.length) return;
		const next = local.reduce(importOldDraft, plan);
		workspaceStore.setPlan(key, next);
		try {
			store.clearSession(workspace.sessionId);
		} catch {
			// The plan already holds the input; an old draft only lingers on disk.
		}
	}, [key, plan, workspace.sessionId, store]);
	// A clock reads from its end time, so a lock or restart can't leave it behind.
	useEffect(() => {
		if (!key) return;
		const tick = () =>
			workspaceStore.update(key, (p) => tickClocks(p, Date.now()));
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, [key]);
	useAttemptReceipts(workspace);
}
/** After a restart, a sent log resolves through its receipt, and is never replayed. */
function useAttemptReceipts(workspace: SessionWorkspace) {
	const { key, plan, online, getFacts } = workspace;
	const attempts = useMemo(
		() =>
			plan ? allRows(plan).flatMap((row) => (row.attempt ? [row] : [])) : [],
		[plan],
	);
	const queries = useMemo(
		(): RequestForQueries =>
			Object.fromEntries(
				attempts.map((row) => [
					row.id,
					{
						query: api.sets.getLogResult,
						args: { operationId: row.attempt?.operationId as string },
					},
				]),
			),
		[attempts],
	);
	const results = useQueries(queries);
	useEffect(() => {
		if (!key) return;
		for (const row of attempts) {
			const attempt = row.attempt;
			if (!attempt || workspaceStore.inFlight(key).has(attempt.operationId))
				continue;
			const receipt = results[row.id] as
				| { setId: string; status: "saved" | "removed" }
				| null
				| undefined
				| Error;
			if (receipt === undefined || receipt instanceof Error) continue;
			if (receipt === null) {
				if (online)
					workspaceStore.update(key, (p) => markFailed(p, row.id, false));
				continue;
			}
			if (receipt.status === "saved")
				workspaceStore.update(
					key,
					(p) =>
						markLogged(
							p,
							row.id,
							receipt.setId,
							attempt.setNumber,
							getFacts(row.exerciseId),
						).plan,
				);
			else
				workspaceStore.update(key, (p) => ({
					...p,
					sets: Object.fromEntries(
						Object.entries(p.sets).map(([id, rows]) => [
							id,
							rows.map((item) =>
								item.id === row.id
									? { ...item, attempt: undefined, failed: undefined }
									: item,
							),
						]),
					),
				}));
		}
	}, [key, attempts, results, online, getFacts]);
}
