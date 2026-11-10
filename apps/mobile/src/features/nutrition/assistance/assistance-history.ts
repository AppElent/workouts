/**
 * What Hulp bij invoeren needs to pick a logged meal up again: the
 * description, the AI's last result and the follow-ups, keyed by the Diary
 * Entries it logged. Kept on this phone per account (no sync), so continuing
 * works on the device that logged it, and removed with the account's data.
 */

import { MEAL_SLOTS, type NutritionDiarySnapshot } from "@foundry/core";
import type { Described, ReviewItem } from "../../../data/nutrition-ai";
import type { NutritionDay } from "../../../data/nutrition-day";
import {
	accountKeyspace,
	readLocal,
	readLocalJson,
	removeLocal,
	writeLocal,
	writeLocalJson,
} from "../../../local-store/local-store";

export type SavedAiSession = {
	readonly id: string;
	readonly text: string;
	readonly result: Described;
	readonly followUps: readonly string[];
	/** The review as logged, edits included; reopened without an AI call. */
	readonly items: readonly ReviewItem[];
	/** Client Entry IDs of what was logged; replaced together. */
	readonly entryIds: readonly string[];
	/** The entries as logged: to notice later edits, and to undo a replacement. */
	readonly entries: readonly (NutritionDiarySnapshot & {
		readonly clientEntryId: string;
	})[];
	/** A photo is not kept, so only a text-only meal can be repeated from its text. */
	readonly repeatable: boolean;
	/**
	 * Saved by builds that replaced in two writes: entries of an earlier
	 * attempt that could not be taken back. They are replaced with the meal.
	 */
	readonly stranded?: readonly string[];
};

export type CachedReview = {
	readonly result: Described;
	readonly items: readonly ReviewItem[];
	readonly at: number;
	/** Their saved foods at the time: changing those can change the answer. */
	readonly foods?: string;
};

const history = accountKeyspace("nutrition-ai:v1");
const sameWords = (text: string) =>
	text.trim().toLowerCase().replace(/\s+/g, " ");
const keys = {
	session: (account: string, id: string) => history.key(account, "session", id),
	entry: (account: string, clientEntryId: string) =>
		history.key(account, "entry", clientEntryId),
	review: (account: string, text: string, locale: string) =>
		history.key(account, "review", locale, sameWords(text)),
	text: (account: string, text: string) =>
		history.key(account, "text", sameWords(text)),
};

function record<T>(value: unknown): T {
	if (typeof value !== "object" || value === null)
		throw new Error("Expected a stored object.");
	return value as T;
}

export function saveAiSession(account: string, session: SavedAiSession) {
	writeLocalJson(keys.session(account, session.id), session);
	for (const id of session.entryIds)
		writeLocal(keys.entry(account, id), session.id);
	if (session.repeatable && session.text.trim())
		writeLocal(keys.text(account, session.text), session.id);
}

export function readAiSession(
	account: string,
	id: string,
): SavedAiSession | null {
	const read = readLocalJson(keys.session(account, id), record<SavedAiSession>);
	return read.ok ? read.value : null;
}

/** The session that logged this entry, if it was logged here with help. */
export function aiSessionForEntry(
	account: string,
	clientEntryId: string | undefined,
): SavedAiSession | null {
	if (!clientEntryId) return null;
	const id = readLocal(keys.entry(account, clientEntryId));
	return id ? readAiSession(account, id) : null;
}

/** The last meal logged from exactly this text, for an instant repeat. */
export function aiSessionForText(
	account: string,
	text: string,
): SavedAiSession | null {
	if (!text.trim()) return null;
	const id = readLocal(keys.text(account, text));
	return id ? readAiSession(account, id) : null;
}

export function forgetAiSession(account: string, session: SavedAiSession) {
	removeLocal(keys.session(account, session.id));
	for (const id of session.entryIds) removeLocal(keys.entry(account, id));
}

/**
 * Whether everything the session logged is still in the diary as it was logged.
 * Continuing replaces all of it, so any later edit rules continuing out.
 */
export function sessionUnchanged(
	session: SavedAiSession,
	day: NutritionDay,
): boolean {
	const current = new Map(
		MEAL_SLOTS.flatMap((meal) =>
			day.entries[meal].map(
				(entry) => [entry.clientEntryId, { entry, meal }] as const,
			),
		),
	);
	return (
		Boolean(session.entries?.length) &&
		session.entries.every((logged) => {
			const found = current.get(logged.clientEntryId);
			return (
				found &&
				found.meal === logged.meal &&
				Math.abs(found.entry.amount - logged.amount) < 0.01 &&
				found.entry.serving.nl === logged.serving.nl &&
				!found.entry.correctedNutrients?.length
			);
		})
	);
}

/** The same words give the same answer for a while, without an AI call. */
const REVIEW_CACHE_MS = 14 * 24 * 60 * 60 * 1000;

export function readCachedReview(
	account: string,
	text: string,
	locale: string,
	foods?: string,
): CachedReview | null {
	const read = readLocalJson(
		keys.review(account, text, locale),
		record<CachedReview>,
	);
	const cached = read.ok ? read.value : null;
	return cached &&
		Date.now() - cached.at < REVIEW_CACHE_MS &&
		(cached.foods ?? "") === (foods ?? "")
		? cached
		: null;
}

export function forgetReview(account: string, text: string, locale: string) {
	removeLocal(keys.review(account, text, locale));
}

export function cacheReview(
	account: string,
	text: string,
	locale: string,
	review: Omit<CachedReview, "at" | "foods">,
	foods?: string,
) {
	writeLocalJson(keys.review(account, text, locale), {
		...review,
		at: Date.now(),
		foods,
	});
}
