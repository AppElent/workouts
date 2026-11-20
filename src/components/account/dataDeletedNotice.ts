import { useEffect, useRef } from "react";
import { useToast } from "#/components/ui/toast";
import type { AppleRevocation } from "#/lib/auth/appleRevocation";
import { useI18n } from "#/lib/i18n";

/** Search Delete Foundry data only signs out to: `/?deleted=data`. */
export const DATA_DELETED_SEARCH = "deleted=data";

/**
 * What a deletion left behind, for the signed-out start: Foundry data only,
 * or the whole account with how Sign in with Apple ended.
 */
export type Deleted =
	| "data"
	| "account"
	| "accountAppleRevoked"
	| "accountAppleNotRevoked";

const DELETED: readonly Deleted[] = [
	"data",
	"account",
	"accountAppleRevoked",
	"accountAppleNotRevoked",
];

/** The `deleted` value Delete account lands on. */
export function accountDeleted(apple: AppleRevocation): Deleted {
	return apple === "revoked"
		? "accountAppleRevoked"
		: apple === "notRevoked"
			? "accountAppleNotRevoked"
			: "account";
}

/** The `/` search, read by `validateSearch`. */
export function dataDeletedSearch(search: Record<string, unknown>): {
	deleted?: Deleted;
} {
	const deleted = DELETED.find((value) => value === search.deleted);
	return deleted ? { deleted } : {};
}

/**
 * Confirms a deletion on the signed-out start it lands on. Delete Foundry
 * data only: the data is gone and the AppElent login still works in the other
 * apps. Delete account: the login is gone, and whether Foundry still uses
 * Sign in with Apple, with how to stop it when revoking failed.
 */
export function useDataDeletedNotice(
	deleted: Deleted | undefined,
	clear: () => void,
) {
	const toast = useToast();
	const {
		messages: { account: c },
	} = useI18n();
	const shown = useRef(false);
	useEffect(() => {
		if (!deleted || shown.current) return;
		shown.current = true;
		const d = c.deletion;
		if (deleted === "data") toast.success(d.dataDeleted, d.dataDeletedDetail);
		else
			toast.success(
				d.accountDeleted,
				deleted === "accountAppleRevoked"
					? `${d.accountDeletedDetail} ${d.appleRevoked}`
					: deleted === "accountAppleNotRevoked"
						? `${d.accountDeletedDetail} ${d.appleNotRevoked}`
						: d.accountDeletedDetail,
				// The steps to stop Sign in with Apple stay until dismissed.
				{ persist: deleted === "accountAppleNotRevoked" },
			);
		clear();
	}, [deleted, clear, toast, c]);
}
