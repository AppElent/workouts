import { convertLoad, getWeightStep } from "@workouts/core";
import type { ExerciseId } from "@workouts/core/exercises";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { api, type Id } from "../../convex/api";
import { useExercise } from "../../data/exercises";
import { useI18n } from "../../i18n";
import { convexErrorMessage, useConfirm } from "../../ui/confirm-dialog";
import { useRestTimer } from "../../ui/rest-timer";
import { useToast } from "../../ui/toast";
import {
	newLogOperationId,
	type SetFields,
	useSetDrafts,
} from "./data/set-drafts";
import { useSetHistory } from "./data/use-set-history";
import {
	type SessionSet,
	useStrengthSession,
} from "./data/use-strength-session";

export function fieldsForSet(
	set: Pick<SessionSet, "weight" | "reps" | "rpe" | "unit" | "setType">,
): SetFields {
	return {
		weight: String(set.weight),
		reps: String(set.reps),
		rpe: set.rpe === undefined ? "" : String(set.rpe),
		unit: set.unit,
		setType: set.setType,
	};
}
export function parseSetFields(fields: SetFields) {
	const weight = Number(fields.weight.replace(",", "."));
	const reps = Number(fields.reps);
	const rpe =
		fields.rpe.trim() === "" ? undefined : Number(fields.rpe.replace(",", "."));
	if (
		!fields.weight.trim() ||
		!Number.isFinite(weight) ||
		weight < 0 ||
		weight > 2000 ||
		!fields.reps.trim() ||
		!Number.isInteger(reps) ||
		reps < 0 ||
		reps > 1000 ||
		(rpe !== undefined &&
			(!Number.isFinite(rpe) ||
				rpe < 1 ||
				rpe > 10 ||
				!Number.isInteger(rpe * 2)))
	)
		return null;
	return { weight, reps, rpe, unit: fields.unit, setType: fields.setType };
}
type EditorParams = { sessionId: string; exerciseId: string; setId?: string };
function useEditor(params: EditorParams) {
	const sessionId = params.sessionId as Id<"workoutSessions">;
	const exerciseId = params.exerciseId as ExerciseId;
	const savedId = params.setId as Id<"sets"> | undefined;
	const router = useRouter();
	const navigation = useNavigation();
	const {
		t: { strength: copy },
	} = useI18n();
	const toast = useToast();
	const confirm = useConfirm();
	const rest = useRestTimer();
	const store = useSetDrafts();
	const data = useStrengthSession(sessionId);
	const exercise = useExercise(exerciseId);
	const add = useMutation(api.sets.add);
	const update = useMutation(api.sets.update);
	const remove = useMutation(api.sets.remove);
	const draft = savedId ? undefined : store.get(sessionId, exerciseId);
	const history = useSetHistory(
		sessionId,
		exerciseId,
		draft?.attempt?.operationId,
	);
	const { last, receipt } = history;
	const [fields, setFields] = useState<SetFields | null>(
		() => draft?.fields ?? null,
	);
	const initial = useRef<SetFields | null>(null);
	const [leaving, setLeaving] = useState(false);
	const afterLeave = useRef<(() => void) | null>(null);
	const busy = store.busy.has(sessionId);
	const session = data.session instanceof Error ? undefined : data.session;
	const sets = Array.isArray(data.sets) ? data.sets : undefined;
	const saved = savedId
		? sets?.find((set) => set._id === savedId && set.exerciseId === exerciseId)
		: undefined;
	const member = session?.exercises?.find(
		(item) => item.exerciseId === exerciseId,
	);
	const bodyweight = exercise?.equipment === "bodyweight";
	const own = session?.userId === store.subject;
	const active = own && session?.status === "active";
	const writable = Boolean(
		own &&
			(savedId ? saved : active) &&
			data.verified &&
			sets &&
			data.online &&
			!store.storageError,
	);
	const locked = busy || Boolean(draft?.attempt);
	const dirty = Boolean(
		savedId &&
			initial.current &&
			fields &&
			JSON.stringify(fields) !== JSON.stringify(initial.current),
	);
	const nextNumber =
		(sets ?? [])
			.filter((set) => set.exerciseId === exerciseId)
			.reduce((max, set) => Math.max(max, set.setNumber), 0) + 1;
	const stepKg = exercise
		? getWeightStep(exercise.equipment, exercise.weightIncrement)
		: 2.5;
	const step = convertLoad(stepKg, "kg", fields?.unit ?? "kg");

	useEffect(() => {
		if (fields || !exercise || store.storageError) return;
		if (savedId) {
			if (!saved || !own) return;
			initial.current = fieldsForSet(saved);
			if (bodyweight) {
				initial.current.weight = String(
					convertLoad(saved.weight, saved.unit, "kg"),
				);
				initial.current.unit = "kg";
			}
			setFields(initial.current);
			return;
		}
		if (!active || !sets) return;
		const target =
			member?.plannedSets[
				sets.filter((set) => set.exerciseId === exerciseId).length
			];
		const source = target ?? last;
		if (!source && last === undefined) return;
		const seeded: SetFields = {
			weight: String(
				source ? convertLoad(source.weight, source.unit, "kg") : 0,
			),
			reps: String(source?.reps ?? 8),
			unit: "kg",
			rpe: "",
			setType: "working",
		};
		try {
			store.put({ sessionId, exerciseId, fields: seeded });
			setFields(seeded);
		} catch {
			toast.error(copy.storageError);
		}
	}, [
		fields,
		exercise,
		savedId,
		saved,
		own,
		active,
		sets,
		member,
		last,
		store,
		sessionId,
		exerciseId,
		toast,
		copy.storageError,
		bodyweight,
	]);

	const leave = useCallback(
		(action: () => void = () => router.back()) => {
			afterLeave.current = action;
			setLeaving(true);
		},
		[router],
	);
	usePreventRemove((dirty || busy) && !leaving, ({ data: event }) => {
		if (busy) return;
		void confirm({
			title: copy.discardTitle,
			message: copy.discardMessage,
			confirmLabel: copy.discard,
			cancelLabel: copy.keepEditing,
			destructive: true,
		}).then((discard) => {
			if (discard) leave(() => navigation.dispatch(event.action));
		});
	});
	useEffect(() => {
		if (leaving && afterLeave.current) {
			const action = afterLeave.current;
			afterLeave.current = null;
			action();
		}
	}, [leaving]);
	// Receipt recovery never replays a write. A committed Log, even subsequently deleted,
	// consumes this operation identity so a restart cannot resurrect it as a new set.
	useEffect(() => {
		if (!draft?.attempt || !receipt || busy || leaving) return;
		try {
			store.remove(sessionId, exerciseId);
			toast.success(copy.recovered);
			leave();
		} catch {
			toast.error(copy.storageError);
		}
	}, [
		leave,
		draft?.attempt,
		receipt,
		busy,
		leaving,
		store,
		sessionId,
		exerciseId,
		toast,
		copy.recovered,
		copy.storageError,
	]);

	function change(patch: Partial<SetFields>) {
		if (!fields || locked || leaving) return;
		const next = { ...fields, ...patch };
		try {
			if (!savedId) store.put({ sessionId, exerciseId, fields: next });
			setFields(next);
		} catch {
			toast.error(copy.storageError);
		}
	}
	async function submit() {
		if (!fields || busy || !writable) {
			if (!busy) toast.error(copy.unavailableHint);
			return;
		}
		const parsed = parseSetFields(fields);
		if (!parsed) return;
		try {
			const didSave = await store.run(sessionId, async () => {
				if (savedId) {
					if (!saved) throw new Error(copy.unavailable);
					await update({ id: savedId, ...parsed, rpe: parsed.rpe ?? null });
				} else {
					const existing = store.get(sessionId, exerciseId);
					const attempt = existing?.attempt ?? {
						operationId: newLogOperationId(),
						setNumber: nextNumber,
						fields,
					};
					const frozen = parseSetFields(attempt.fields);
					if (!frozen) throw new Error(copy.saveError);
					store.put({ sessionId, exerciseId, fields: attempt.fields, attempt });
					await add({
						sessionId,
						exerciseId,
						...frozen,
						operationId: attempt.operationId,
						setNumber: attempt.setNumber,
					});
					store.remove(sessionId, exerciseId);
					if (frozen.setType !== "warmup") rest.start();
				}
			});
			if (didSave) leave();
		} catch (error) {
			if (!savedId && error instanceof ConvexError) {
				const rejected = store.get(sessionId, exerciseId);
				if (rejected?.attempt) {
					try {
						store.put({ sessionId, exerciseId, fields: rejected.fields });
					} catch {
						toast.error(copy.storageError);
					}
				}
			}
			toast.error(convexErrorMessage(error, copy.saveError));
		}
	}
	async function discard() {
		if (busy || draft?.attempt) return;
		if (
			!(await confirm({
				title: copy.discardDraftTitle,
				message: copy.discardDraftMessage,
				confirmLabel: copy.discard,
				cancelLabel: copy.keepEditing,
				destructive: true,
			}))
		)
			return;
		try {
			store.remove(sessionId, exerciseId);
			leave();
		} catch {
			toast.error(copy.storageError);
		}
	}
	async function repeat() {
		if (!saved || !active || busy) return;
		if (
			dirty &&
			!(await confirm({
				title: copy.discardTitle,
				message: copy.discardMessage,
				confirmLabel: copy.discard,
				cancelLabel: copy.keepEditing,
				destructive: true,
			}))
		)
			return;
		const previous = store.get(sessionId, exerciseId);
		if (previous?.attempt) {
			toast.error(copy.receiptPending);
			return;
		}
		if (
			previous &&
			!(await confirm({
				title: copy.replaceDraftTitle,
				message: copy.replaceDraftMessage,
				confirmLabel: copy.replace,
				cancelLabel: copy.keepEditing,
			}))
		)
			return;
		const repeated = fieldsForSet(saved);
		if (bodyweight) {
			repeated.weight = String(convertLoad(saved.weight, saved.unit, "kg"));
			repeated.unit = "kg";
		}
		try {
			store.put({ sessionId, exerciseId, fields: repeated });
			leave(() =>
				router.dismissTo({ pathname: "/session", params: { id: sessionId } }),
			);
		} catch {
			toast.error(copy.storageError);
		}
	}
	async function deleteSet() {
		if (!saved || !writable || busy) return;
		if (
			!(await confirm({
				title: copy.deleteTitle,
				message: copy.deleteMessage,
				confirmLabel: copy.delete,
				cancelLabel: copy.keepEditing,
				destructive: true,
			}))
		)
			return;
		try {
			if (await store.run(sessionId, () => remove({ id: saved._id }))) leave();
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.saveError));
		}
	}
	return {
		sessionId,
		exerciseId,
		savedId,
		saved,
		fields,
		change,
		busy,
		locked,
		dirty,
		active,
		writable,
		data,
		exercise,
		last,
		historyError: history.error,
		member,
		bodyweight,
		step,
		nextNumber,
		draft,
		submit,
		discard,
		repeat,
		deleteSet,
		storageError: store.storageError,
		close: () => router.back(),
	};
}
const SetEditorContext = createContext<ReturnType<typeof useEditor> | null>(
	null,
);
export function SetEditorProvider({
	children,
	params,
}: {
	children: ReactNode;
	params: EditorParams;
}) {
	const editor = useEditor(params);
	return (
		<SetEditorContext.Provider value={editor}>
			{children}
		</SetEditorContext.Provider>
	);
}
export function useSetEditor() {
	const editor = useContext(SetEditorContext);
	if (!editor) throw new Error("Set editor requires its sheet provider.");
	return editor;
}
