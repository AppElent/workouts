import type { PersonalMeasure } from "@workouts/core/nutrition";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/api";
import { useNutritionOperations } from "../../../data/nutrition-operation-service";
import { usePersonalMeasureActions } from "../../../data/personal-measures";
import { fmt, useI18n } from "../../../i18n";
import { convexErrorMessage, useConfirm } from "../../../ui/confirm-dialog";
import { useToast } from "../../../ui/toast";

export type MeasureUnit = "g" | "ml";

/**
 * My measures as two lists, one per unit, with what changes them: save
 * (create or update), remove after confirming, and move within a unit's
 * list. The device cache follows every change so logging sees it at once.
 * Changes need a connection; offline the lists stay readable.
 */
export function usePersonalMeasuresEditor() {
	const { t } = useI18n();
	const copy = t.nutrition.personalMeasures;
	const confirm = useConfirm();
	const toast = useToast();
	const operations = useNutritionOperations();
	const { measures, loading } = usePersonalMeasureActions();
	const connected = useConvexConnectionState().isWebSocketConnected;
	const createMeasure = useMutation(api.personalMeasures.create);
	const updateMeasure = useMutation(api.personalMeasures.update);
	const removeMeasure = useMutation(api.personalMeasures.remove);
	const reorderMeasures = useMutation(api.personalMeasures.reorder);
	const [local, setLocal] = useState<PersonalMeasure[]>(() => [...measures]);
	const [pending, setPending] = useState(false);
	useEffect(() => setLocal([...measures]), [measures]);

	const sorted = [...local].sort((a, b) => a.order - b.order);
	const byUnit: Record<MeasureUnit, PersonalMeasure[]> = {
		g: sorted.filter((measure) => measure.unit === "g"),
		ml: sorted.filter((measure) => measure.unit === "ml"),
	};

	function cache(next: PersonalMeasure[]) {
		setLocal(next);
		const subject = operations.getSubject();
		if (subject) operations.cachePersonalMeasures(subject, next);
	}

	/** Creates or updates; rejects (after a toast) so the popup stays open. */
	async function save(
		existing: PersonalMeasure | undefined,
		value: { name: string; amount: number; unit: MeasureUnit },
	) {
		setPending(true);
		try {
			if (existing) {
				const updated = await updateMeasure({
					id: existing.id as never,
					...value,
				});
				cache(local.map((item) => (item.id === updated.id ? updated : item)));
			} else {
				const created = await createMeasure(value);
				cache([...local, created]);
			}
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.saveFailure));
			throw error;
		} finally {
			setPending(false);
		}
	}

	async function remove(measure: PersonalMeasure) {
		if (pending) return;
		const ok = await confirm({
			title: fmt(copy.deleteTitle, { name: measure.name }),
			message: copy.deleteBody,
			confirmLabel: copy.delete,
			cancelLabel: copy.cancel,
			destructive: true,
		});
		if (!ok) return;
		setPending(true);
		try {
			await removeMeasure({ id: measure.id as never });
			cache(local.filter((item) => item.id !== measure.id));
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.deleteFailure));
		} finally {
			setPending(false);
		}
	}

	/** Moves within its unit's list; the server keeps one order for all. */
	async function move(measure: PersonalMeasure, direction: -1 | 1) {
		if (pending) return;
		const same = byUnit[measure.unit];
		const index = same.findIndex((item) => item.id === measure.id);
		const target = index + direction;
		if (index < 0 || target < 0 || target >= same.length) return;
		const next = [...same];
		[next[index], next[target]] = [next[target], next[index]];
		const other = byUnit[measure.unit === "g" ? "ml" : "g"];
		const ordered = [
			...(measure.unit === "g" ? next : other),
			...(measure.unit === "g" ? other : next),
		].map((item, order) => ({ ...item, order }));
		const before = local;
		cache(ordered);
		setPending(true);
		try {
			await reorderMeasures({ ids: ordered.map((item) => item.id as never) });
		} catch (error) {
			cache(before);
			toast.error(convexErrorMessage(error, copy.reorderFailure));
		} finally {
			setPending(false);
		}
	}

	return {
		byUnit,
		loading,
		connected,
		pending,
		save,
		remove,
		move,
		/** Asked before an existing measure moves to the other unit. */
		confirmUnitChange: () =>
			confirm({
				title: copy.unitChangeTitle,
				message: copy.unitChangeBody,
				confirmLabel: copy.unitChangeConfirm,
				cancelLabel: copy.cancel,
			}),
	};
}
