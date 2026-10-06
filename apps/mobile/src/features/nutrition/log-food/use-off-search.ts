/**
 * When the food browser may ask Open Food Facts, and what it heard back.
 *
 * Typing stays local. A term counts as settled on the keyboard's Search key
 * (`commit`) or after `OFF_IDLE_MS` of quiet with at least `OFF_MIN_CHARS`
 * characters, and each settled term is asked at most once. The provider's
 * rate limit is the shared budget's job (`open-food-facts-budget.ts`); this
 * hook only turns "not now" into a countdown and retries when it ends, so a
 * rate limit never touches the local results above it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { OffSearchOutcome } from "../../../data/open-food-facts";
import { OFF_COOL_DOWN_MS } from "../../../data/open-food-facts-budget";
import type { PersonalFoodDraft } from "../../../data/personal-food-repository";

export const OFF_MIN_CHARS = 3;
export const OFF_IDLE_MS = 1500;

export type OffSearchState =
	/** No query. */
	| { readonly kind: "idle" }
	/** A query that has not been asked about yet. */
	| { readonly kind: "waiting" }
	| { readonly kind: "loading" }
	| {
			readonly kind: "found";
			readonly drafts: readonly PersonalFoodDraft[];
	  }
	| { readonly kind: "none" }
	| { readonly kind: "cooling"; readonly until: number }
	| { readonly kind: "offline" }
	| {
			readonly kind: "failed";
			readonly reason: "timeout" | "network-error" | "unavailable";
	  };

export type OffSearchClient = {
	search(query: string): Promise<OffSearchOutcome>;
	coolingUntil(): number | undefined;
};

export function useOffSearch(
	query: string,
	{
		client,
		online,
		isImported,
	}: {
		client: OffSearchClient;
		online: boolean;
		/** True when a Personal Food already carries this barcode. */
		isImported: (barcode: string) => boolean;
	},
): { state: OffSearchState; commit: () => void } {
	const term = query.trim();
	const [state, setState] = useState<OffSearchState>(
		term ? { kind: "waiting" } : { kind: "idle" },
	);
	const termRef = useRef(term);
	/** The term already asked about (or being asked about). */
	const askedRef = useRef<string | undefined>(undefined);
	const retryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const latest = useRef({ client, online, isImported });
	latest.current = { client, online, isImported };

	const run = useCallback(async function ask(asked: string): Promise<void> {
		// "Not now": count down, then ask again once the window opens.
		const cool = (until: number) => {
			setState({ kind: "cooling", until });
			clearTimeout(retryRef.current);
			retryRef.current = setTimeout(
				() => void ask(asked),
				Math.max(0, until - Date.now()),
			);
		};
		const { client, online } = latest.current;
		if (!asked || termRef.current !== asked) return;
		if (askedRef.current === asked) return;
		clearTimeout(retryRef.current);
		if (!online) {
			setState({ kind: "offline" });
			return;
		}
		// No budget check here: the budget wraps the network fetch, so a cached
		// term is still answered while the window is closed, and an uncached
		// one comes back as "rate-limited" below without leaving the device.
		askedRef.current = asked;
		setState({ kind: "loading" });
		let outcome: OffSearchOutcome;
		try {
			outcome = await client.search(asked);
		} catch {
			outcome = { kind: "network-error" };
		}
		if (termRef.current !== asked) return;
		switch (outcome.kind) {
			case "found": {
				const drafts = outcome.drafts.filter((draft) => {
					const barcode =
						"barcode" in draft.provenance
							? draft.provenance.barcode
							: undefined;
					return !barcode || !latest.current.isImported(barcode);
				});
				setState(drafts.length ? { kind: "found", drafts } : { kind: "none" });
				return;
			}
			case "not-found":
				setState({ kind: "none" });
				return;
			case "rate-limited":
				askedRef.current = undefined;
				cool(
					latest.current.client.coolingUntil() ?? Date.now() + OFF_COOL_DOWN_MS,
				);
				return;
			default:
				askedRef.current = undefined;
				setState({ kind: "failed", reason: outcome.kind });
		}
	}, []);

	// A new term: forget the old answer and start the idle clock.
	useEffect(() => {
		termRef.current = term;
		askedRef.current = undefined;
		clearTimeout(retryRef.current);
		setState(term ? { kind: "waiting" } : { kind: "idle" });
		if (term.length < OFF_MIN_CHARS) return;
		const timer = setTimeout(() => void run(term), OFF_IDLE_MS);
		return () => clearTimeout(timer);
	}, [run, term]);

	// Back online: a term that was waiting for the connection is asked now.
	useEffect(() => {
		if (online && state.kind === "offline") void run(termRef.current);
	}, [online, run, state.kind]);

	useEffect(() => () => clearTimeout(retryRef.current), []);

	const commit = useCallback(() => void run(termRef.current), [run]);
	return { state, commit };
}
