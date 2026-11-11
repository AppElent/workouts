import type { PaginationStatus } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { accountSlot, useAccountSlot } from "./account-write";

const LISTS = accountSlot(() => new Map<string, readonly unknown[]>());

/** The last complete list for `key` this session, when there is one. */
export function useCachedAccountLists(): <T>(
	key: string,
) => readonly T[] | undefined {
	const lists = useAccountSlot(LISTS);
	return useCallback(
		<T>(key: string) => lists.get(key) as readonly T[] | undefined,
		[lists],
	);
}

type Page<T> = {
	readonly results: T[];
	readonly status: PaginationStatus;
	readonly loadMore: (count: number) => void;
};

/**
 * A short account list read whole: every page is loaded, the last complete
 * list stays in session memory for when the subscription restarts, and an item
 * just created shows until the server list includes it.
 */
export function useCachedAccountList<T extends { readonly id: string }>(
	key: string | undefined,
	page: Page<T>,
): {
	readonly items: readonly T[];
	readonly loading: boolean;
	readonly markCreated: (item: T) => void;
} {
	const lists = useAccountSlot(LISTS);
	const { results, status, loadMore } = page;
	const [created, setCreated] = useState<{ key: string; item: T }>();
	useEffect(() => {
		if (status === "CanLoadMore") loadMore(100);
	}, [loadMore, status]);
	const pending =
		key !== undefined && created?.key === key ? created.item : undefined;
	const complete = key !== undefined && status === "Exhausted";
	const includesPending =
		!pending || results.some((item) => item.id === pending.id);
	useEffect(() => {
		if (!complete || !includesPending) return;
		lists.set(key, results);
		if (pending) setCreated(undefined);
	}, [complete, includesPending, key, lists, pending, results]);
	const cached =
		key === undefined ? undefined : (lists.get(key) as T[] | undefined);
	const available = complete ? results : (cached ?? []);
	const items = useMemo(
		() =>
			pending && !available.some((item) => item.id === pending.id)
				? [...available, pending]
				: available,
		[available, pending],
	);
	const markCreated = useCallback(
		(item: T) => {
			if (key !== undefined) setCreated({ key, item });
		},
		[key],
	);
	return {
		items,
		loading: key !== undefined && !complete && cached === undefined,
		markCreated,
	};
}
