/**
 * PROTOTYPE — what Hulp bij invoeren needs to pick a logged meal up again:
 * the description, the AI's last result and the follow-ups, keyed by the
 * Diary Entries it logged. Kept on this phone only (no sync), so continuing
 * works on the device that logged it.
 */

import type { NutritionDiarySnapshot } from "@foundry/core";
import Storage from "expo-sqlite/kv-store";
import type { Described, ReviewItem } from "./nutrition-ai";
import { MEAL_SLOTS, type NutritionDay } from "./nutrition-day";

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
	/** Earlier attempts at replacing this meal that could not be taken back. */
	readonly stranded?: readonly string[];
};

const sessionKey = (id: string) => `workouts:nutrition-ai-session:${id}`;
const entryKey = (clientEntryId: string) =>
	`workouts:nutrition-ai-entry:${clientEntryId}`;
const sameWords = (text: string) =>
	text.trim().toLowerCase().replace(/\s+/g, " ");
/** Per account: another person on this phone never gets these answers. */
export const reviewKey = (text: string, locale: string, account: string) =>
	`workouts:nutrition-ai-review:v3:${account}:${locale}:${sameWords(text)}`;
const textKey = (text: string, account: string) =>
	`workouts:nutrition-ai-text:v2:${account}:${sameWords(text)}`;

export function saveAiSession(session: SavedAiSession, account?: string) {
	try {
		Storage.setItemSync(sessionKey(session.id), JSON.stringify(session));
		for (const id of session.entryIds)
			Storage.setItemSync(entryKey(id), session.id);
		if (account && session.repeatable && session.text.trim())
			Storage.setItemSync(textKey(session.text, account), session.id);
	} catch {
		// Best effort: the entries are logged either way.
	}
}

export function readAiSession(id: string): SavedAiSession | null {
	try {
		const raw = Storage.getItemSync(sessionKey(id));
		return raw ? (JSON.parse(raw) as SavedAiSession) : null;
	} catch {
		return null;
	}
}

/** The session that logged this entry, if it was logged here with help. */
export function aiSessionForEntry(
	clientEntryId: string | undefined,
): SavedAiSession | null {
	if (!clientEntryId) return null;
	try {
		const id = Storage.getItemSync(entryKey(clientEntryId));
		return id ? readAiSession(id) : null;
	} catch {
		return null;
	}
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

export type CachedReview = {
	readonly result: Described;
	readonly items: readonly ReviewItem[];
	readonly at: number;
	/** Their saved foods at the time: changing those can change the answer. */
	readonly foods?: string;
};

/** The same words give the same answer for a while, without an AI call. */
const REVIEW_CACHE_MS = 14 * 24 * 60 * 60 * 1000;

export function readCachedReview(
	text: string,
	locale: string,
	account: string | undefined,
	foods?: string,
): CachedReview | null {
	if (!account) return null;
	try {
		const raw = Storage.getItemSync(reviewKey(text, locale, account));
		const cached = raw ? (JSON.parse(raw) as CachedReview) : null;
		return cached &&
			Date.now() - cached.at < REVIEW_CACHE_MS &&
			(cached.foods ?? "") === (foods ?? "")
			? cached
			: null;
	} catch {
		return null;
	}
}

export function forgetReview(
	text: string,
	locale: string,
	account: string | undefined,
) {
	if (!account) return;
	try {
		Storage.removeItemSync(reviewKey(text, locale, account));
	} catch {
		// Nothing to forget.
	}
}

export function cacheReview(
	text: string,
	locale: string,
	review: Omit<CachedReview, "at" | "foods">,
	account: string | undefined,
	foods?: string,
) {
	if (!account) return;
	try {
		Storage.setItemSync(
			reviewKey(text, locale, account),
			JSON.stringify({ ...review, at: Date.now(), foods }),
		);
	} catch {
		// Best effort: the next analysis asks the AI again.
	}
}

/** The last meal logged from exactly this text, for an instant repeat. */
export function aiSessionForText(
	text: string,
	account: string | undefined,
): SavedAiSession | null {
	if (!text.trim() || !account) return null;
	try {
		const id = Storage.getItemSync(textKey(text, account));
		return id ? readAiSession(id) : null;
	} catch {
		return null;
	}
}

export function forgetAiSession(session: SavedAiSession) {
	try {
		Storage.removeItemSync(sessionKey(session.id));
		for (const id of session.entryIds) Storage.removeItemSync(entryKey(id));
	} catch {
		// Ignored: a stale link only offers to continue a meal that is gone.
	}
}
