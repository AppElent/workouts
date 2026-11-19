import { useEffect, useRef } from "react";
import { useToast } from "#/components/ui/toast";
import { useI18n } from "#/lib/i18n";

/** Search Delete Foundry data only signs out to: `/?deleted=data`. */
export const DATA_DELETED_SEARCH = "deleted=data";

/** The `/` search, read by `validateSearch`. */
export function dataDeletedSearch(search: Record<string, unknown>): {
	deleted?: "data";
} {
	return search.deleted === "data" ? { deleted: "data" } : {};
}

/**
 * Confirms Delete Foundry data only on the signed-out start it lands on: the
 * data is gone and the AppElent login still works in the other apps.
 */
export function useDataDeletedNotice(
	deleted: "data" | undefined,
	clear: () => void,
) {
	const toast = useToast();
	const {
		messages: { account: c },
	} = useI18n();
	const shown = useRef(false);
	useEffect(() => {
		if (deleted !== "data" || shown.current) return;
		shown.current = true;
		toast.success(c.deletion.dataDeleted, c.deletion.dataDeletedDetail);
		clear();
	}, [deleted, clear, toast, c]);
}
