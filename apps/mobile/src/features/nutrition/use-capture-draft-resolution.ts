import { useEffect, useRef } from "react";
import { useNutritionDiary } from "../../data/nutrition-diary";
import type { useNutritionDrafts } from "../../data/nutrition-drafts";
import { useI18n } from "../../i18n";
import { useToast } from "../../ui/toast";

/**
 * Resolving a Capture Draft: when the screen closes after anything was logged
 * to the draft's day and meal, the note has done its job, however many items
 * it listed. Logging nothing leaves the reminder in place.
 */
export function useCaptureDraftResolution(
	drafts: ReturnType<typeof useNutritionDrafts>,
	draftId: string | undefined,
) {
	const { t } = useI18n();
	const toast = useToast();
	const diary = useNutritionDiary();
	const startedAt = useRef(Date.now());
	const latest = useRef({
		drafts,
		diary,
		toast,
		failure: t.nutrition.drafts.deleteFailure,
	});
	latest.current = {
		drafts,
		diary,
		toast,
		failure: t.nutrition.drafts.deleteFailure,
	};
	useEffect(() => {
		if (!draftId) return;
		return () => {
			const { drafts, diary, toast, failure } = latest.current;
			const draft = drafts.get(draftId);
			if (
				!draft ||
				!diary.loggedSince(draft.date, draft.meal, startedAt.current)
			)
				return;
			drafts.remove(draft.id).catch(() => toast.error(failure));
		};
	}, [draftId]);
}
