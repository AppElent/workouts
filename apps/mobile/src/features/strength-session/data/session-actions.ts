/** Everything a person can do to a session, wired to the plan and the server. */
import type { ExerciseId } from "@foundry/core/exercises";
import { useConvex, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo } from "react";
import { api, type Id } from "../../../convex/api";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { useConvexErrorMessage } from "../../../i18n/errors";
import { formatOneRm, formatSetFull, formatSetShort } from "../session-format";
import {
	addExerciseToPlan,
	addToGroup,
	allRows,
	beginAttempt,
	canSwap,
	closeGroup,
	type ExerciseFacts,
	failedRows,
	findRow,
	groupOfRow,
	isValidRow,
	markFailed,
	markLogged,
	newRecordFor,
	nextOpenRow,
	type PlanNote,
	type PlanResult,
	type PlanSet,
	payloadFor,
	pendingManuals,
	removeExercise,
	removeRow,
	restAfterLog,
	restoreRows,
	rowOneRepMax,
	rowsOf,
	runningGroup,
	type SessionPlan,
	sessionExercises,
	startClock,
	stopClock,
	swapExercise,
	typoCheck,
	updateRow,
} from "../session-plan";
import { useRestTimer } from "./rest-timer";
import { cancelClockAlert, scheduleClockAlert } from "./session-notifications";
import {
	endSession,
	factsFrom,
	type SessionWorkspace,
	saveRestDefault,
	workspaceStore,
} from "./session-workspace";

export type EditorRequest = (rowId: string) => void;
function newLogOperationId() {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`set-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
	);
}

export function useSessionActions(workspace: SessionWorkspace) {
	const errorMessage = useConvexErrorMessage();
	const { key, subject, sessionId, getFacts, nameOf, online } = workspace;
	const { locale, t } = useI18n();
	const copy = t.strength.plan;
	const saveError = t.strength.saveError;
	const rest = useRestTimer();
	const convex = useConvex();
	const addSetMutation = useMutation(api.sets.add);
	const updateSetMutation = useMutation(api.sets.update);
	const removeSetMutation = useMutation(api.sets.remove);
	const addExerciseMutation = useMutation(api.workoutSessions.addExercise);
	const finishMutation = useMutation(api.workoutSessions.finish);
	const cancelMutation = useMutation(api.workoutSessions.cancel);
	const addManualMutation = useMutation(api.oneRepMaxes.addManual);
	const createExercise = useMutation(api.exercises.create);
	return useMemo(() => {
		const plan = () => workspaceStore.plan(key) as SessionPlan;
		const set = (next: SessionPlan) => workspaceStore.setPlan(key, next);
		const notify = workspaceStore.notify.bind(null, key);
		const say = (
			text: string,
			extra: Partial<Parameters<typeof notify>[0]> = {},
		) => notify({ text, ...(extra as object) });
		const noteText = (note: PlanNote, name?: string) => {
			const template: string | { one: string; other: string } | undefined = (
				copy.notes as Record<string, string | { one: string; other: string }>
			)[note.code];
			const text =
				typeof template === "object"
					? plural(locale, Number(note.values?.count ?? 0), template)
					: (template ?? "");
			return fmt(text, { name: name ?? "", ...(note.values ?? {}) });
		};
		/** Call after the change: a snapshot can only undo what came last. */
		const snapshotUndo = (before: SessionPlan, added?: string) => {
			const after = plan();
			return {
				undoLabel: copy.undo,
				undo: () => {
					if (plan() !== after) {
						say(copy.undoStale);
						return;
					}
					// The server keeps an added exercise, so undo has to keep it out of the plan.
					set(
						added
							? { ...before, removed: [...new Set([...before.removed, added])] }
							: before,
					);
				},
			};
		};
		/** Applies a local action. Refusals explain themselves; changes can be undone. */
		const apply = (
			result: PlanResult,
			options: { name?: string; undoable?: boolean; added?: string } = {},
		) => {
			const before = plan();
			if (result.refused) {
				if (result.note) say(noteText(result.note, options.name));
				return false;
			}
			set(result.plan);
			if (result.note)
				say(
					noteText(result.note, options.name),
					options.undoable === false ? {} : snapshotUndo(before, options.added),
				);
			return true;
		};
		const blocked = () => {
			if (online) return false;
			say(copy.blockedOffline);
			return true;
		};
		/** Says so when any of these rows is still being sent. */
		const refuseSending = (rows: PlanSet[]) => {
			const inFlight = workspaceStore.inFlight(key);
			if (
				!rows.some(
					(row) => row.attempt && inFlight.has(row.attempt.operationId),
				)
			)
				return false;
			say(copy.blockedBusy);
			return true;
		};
		/** Only the receipt can say a send didn't land, so these rows stay until it does. */
		const refuseUnresolved = (rows: PlanSet[]) => {
			if (refuseSending(rows)) return true;
			if (!rows.some((row) => row.attempt && !row.done)) return false;
			say(copy.editor.lockedUnknown);
			return true;
		};
		/** Failed rows must be retried or removed, never dropped along with something else. */
		const refusePending = (rows: PlanSet[]) => {
			if (refuseSending(rows)) return true;
			const failed = rows.filter(
				(row) => (row.failed || row.attempt) && !row.done,
			).length;
			if (!failed) return false;
			say(plural(locale, failed, copy.finish.failedBlocked), {
				retryLabel: copy.retryAll,
				retry: () => void retryFailed(),
			});
			return true;
		};
		const shortLoad = (row: PlanSet) =>
			formatSetShort(row, getFacts(row.exerciseId).bodyweight, locale);
		function restBody() {
			const next = nextOpenRow(plan());
			if (!next) return undefined;
			const rows = allRows(plan()).filter(
				(row) => row.exerciseId === next.exerciseId && row.kind !== "warmup",
			);
			const number = rows.findIndex((row) => row.id === next.id) + 1;
			return fmt(copy.rest.notificationNext, {
				name: nameOf(next.exerciseId),
				number: Math.max(number, 1),
			});
		}
		function restIfIdle(rowId: string) {
			const seconds = restAfterLog(plan(), rowId);
			const current = rest.current();
			if (seconds !== null && (current === null || current <= Date.now()))
				rest.start(seconds, restBody());
		}
		function afterLogged(
			row: PlanSet,
			setId: string,
			setNumber: number,
			startRest: boolean,
		) {
			const facts = getFacts(row.exerciseId);
			const before = plan();
			const seconds = startRest ? restAfterLog(before, row.id) : null;
			const record = newRecordFor(before, { ...row, done: true }, facts);
			const result = markLogged(before, row.id, setId, setNumber, facts);
			set(result.plan);
			const previousRest = rest.current();
			if (seconds !== null) rest.start(seconds, restBody());
			if (record) haptics.sessionSuccess();
			else haptics.setLogged();
			const rm = rowOneRepMax(row, facts.bodyweight);
			const load = shortLoad(row);
			let text: string;
			if (record?.kind === "measured")
				text =
					record.was === null
						? fmt(copy.toastNewMeasuredFirst, {
								value: formatOneRm(record.value, row.unit, locale),
							})
						: fmt(copy.toastNewMeasured, {
								value: formatOneRm(record.value, row.unit, locale),
								was: formatOneRm(record.was, row.unit, locale),
							});
			else if (record?.kind === "estimated")
				text =
					fmt(copy.toastNewEstimated, {
						value: formatOneRm(record.value, row.unit, locale),
						was: formatOneRm(record.was as number, row.unit, locale),
					}) + (row.reps > 10 ? copy.toastLessReliable : "");
			else if (rm)
				text = fmt(copy.toastOneRm, {
					load,
					oneRm: formatOneRm(rm.value, row.unit, locale),
				});
			else if (facts.bodyweight) text = fmt(copy.toastLogged, { load });
			else text = fmt(copy.toastNoOneRm, { load });
			if (result.carriedTo !== null)
				text += fmt(copy.toastCarried, {
					load: formatSetFull({ ...row, reps: row.reps }, false, locale).split(
						" × ",
					)[0] as string,
				});
			say(text, {
				highlight: Boolean(record),
				undoLabel: copy.undo,
				undo: () =>
					removeLogged(setId, () => {
						set(restoreRows(plan(), result.prior.map(cleanForUndo)));
						rest.restore(previousRest);
					}),
			});
		}
		/** A logged row stays as it is until the server lets go, so nothing can be typed over it. */
		async function removeLogged(setId: string, removed: () => void) {
			const inFlight = workspaceStore.inFlight(key);
			const marker = `remove:${setId}`;
			if (inFlight.has(marker)) return;
			inFlight.add(marker);
			try {
				await workspaceStore.hold(key, async () => {
					try {
						await removeSetMutation({ id: setId as Id<"sets"> });
						removed();
					} catch (error) {
						say(errorMessage(error, saveError));
					}
				});
			} finally {
				inFlight.delete(marker);
			}
		}
		const cleanForUndo = (row: PlanSet): PlanSet => ({
			...row,
			attempt: undefined,
			failed: undefined,
		});
		async function send(rowId: string) {
			const row = findRow(plan(), rowId);
			if (!row || row.done) return;
			const inFlight = workspaceStore.inFlight(key);
			if (row.attempt && inFlight.has(row.attempt.operationId)) return;
			// A retry comes long after the set itself, so it never starts rest.
			const fresh = !row.failed;
			const attempted = beginAttempt(plan(), rowId, newLogOperationId());
			const attempt = attempted?.attempt;
			if (!attempted || !attempt || !sessionId) return;
			set(updateRow(plan(), rowId, attempted));
			inFlight.add(attempt.operationId);
			const failNow = (keep: boolean, message: string) => {
				const current = findRow(plan(), rowId);
				if (current?.done) return;
				const firstFailure = fresh && !current?.failed;
				set(markFailed(plan(), rowId, keep));
				if (keep && firstFailure) restIfIdle(rowId);
				haptics.sessionWarning();
				say(message, {
					retryLabel: copy.retryAll,
					retry: () => void retryFailed(),
				});
			};
			const offlineText = () => {
				const count = failedRows(plan()).length + 1;
				return count > 1
					? fmt(copy.toastFailedMany, { count })
					: fmt(copy.toastFailedOne, { load: shortLoad(row) });
			};
			try {
				const { exerciseId, ...payload } = attempt.payload;
				const setId = await addSetMutation({
					sessionId,
					exerciseId: exerciseId as ExerciseId,
					...payload,
					operationId: attempt.operationId,
				});
				const latest = findRow(plan(), rowId);
				if (latest)
					afterLogged(
						latest,
						setId,
						attempt.setNumber,
						fresh && !latest.failed,
					);
			} catch (error) {
				if (error instanceof ConvexError)
					failNow(
						false,
						errorMessage(
							error,
							fmt(copy.toastFailedServer, { load: shortLoad(row) }),
						),
					);
				else failNow(true, offlineText());
			} finally {
				inFlight.delete(attempt.operationId);
			}
		}
		/** Opens the editor instead of logging when a set isn't ready. */
		function logRow(rowId: string, openEditor: EditorRequest) {
			const current = plan();
			const row = findRow(current, rowId);
			if (!row || row.done) return;
			if (
				row.attempt &&
				workspaceStore.inFlight(key).has(row.attempt.operationId)
			) {
				say(copy.blockedBusy);
				return;
			}
			const group = groupOfRow(current, rowId);
			if (group?.mode === "amrap" && group.state === "idle") {
				say(copy.blockedStartClock);
				return;
			}
			const facts = getFacts(row.exerciseId);
			if (!isValidRow(row, facts) || typoCheck(current, row, facts, row)) {
				openEditor(rowId);
				return;
			}
			logReady(rowId);
		}
		/** Logs a set the editor already validated and confirmed. */
		function logReady(rowId: string) {
			const row = findRow(plan(), rowId);
			if (!row) return;
			if (!online) {
				const firstFailure = !row.failed;
				set(markFailed(plan(), rowId, Boolean(row.attempt)));
				const count = failedRows(plan()).length;
				haptics.sessionWarning();
				if (firstFailure) restIfIdle(rowId);
				say(
					count > 1
						? fmt(copy.toastFailedMany, { count })
						: fmt(copy.toastFailedOne, { load: shortLoad(row) }),
					{ retryLabel: copy.retryAll, retry: () => void retryFailed() },
				);
				return;
			}
			void send(rowId);
		}
		async function retryFailed() {
			if (blocked()) return;
			const inFlight = workspaceStore.inFlight(key);
			// After a restart a send can be unresolved without having failed here.
			const rows = allRows(plan()).filter(
				(row) => !row.done && (row.failed || row.attempt),
			);
			const sending = (row: PlanSet) =>
				Boolean(row.attempt && inFlight.has(row.attempt.operationId));
			if (rows.some(sending)) say(copy.blockedBusy);
			for (const row of rows) if (!sending(row)) await send(row.id);
		}
		async function setLogged(rowId: string, draft: PlanSet) {
			if (blocked()) return false;
			const stored = findRow(plan(), rowId);
			if (!stored?.setId) return false;
			const { weight } = payloadFor(draft, stored.setNumber ?? 0);
			const sameLoad = Math.abs(draft.kg - stored.kg) < 0.01;
			const facts = getFacts(draft.exerciseId);
			const next: PlanSet = {
				...draft,
				done: true,
				setId: stored.setId,
				setNumber: stored.setNumber,
				loggedPercent: sameLoad ? stored.loggedPercent : undefined,
			};
			try {
				await workspaceStore.hold(key, async () => {
					await updateSetMutation({
						id: stored.setId as Id<"sets">,
						reps: draft.reps,
						weight,
						unit: draft.unit,
						rpe: draft.rpe,
						setType: draft.kind,
					});
					set(updateRow(plan(), rowId, next));
				});
				const rm = rowOneRepMax(draft, facts.bodyweight);
				say(
					rm
						? fmt(copy.toastEdited, {
								oneRm: formatOneRm(rm.value, draft.unit, locale),
							})
						: fmt(copy.toastEditedPlain, { load: shortLoad(draft) }),
				);
				return true;
			} catch (error) {
				say(errorMessage(error, saveError));
				return false;
			}
		}
		/** Takes a logged set back to open, with its values intact. */
		async function unlog(rowId: string) {
			if (blocked()) return;
			const row = findRow(plan(), rowId);
			if (!row?.setId) return;
			await removeLogged(row.setId, () => {
				const current = findRow(plan(), rowId) ?? row;
				set(
					updateRow(plan(), rowId, {
						...current,
						done: false,
						setId: undefined,
						setNumber: undefined,
						loggedPercent: undefined,
					}),
				);
				workspaceStore.setDraft(key, rowId, null);
				say(fmt(copy.toastUnchecked, { load: shortLoad(row) }));
			});
		}
		async function deleteRow(rowId: string) {
			const row = findRow(plan(), rowId);
			if (!row) return;
			// A send that may have landed would bring the row back once it's gone.
			if (refuseUnresolved([row])) return;
			const before = plan();
			if (!row.setId) {
				set(removeRow(before, rowId));
				say(copy.toastRemoved, snapshotUndo(before));
				return;
			}
			if (blocked()) return;
			await removeLogged(row.setId, () => {
				set(removeRow(plan(), rowId));
				say(copy.toastRemoved);
			});
		}
		/** Reads what a new exercise's plan needs: its references and last result. */
		async function factsForNew(exerciseId: string): Promise<ExerciseFacts> {
			if (!sessionId) return getFacts(exerciseId);
			const [session, last, exercise] = await Promise.all([
				convex.query(api.workoutSessions.getById, { id: sessionId }),
				convex.query(api.sets.getLastForExercise, {
					exerciseId,
					excludeSessionId: sessionId,
				}),
				workspace.catalog.find((item) => item._id === exerciseId) ??
					convex.query(api.exercises.getById, { id: exerciseId }),
			]);
			return factsFrom(
				exercise ?? undefined,
				session?.exercises?.find((item) => item.exerciseId === exerciseId)
					?.references,
				last,
			);
		}
		async function addExercise(
			exerciseId: string,
			openEditor?: EditorRequest,
			name?: string,
		) {
			if (blocked() || !sessionId) return false;
			const label = name ?? nameOf(exerciseId);
			if (sessionExercises(plan()).includes(exerciseId)) {
				say(fmt(copy.notes.alreadyInSession, { name: label }));
				return false;
			}
			try {
				return await workspaceStore.hold(key, async () => {
					await addExerciseMutation({
						sessionId,
						exerciseId: exerciseId as ExerciseId,
					});
					const facts = await factsForNew(exerciseId);
					const result = addExerciseToPlan(plan(), exerciseId, facts);
					if (!apply(result, { name: label })) return false;
					if (result.rowId && openEditor) {
						const row = findRow(plan(), result.rowId);
						if (row?.blank) openEditor(result.rowId);
					}
					return true;
				});
			} catch (error) {
				say(errorMessage(error, saveError));
				return false;
			}
		}
		async function createAndAdd(
			name: string,
			bodyweight: boolean,
			forSwap?: string,
			groupId?: string,
			openEditor?: EditorRequest,
		) {
			if (blocked()) return false;
			if (forSwap && refusePending(rowsOf(plan(), forSwap))) return false;
			try {
				const id = await createExercise({
					name,
					muscleGroups: [],
					category: "compound",
					equipment: bodyweight ? "bodyweight" : "other",
				});
				if (forSwap) return swap(forSwap, id, name);
				if (groupId) return addExerciseToGroup(groupId, id, name);
				return addExercise(id, openEditor, name);
			} catch (error) {
				say(errorMessage(error, saveError));
				return false;
			}
		}
		async function swap(from: string, to: string, name?: string) {
			if (blocked() || !sessionId) return false;
			const label = name ?? nameOf(to);
			if (refusePending(rowsOf(plan(), from))) return false;
			const check = canSwap(plan(), from, to);
			if (!check.ok) {
				say(noteText({ code: check.code as string }, label));
				return false;
			}
			try {
				return await workspaceStore.hold(key, async () => {
					await addExerciseMutation({
						sessionId,
						exerciseId: to as ExerciseId,
					});
					const facts = await factsForNew(to);
					return apply(swapExercise(plan(), from, to, facts), {
						name: label,
						added: sessionExercises(plan()).includes(to) ? undefined : to,
					});
				});
			} catch (error) {
				say(errorMessage(error, saveError));
				return false;
			}
		}
		async function addExerciseToGroup(
			groupId: string,
			exerciseId: string,
			name?: string,
		) {
			if (blocked() || !sessionId) return false;
			const label = name ?? nameOf(exerciseId);
			if (!sessionExercises(plan()).includes(exerciseId)) {
				const added = await addExercise(exerciseId, undefined, label);
				if (!added) return false;
			}
			return apply(addToGroup(plan(), groupId, exerciseId), { name: label });
		}
		async function dropExercise(exerciseId: string) {
			if (refuseUnresolved(rowsOf(plan(), exerciseId))) return;
			const result = removeExercise(plan(), exerciseId);
			const label = nameOf(exerciseId);
			if (result.refused) {
				if (result.note) say(noteText(result.note, label));
				return;
			}
			if (result.setIds.length === 0) {
				apply(result, { name: label });
				return;
			}
			if (blocked()) return;
			await workspaceStore.hold(key, async () => {
				try {
					for (const id of result.setIds)
						await removeSetMutation({ id: id as Id<"sets"> });
					set(removeExercise(plan(), exerciseId).plan);
					if (result.note) say(noteText(result.note, label));
				} catch (error) {
					say(errorMessage(error, saveError));
				}
			});
		}
		async function flushManuals() {
			for (const { exerciseId, value } of pendingManuals(plan()))
				await addManualMutation({
					exerciseId: exerciseId as ExerciseId,
					value,
					unit: "kg",
				});
		}
		async function finishSession() {
			if (blocked() || !sessionId) return false;
			try {
				await flushManuals();
				await finishMutation({ id: sessionId, discardUnfinished: true });
				endSession(key, rest);
				return true;
			} catch (error) {
				say(errorMessage(error, saveError));
				return false;
			}
		}
		async function cancelSession(flush: boolean) {
			if (blocked() || !sessionId) return false;
			// Ending here would throw away the only way to find out if a send landed.
			if (refuseUnresolved(allRows(plan()))) return false;
			try {
				if (flush) await flushManuals();
				await cancelMutation({ id: sessionId });
				endSession(key, rest);
				return true;
			} catch (error) {
				say(errorMessage(error, saveError));
				return false;
			}
		}
		/** Starts or resumes an AMRAP clock, with an alert for when it runs out. */
		function startGroupClock(groupId: string) {
			const result = startClock(plan(), groupId, Date.now());
			if (!apply(result, { undoable: false })) return;
			const group = result.plan.groups[groupId];
			if (group)
				scheduleClockAlert(
					group,
					copy.rest.clockNotificationTitle,
					copy.rest.clockNotificationBody,
				);
		}
		function stopGroupClock(groupId: string) {
			set(stopClock(plan(), groupId, Date.now()));
			cancelClockAlert(groupId);
		}
		function closeGroupClock(groupId: string) {
			const group = plan().groups[groupId];
			if (!group || refusePending(group.rounds.flatMap((round) => round.items)))
				return;
			set(closeGroup(plan(), groupId));
			cancelClockAlert(groupId);
		}
		/** This session's rest, and the one the next session starts with. */
		function setRestDefault(seconds: number) {
			set({ ...plan(), restDefault: seconds });
			if (subject) saveRestDefault(subject, seconds);
		}
		return {
			plan,
			set,
			say,
			apply,
			noteText,
			snapshotUndo,
			blocked,
			refusePending,
			refuseUnresolved,
			logRow,
			logReady,
			retryFailed,
			setLogged,
			unlog,
			deleteRow,
			addExercise,
			createAndAdd,
			swap,
			addExerciseToGroup,
			dropExercise,
			finishSession,
			cancelSession,
			startGroupClock,
			stopGroupClock,
			closeGroupClock,
			setRestDefault,
			stopRest: rest.stop,
			runningGroup: () => runningGroup(plan()),
		};
	}, [
		key,
		subject,
		sessionId,
		getFacts,
		nameOf,
		online,
		locale,
		copy,
		saveError,
		rest,
		convex,
		addSetMutation,
		updateSetMutation,
		removeSetMutation,
		addExerciseMutation,
		finishMutation,
		cancelMutation,
		addManualMutation,
		createExercise,
		workspace.catalog,
		errorMessage,
	]);
}
export type SessionActions = ReturnType<typeof useSessionActions>;
