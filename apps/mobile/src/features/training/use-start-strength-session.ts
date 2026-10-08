import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { api, type Id } from "../../convex/api";
import { useI18n } from "../../i18n";
import { convexErrorMessage, useConfirm } from "../../ui/confirm-dialog";
import { useToast } from "../../ui/toast";
import type { useTrainingData } from "./use-training-data";

export function useStartStrengthSession(
	data: ReturnType<typeof useTrainingData>,
) {
	const create = useMutation(api.workoutSessions.create);
	const startRoutine = useMutation(api.routines.startSession);
	const confirm = useConfirm();
	const toast = useToast();
	const {
		t: { training: copy },
	} = useI18n();
	const locked = useRef(false);
	const [pending, setPending] = useState(false);
	async function start(input: { routineId?: Id<"routines">; name?: string }) {
		if (locked.current) return null;
		locked.current = true;
		setPending(true);
		try {
			if (data.active instanceof Error || data.active === undefined) {
				toast.error(copy.unknownActive);
				return null;
			}
			if (data.active) {
				return (await confirm({
					title: copy.activeTitle,
					message: copy.activeMessage,
					confirmLabel: copy.resume,
					cancelLabel: copy.cancel,
				}))
					? data.active._id
					: null;
			}
			if (!data.online) {
				toast.error(copy.onlineRequired);
				return null;
			}
			return input.routineId
				? await startRoutine({ routineId: input.routineId })
				: await create({ name: input.name?.trim() || undefined });
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.startError));
			return null;
		} finally {
			locked.current = false;
			setPending(false);
		}
	}
	return { start, pending };
}
