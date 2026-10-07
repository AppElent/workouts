/**
 * The app-side request budget for Open Food Facts.
 *
 * OFF documents 10 search requests per minute and answers past that with
 * 429. The app stays below it on purpose: search fires on its own once a term
 * settles, so the budget is what keeps a person who types five words in a
 * minute from tripping the provider's limit. It wraps the fetch rather than
 * the client so a cache hit never spends anything, and barcode lookups and
 * search share one window because the provider counts them together.
 */
import type { FetchLike } from "./open-food-facts";

export const OFF_REQUEST_LIMIT = 6;
export const OFF_REQUEST_WINDOW_MS = 60_000;
export const OFF_COOL_DOWN_MS = 60_000;

export type OffRequestBudget = {
	/** Every network request through the returned fetch spends budget. */
	wrap(fetchImpl: FetchLike): FetchLike;
	/** When requests may go out again, or `undefined` when they may now. */
	coolingUntil(): number | undefined;
};

const RATE_LIMITED = {
	ok: false,
	status: 429,
	json: async () => ({}),
} as const;

export function createOffRequestBudget({
	limit = OFF_REQUEST_LIMIT,
	windowMs = OFF_REQUEST_WINDOW_MS,
	coolDownMs = OFF_COOL_DOWN_MS,
	now = Date.now,
}: {
	limit?: number;
	windowMs?: number;
	coolDownMs?: number;
	now?: () => number;
} = {}): OffRequestBudget {
	let sent: number[] = [];
	let cooledUntil = 0;

	function coolingUntil(): number | undefined {
		const at = now();
		sent = sent.filter((time) => time + windowMs > at);
		const windowOpensAt = sent.length >= limit ? (sent[0] ?? at) + windowMs : 0;
		const until = Math.max(cooledUntil, windowOpensAt);
		return until > at ? until : undefined;
	}

	return {
		coolingUntil,
		wrap: (fetchImpl) => async (input, init) => {
			if (coolingUntil() !== undefined) return RATE_LIMITED;
			sent.push(now());
			const response = await fetchImpl(input, init);
			if (response.status === 429) cooledUntil = now() + coolDownMs;
			return response;
		},
	};
}
