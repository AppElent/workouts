/** Everything a person can do to a session, wired to the plan and the server. */
import type { ExerciseId } from "@foundry/core/exercises";
import { useConvex, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback, useMemo } from "react";
import { ActionSheetIOS, Platform } from "react-native";
import { api, type Id } from "../../../convex/api";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { convexErrorMessage, useConfirm } from "../../../ui/confirm-dialog";
import { useRestTimer } from "../components/rest-timer";
import { formatOneRm, formatSetFull, formatSetShort } from "../session-format";
import {
	addExerciseToPlan,
	addToGroup,
	allRows,
	beginAttempt,
	canSwap,
	closeOpenClocks,
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
	pendingManuals,
	removeExercise,
	removeRow,
	restAfterLog,
	restoreRows,
	rowOneRepMax,
	runningGroup,
	type SessionPlan,
	sessionExercises,
	shownLoad,
	swapExercise,
	typoCheck,
	updateRow,
} from "../session-plan";
import {
	factsFrom,
	type RawReferences,
	type SessionWorkspace,
	workspaceStore,
} from "./session-workspace";
import { newLogOperationId } from "./set-drafts";

const STUCK_MS = 8000;
export type EditorRequest = (rowId: string) => void;
export type ActionChoice = { label: string; destructive?: boolean };
/** A native action sheet where there is one, a confirm dialog elsewhere. */
export function useChoice() {
	const confirm = useConfirm();
	return useCallback(
		async (input: {
			title: string;
			message?: string;
			confirm: ActionChoice;
			cancel: string;
		}) => {
			if (Platform.OS !== "ios")
				return confirm({
					title: input.title,
					message: input.message ?? "",
					confirmLabel: input.confirm.label,
					cancelLabel: input.cancel,
					destructive: input.confirm.destructive,
				});
			return new Promise<boolean>((resolve) => {
				ActionSheetIOS.showActionSheetWithOptions(
					{
						title: input.title,
						message: input.message,
						options: [input.confirm.label, input.cancel],
						cancelButtonIndex: 1,
						...(input.confirm.destructive ? { destructiveButtonIndex: 0 } : {}),
					},
					(index) => resolve(index === 0),
				);
			});
		},
		[confirm],
	);
}

export function useSessionActions(workspace: SessionWorkspace) {
	const { key, sessionId, getFacts, nameOf, online } = workspace;
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
			const template = (copy.notes as Record<string, string>)[note.code] ?? "";
			return fmt(template, { name: name ?? "", ...(note.values ?? {}) });
		};
		const snapshotUndo = (before: SessionPlan) => ({
			undoLabel: copy.undo,
			undo: () => set(before),
		});
		/** Applies a local action. Refusals explain themselves; changes can be undone. */
		const apply = (
			result: PlanResult,
			options: { name?: string; undoable?: boolean } = {},
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
					options.undoable === false ? {} : snapshotUndo(before),
				);
			return true;
		};
		const blocked = () => {
			if (online) return false;
			say(copy.blockedOffline);
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
		function afterLogged(row: PlanSet, setId: string, setNumber: number) {
			const facts = getFacts(row.exerciseId);
			const before = plan();
			const seconds = restAfterLog(before, row.id);
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
						value: Math.round(record.value),
						was: Math.round(record.was as number),
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
				undo: async () => {
					set(restoreRows(plan(), result.prior.map(cleanForUndo)));
					rest.restore(previousRest);
					await workspaceStore.hold(key, async () => {
						try {
							await removeSetMutation({ id: setId as Id<"sets"> });
						} catch (error) {
							set(result.plan);
							say(convexErrorMessage(error, saveError));
						}
					});
				},
			});
		}
		const cleanForUndo = (row: PlanSet): PlanSet => ({
			...row,
			attempt: undefined,
			failed: undefined,
		});
		async function send(rowId: string) {
			const row = findRow(plan(), rowId);
			if (!row || row.done) return;
			const attempted = beginAttempt(plan(), rowId, newLogOperationId());
			const attempt = attempted?.attempt;
			if (!attempted || !attempt || !sessionId) return;
			set(updateRow(plan(), rowId, attempted));
			const inFlight = workspaceStore.inFlight(key);
			inFlight.add(attempt.operationId);
			const failNow = (keep: boolean, message: string) => {
				if (findRow(plan(), rowId)?.done) return;
				set(markFailed(plan(), rowId, keep));
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
			const stuck = setTimeout(() => failNow(true, offlineText()), STUCK_MS);
			try {
				const { exerciseId, ...payload } = attempt.payload;
				const setId = await addSetMutation({
					sessionId,
					exerciseId: exerciseId as ExerciseId,
					...payload,
					operationId: attempt.operationId,
				});
				clearTimeout(stuck);
				const latest = findRow(plan(), rowId);
				if (latest) afterLogged(latest, setId, attempt.setNumber);
			} catch (error) {
				clearTimeout(stuck);
				if (error instanceof ConvexError)
					failNow(
						false,
						convexErrorMessage(
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
				set(markFailed(plan(), rowId, Boolean(row.attempt)));
				const count = failedRows(plan()).length;
				haptics.sessionWarning();
				const seconds = restAfterLog(plan(), rowId);
				if (seconds !== null && rest.current() === null)
					rest.start(seconds, restBody());
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
			for (const row of failedRows(plan())) await send(row.id);
		}
		async function setLogged(rowId: string, draft: PlanSet) {
			if (blocked()) return false;
			const stored = findRow(plan(), rowId);
			if (!stored?.setId) return false;
			const weight =
				draft.unit === "lbs"
					? shownLoad(draft)
					: Math.round(draft.kg * 1e6) / 1e6;
			const before = plan();
			const sameLoad = Math.abs(draft.kg - stored.kg) < 0.01;
			const facts = getFacts(draft.exerciseId);
			const next: PlanSet = {
				...draft,
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
				set(before);
				say(convexErrorMessage(error, saveError));
				return false;
			}
		}
		/** Takes a logged set back to open, with its values intact. */
		async function unlog(rowId: string) {
			if (blocked()) return;
			const row = findRow(plan(), rowId);
			if (!row?.setId) return;
			const before = plan();
			const open: PlanSet = {
				...row,
				done: false,
				setId: undefined,
				setNumber: undefined,
				loggedPercent: undefined,
			};
			set(updateRow(before, rowId, open));
			await workspaceStore.hold(key, async () => {
				try {
					await removeSetMutation({ id: row.setId as Id<"sets"> });
					say(fmt(copy.toastUnchecked, { load: shortLoad(row) }));
				} catch (error) {
					set(before);
					say(convexErrorMessage(error, saveError));
				}
			});
		}
		async function deleteRow(rowId: string) {
			const row = findRow(plan(), rowId);
			if (!row) return;
			const before = plan();
			if (!row.setId) {
				set(removeRow(before, rowId));
				say(copy.toastRemoved, snapshotUndo(before));
				return;
			}
			if (blocked()) return;
			await workspaceStore.hold(key, async () => {
				try {
					await removeSetMutation({ id: row.setId as Id<"sets"> });
					set(removeRow(plan(), rowId));
					say(copy.toastRemoved);
				} catch (error) {
					say(convexErrorMessage(error, saveError));
				}
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
					?.references as RawReferences | undefined,
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
				say(convexErrorMessage(error, saveError));
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
			try {
				const id = await createExercise({
					name,
					muscleGroups: [],
					category: "compound",
					equipment: bodyweight ? "bodyweight" : "other",
				} as never);
				if (forSwap) return swap(forSwap, id as string, name);
				if (groupId) return addExerciseToGroup(groupId, id as string, name);
				return addExercise(id as string, openEditor, name);
			} catch (error) {
				say(convexErrorMessage(error, saveError));
				return false;
			}
		}
		async function swap(from: string, to: string, name?: string) {
			if (blocked() || !sessionId) return false;
			const label = name ?? nameOf(to);
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
					return apply(swapExercise(plan(), from, to, facts), { name: label });
				});
			} catch (error) {
				say(convexErrorMessage(error, saveError));
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
					say(convexErrorMessage(error, saveError));
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
				return true;
			} catch (error) {
				say(convexErrorMessage(error, saveError));
				return false;
			}
		}
		async function cancelSession(flush: boolean) {
			if (blocked() || !sessionId) return false;
			try {
				if (flush) await flushManuals();
				await cancelMutation({ id: sessionId });
				return true;
			} catch (error) {
				say(convexErrorMessage(error, saveError));
				return false;
			}
		}
		return {
			plan,
			set,
			say,
			apply,
			noteText,
			snapshotUndo,
			blocked,
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
			stopRest: rest.stop,
			closeClocks: () => closeOpenClocks(plan()),
			runningGroup: () => runningGroup(plan()),
		};
	}, [
		key,
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
	]);
}
export type SessionActions = ReturnType<typeof useSessionActions>;
