import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { api } from "../../convex/api";
import { useI18n } from "../../i18n";
import { useConfirm } from "../../ui/confirm-dialog";
import { useToast } from "../../ui/toast";
import { useWriteFailureMessage } from "../../ui/use-screen-write";
import { useTrainingData } from "./use-training-data";

/**
 * Train now: starts a Strength Session with one exercise, named after it and
 * planned from last time, and opens it. With a session already active it
 * offers to add the exercise there instead (APP-871).
 */
export function useTrainExercise() {
	const data = useTrainingData();
	const router = useRouter();
	const errorMessage = useWriteFailureMessage();
	const create = useMutation(api.workoutSessions.create);
	const addExercise = useMutation(api.workoutSessions.addExercise);
	const confirm = useConfirm();
	const toast = useToast();
	const { t } = useI18n();
	const copy = t.training;
	const library = t.exercises;
	const locked = useRef(false);
	const [pending, setPending] = useState(false);

	async function train(exercise: { _id: string; name: string }) {
		if (locked.current) return;
		locked.current = true;
		setPending(true);
		try {
			const active = data.active;
			if (active instanceof Error || active === undefined) {
				toast.error(copy.unknownActive);
				return;
			}
			if (active) {
				const already = active.exercises?.some(
					(entry) => entry.exerciseId === exercise._id,
				);
				if (!already) {
					if (!data.online) {
						toast.error(copy.onlineRequired);
						return;
					}
					const add = await confirm({
						title: library.trainNowActiveTitle,
						message: library.trainNowActiveMessage,
						confirmLabel: library.trainNowAdd,
						cancelLabel: library.cancel,
					});
					if (!add) return;
					try {
						await addExercise({
							sessionId: active._id,
							exerciseId: exercise._id,
						});
					} catch (error) {
						toast.error(errorMessage(error, library.trainNowAddError));
						return;
					}
				}
				router.push({ pathname: "/session", params: { id: active._id } });
				return;
			}
			if (!data.online) {
				toast.error(copy.onlineRequired);
				return;
			}
			const id = await create({
				exerciseId: exercise._id,
				name: exercise.name,
			});
			router.push({ pathname: "/session", params: { id } });
		} catch (error) {
			toast.error(errorMessage(error, copy.startError));
		} finally {
			locked.current = false;
			setPending(false);
		}
	}
	return { train, pending };
}
