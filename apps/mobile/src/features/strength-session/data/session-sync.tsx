/** Keeps one open session's plan in step with the server and the clock. */
import type { RequestForQueries } from "convex/react";
import { useEffect, useMemo } from "react";
import { api, type Id } from "../../../convex/api";
import { useQueries } from "../../../convex/query-cache";
import {
	allRows,
	fillFromLast,
	markFailed,
	markLogged,
	reconcilePlan,
	seedPlan,
	tickClocks,
} from "../session-plan";
import { useRestTimer } from "./rest-timer";
import {
	endSession,
	type SessionWorkspace,
	savedRestDefault,
	useWorkspace,
	workspaceStore,
} from "./session-workspace";

export function SessionSync({
	subject,
	sessionId,
}: {
	subject: string;
	sessionId: Id<"workoutSessions">;
}) {
	const workspace = useWorkspace(subject, sessionId);
	const { key, plan, data, session, sets, getFacts, active, held, factsById } =
		workspace;
	const rest = useRestTimer();
	useEffect(() => {
		if (!key || !session || !sets || !active || !data.verified || held) return;
		const exercises = (session.exercises ?? []).map((item) => ({
			exerciseId: item.exerciseId as string,
			plannedSets: item.plannedSets,
		}));
		const current = workspaceStore.plan(key);
		const next = current
			? reconcilePlan(
					current,
					exercises,
					sets,
					getFacts,
					workspaceStore.seen(key) ?? undefined,
				)
			: seedPlan(exercises, sets, getFacts, savedRestDefault(subject));
		workspaceStore.markSeen(
			key,
			sets.map((set) => set._id),
		);
		workspaceStore.setPlan(key, next);
	}, [key, subject, session, sets, active, data.verified, held, getFacts]);
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
	// A clock reads from its end time, so a lock or restart can't leave it behind.
	useEffect(() => {
		if (!key) return;
		const tick = () =>
			workspaceStore.update(key, (p) => tickClocks(p, Date.now()));
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, [key]);
	// Finished or cancelled on another device.
	const endedElsewhere = Boolean(
		workspace.own && session && session.status !== "active" && plan,
	);
	useEffect(() => {
		if (endedElsewhere) endSession(key, rest);
	}, [endedElsewhere, key, rest]);
	useAttemptReceipts(workspace);
	return null;
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
