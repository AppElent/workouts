import { NUTRITION_AI_LIMITS, type PersonalFoodDraft } from "@foundry/core";
import { shippedLibrary } from "@foundry/core/shipped-foods";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccountWrite } from "../../../data/account-write";
import {
	applyChoices,
	asksFor,
	asksToRemove,
	carryOver,
	chooseInput,
	currentDescription,
	type DeletedRow,
	type Described,
	groundItems,
	isDeletedRow,
	type LabelCheck,
	labelChecks,
	personalFoodDraftFromReading,
	type ReviewItem,
	removedInWords,
	reviewTotals,
	sentenceWithoutRemoved,
	withOmittedRows,
} from "../../../data/nutrition-ai";
import {
	type ImageInput,
	prepareImage,
} from "../../../data/nutrition-ai-image";
import { buildAssistanceFoodCatalog } from "../../../data/nutrition-assistance";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import {
	PREFERENCE_KEYS,
	readLocal,
	writeLocal,
} from "../../../local-store/local-store";
import {
	AI_TIMEOUT_MS,
	AI_WEB_TIMEOUT_MS,
	type NutritionAiFailure,
	nutritionAiFailure,
	useNutritionAi,
	withAiTimeout,
} from "../use-nutrition-ai";
import {
	aiSessionForText,
	cacheReview,
	forgetReview,
	readCachedReview,
	type SavedAiSession,
} from "./assistance-history";

export type AssistanceProblem =
	| "noFood"
	| "matchFailed"
	| "notApplied"
	| NutritionAiFailure;

/** A follow-up that answers the AI's question: what was asked, then the answer. */
export const ANSWER_MARK = " → ";

const sameWords = (a: string, b: string) =>
	a.trim().toLowerCase().replace(/\s+/g, " ") ===
	b.trim().toLowerCase().replace(/\s+/g, " ");

export type AssistancePhase =
	| {
			readonly kind: "input";
			readonly problem?: AssistanceProblem;
			/** The AI's own sentence on why this could not be logged. */
			readonly detail?: string;
	  }
	| {
			readonly kind: "analysing";
			readonly step: "web" | "reading" | "matching";
	  }
	| {
			readonly kind: "review";
			readonly seen: string;
			readonly items: readonly ReviewItem[];
			/** A name for everything together, for saving as a Personal Food. */
			readonly title?: string;
			readonly brand?: string | null;
			readonly question?: Described["question"];
			/** Pages a web lookup used. */
			readonly sources?: Described["sources"];
			/** Which analysis this came from; a new one resets the screen's choices. */
			readonly analysis?: number;
			/** A refinement failed; the previous review stays. */
			readonly problem?: AssistanceProblem;
			readonly detail?: string;
	  }
	| {
			readonly kind: "label";
			readonly draft: PersonalFoodDraft;
			readonly checks: readonly LabelCheck[];
	  };

/**
 * One Hulp bij invoeren session: the input, the analysis, and the reviewed
 * items. Logging and the follow-up forms belong to the screen.
 */
export function useAssistanceSession(
	initialText: string,
	/** A logged meal to continue: its review comes back as it was logged. */
	resume?: SavedAiSession,
) {
	const { locale } = useI18n();
	const ai = useNutritionAi();
	const personalFoods = usePersonalFoods();
	const account = useAccountWrite().subject;
	const [text, setText] = useState(resume?.text ?? initialText);
	const [photo, setPhoto] = useState<string>();
	const [phase, setPhase] = useState<AssistancePhase>({ kind: "input" });
	// Every analysis of a new text is another meal; a correction is not.
	const [mealStarts, setMealStarts] = useState(0);
	// Corrections and answers on top of the last analysis, oldest first.
	const [followUps, setFollowUps] = useState<readonly string[]>(
		resume?.followUps ?? [],
	);
	const [refining, setRefining] = useState(false);
	// Corrected or adjusted by hand: leaving should ask first.
	const [touched, setTouched] = useState(false);
	const [lastReview, setLastReview] = useState<
		| {
				phase: Extract<AssistancePhase, { kind: "review" }>;
				text: string;
				touched: boolean;
				described: { result: Described; image?: ImageInput } | undefined;
				followUps: readonly string[];
				removed: readonly DeletedRow[];
		  }
		| undefined
	>();
	// Rows the person deleted stay deleted, whatever the description says.
	const removed = useRef<readonly DeletedRow[]>([]);
	// What a correction in flight may already have replaced; "Wijzig" undoes it.
	const beforeRefine = useRef<{
		described: { result: Described; image?: ImageInput } | undefined;
		followUps: readonly string[];
		removed: readonly DeletedRow[];
		touched: boolean;
	} | null>(null);
	// Opt-in: a web lookup costs ~1–3 cents against ~0.05 for a plain analysis.
	const [webSearch, setWebSearchState] = useState(
		() => readLocal(PREFERENCE_KEYS.nutritionAiWebSearch) === "1",
	);
	function setWebSearch(on: boolean) {
		setWebSearchState(on);
		writeLocal(PREFERENCE_KEYS.nutritionAiWebSearch, on ? "1" : "0");
	}
	const described = useRef<{ result: Described; image?: ImageInput }>(
		resume ? { result: resume.result } : undefined,
	);
	// The state undoRefine just restored; React's copy is one render behind.
	const beforeRolled = useRef<{
		described: { result: Described; image?: ImageInput } | undefined;
		followUps: readonly string[];
	} | null>(null);
	// A cancelled or superseded analysis must not land.
	const run = useRef(0);
	/** Their saved foods at this moment: built when asked, not on each keystroke. */
	function savedFoodsSignature() {
		let hash = 0;
		for (const char of JSON.stringify(personalFoods.list()))
			hash = (hash * 31 + (char.codePointAt(0) as number)) | 0;
		return String(hash);
	}

	/**
	 * Ground described items in the local library and let the AI pick. Rows a
	 * correction did not touch keep what they had. A failed pick keeps the
	 * description: the rows still show, and the person can choose.
	 */
	async function review(
		result: Described,
		live: () => boolean,
		prior: {
			items: readonly ReviewItem[];
			described: Described["items"];
		} | null,
		timeLeft: () => number,
		remember?: { text: string },
		correction?: string,
		sent?: readonly string[],
	) {
		const toGround = prior
			? withOmittedRows(result.items, prior.items, prior.described, correction)
			: result.items;
		// A row brought back belongs to the description of the next correction too.
		if (prior && described.current && toGround.length > result.items.length)
			described.current = {
				...described.current,
				result: { ...result, items: toGround },
			};
		const grounded = groundItems(
			toGround,
			buildAssistanceFoodCatalog(shippedLibrary().active, personalFoods.list()),
			locale,
		);
		const carried = prior
			? carryOver(
					grounded,
					toGround,
					prior.items,
					prior.described,
					locale,
					correction,
				)
			: [];
		// Products without a match keep their own estimate: no pick needed.
		const pending = grounded.flatMap((item, index) =>
			!carried[index] && (item.kind !== "product" || item.candidates.length > 0)
				? [index]
				: [],
		);
		let choices: Awaited<ReturnType<typeof ai.choose>> = [];
		let failed = false;
		if (pending.length) {
			const input = {
				items: chooseInput(
					pending.map((index) => grounded[index] as ReviewItem),
					pending.map((index) => toGround[index]?.brand ?? null),
				),
			};
			setPhase((p) =>
				p.kind === "analysing" ? { ...p, step: "matching" } : p,
			);
			try {
				choices = await withAiTimeout(
					ai.choose(input).catch(() => ai.choose(input)),
					timeLeft(),
				);
			} catch {
				failed = true;
				// A best guess the person can log or change, marked as a guess.
				choices = pending.flatMap((index, at) => {
					const item = grounded[index];
					const ref =
						item?.kind === "product" ? undefined : item?.candidates[0]?.id;
					return ref ? [{ index: at, ref, estimate: null }] : [];
				});
			}
			if (!live()) return;
		}
		const chosen = applyChoices(
			grounded,
			choices.map((choice) => ({
				...choice,
				index: pending[choice.index] ?? -1,
			})),
			locale,
		);
		const items = chosen.map(
			(item, index) =>
				carried[index] ??
				(failed ? { ...item, confidence: "low" as const } : item),
		);
		if (remember && !failed && account)
			cacheReview(
				account,
				remember.text,
				locale,
				{ result, items },
				savedFoodsSignature(),
			);
		if (!prior) setLastReview(undefined);
		// "Geen saus" with every number as it was: say so, do not look applied.
		const answered = sent?.at(-1)?.includes(ANSWER_MARK);
		const nothingRemoved =
			prior &&
			!answered &&
			asksToRemove(correction ?? "") &&
			items.length === prior.items.length &&
			Math.abs(
				reviewTotals(items).energy.amount -
					reviewTotals(prior.items).energy.amount,
			) < 1;
		// Nothing happened: the words stay in the field to rephrase.
		if (sent && !nothingRemoved) setFollowUps(sent);
		setPhase({
			kind: "review",
			seen: result.seen,
			title: result.title,
			brand: result.items.find((item) => item.brand)?.brand ?? null,
			question: result.question,
			sources: result.sources,
			analysis: run.current,
			items,
			...(failed
				? { problem: "matchFailed" as const }
				: nothingRemoved
					? { problem: "notApplied" as const }
					: {}),
		});
	}

	function reviewOf(
		result: Described,
		items: readonly ReviewItem[],
		question: Described["question"] | undefined,
	): AssistancePhase {
		return {
			kind: "review",
			seen: result.seen,
			title: result.title,
			brand: result.items.find((item) => item.brand)?.brand ?? null,
			question,
			sources: result.sources,
			analysis: run.current,
			items,
		};
	}

	async function analyse() {
		if (!text.trim() && !photo) return;
		// Back from "Wijzig" with the same words: their corrections still stand.
		if (
			lastReview?.touched &&
			!photo &&
			!webSearch &&
			sameWords(lastReview.text, text)
		) {
			restoreLastReview();
			return;
		}
		// The same words give the same numbers, at once, also without a connection.
		const cacheable = !photo && !webSearch;
		const cached =
			cacheable && account
				? readCachedReview(account, text, locale, savedFoodsSignature())
				: null;
		if (!cached && !ai.online) {
			setPhase({ kind: "input", problem: "offline" });
			return;
		}
		const current = ++run.current;
		const live = () => run.current === current;
		setRefining(false);
		setFollowUps([]);
		setMealStarts((count) => count + 1);
		setTouched(false);
		removed.current = [];
		if (cached) {
			described.current = { result: cached.result };
			setLastReview(undefined);
			setPhase(reviewOf(cached.result, cached.items, cached.result.question));
			return;
		}
		// One deadline for everything this analysis waits on.
		const deadline =
			Date.now() + (webSearch ? AI_WEB_TIMEOUT_MS : AI_TIMEOUT_MS);
		const timeLeft = () => Math.max(0, deadline - Date.now());
		setPhase({ kind: "analysing", step: webSearch ? "web" : "reading" });
		try {
			let image: ImageInput | undefined;
			if (photo) image = await withAiTimeout(prepareImage(photo), timeLeft());
			const result = await withAiTimeout(
				ai.describe({
					text: text.trim() || undefined,
					image,
					locale,
					webSearch: webSearch || undefined,
				}),
				timeLeft(),
			);
			if (!live()) return;
			if (result.kind === "label" && image) {
				const reading = await withAiTimeout(
					ai.readLabel({ image, locale }),
					timeLeft(),
				);
				if (!live()) return;
				setPhase(
					reading.isLabel
						? {
								kind: "label",
								draft: personalFoodDraftFromReading(reading),
								checks: labelChecks(reading),
							}
						: { kind: "input", problem: "noFood", detail: result.seen },
				);
				return;
			}
			if (result.kind !== "meal") {
				setPhase({ kind: "input", problem: "noFood", detail: result.seen });
				return;
			}
			described.current = { result, image };
			await review(
				result,
				live,
				null,
				timeLeft,
				cacheable ? { text } : undefined,
			);
		} catch (error) {
			if (live())
				setPhase({ kind: "input", problem: nutritionAiFailure(error) });
		}
	}

	/**
	 * A correction or an answer to the AI's question: a new analysis with the
	 * previous result as context. The current review stays until it lands.
	 */
	async function refine(followUp: string) {
		const previous = described.current;
		if (!followUp.trim() || !previous || refining) return;
		const current = ++run.current;
		const live = () => run.current === current;
		const next = [...followUps, followUp.trim()];
		const rows = phase.kind === "review" ? phase.items : [];
		const deadline = Date.now() + AI_TIMEOUT_MS;
		const timeLeft = () => Math.max(0, deadline - Date.now());
		const gone: readonly DeletedRow[] = [
			...removed.current,
			...previous.result.items
				.filter((item) => !rows.some((row) => row.described === item.name))
				.map((item) => ({ name: item.name, searchTerms: item.searchTerms })),
		];
		beforeRefine.current = {
			described: previous,
			followUps,
			removed: removed.current,
			touched,
		};
		setRefining(true);
		setPhase((p) =>
			p.kind === "review" ? { ...p, problem: undefined, detail: undefined } : p,
		);
		try {
			if (!ai.online) throw new Error("offline");
			const result = await withAiTimeout(
				ai.describe({
					// A photo-only meal continued later has neither photo nor text.
					text:
						text.trim() || (previous.image ? undefined : previous.result.seen),
					image: previous.image,
					locale,
					previous: JSON.stringify({
						seen: previous.result.seen,
						title: previous.result.title,
						items: currentDescription(rows, previous.result.items),
						removedByPerson: gone.map((row) => row.name),
					}),
					// Older follow-ups are already in the previous result.
					followUps: next.slice(-NUTRITION_AI_LIMITS.maxFollowUps),
				}),
				timeLeft(),
			);
			if (!live()) return;
			if (result.kind !== "meal") {
				setPhase((p) =>
					p.kind === "review"
						? { ...p, problem: "noFood", detail: result.seen }
						: p,
				);
				return;
			}
			// A deleted row returns only if this correction asks for it. A row the
			// AI kept by its id is not one of them, whatever it is called now.
			const correction = followUp.split(ANSWER_MARK).pop() ?? followUp;
			const stillGone = gone.filter((row) => !asksFor(correction, [row.name]));
			const kept = result.items.filter(
				(item) =>
					rows.some((row) => row.key === item.id) ||
					!isDeletedRow(item, stillGone),
			);
			// Nothing left to show: the review stays as it was, and the text too.
			if (!kept.length) {
				setPhase((p) =>
					p.kind === "review" ? { ...p, problem: "notApplied" } : p,
				);
				return;
			}
			removed.current = stillGone;
			// Keep the sources of the lookup the refinement builds on.
			const refined = {
				result: {
					...result,
					...sentenceWithoutRemoved(
						result,
						[
							...stillGone,
							...removedInWords(correction),
							...previous.result.items.filter(
								(item) =>
									!kept.some((row) => row.name === item.name) &&
									!kept.some((row) =>
										rows.some(
											(old) =>
												old.key === row.id && old.described === item.name,
										),
									),
							),
						].map((row) => ({ name: row.name, searchTerms: row.searchTerms })),
						kept.map((row) => row.name),
					),
					items: kept,
					sources: result.sources.length
						? result.sources
						: previous.result.sources,
				},
				image: previous.image,
			};
			described.current = refined;
			setTouched(true);
			await review(
				refined.result,
				live,
				{ items: rows, described: previous.result.items },
				timeLeft,
				undefined,
				correction,
				next,
			);
		} catch (error) {
			if (live())
				setPhase((p) =>
					p.kind === "review"
						? {
								...p,
								problem: ai.online ? nutritionAiFailure(error) : "offline",
							}
						: p,
				);
		} finally {
			if (live()) {
				setRefining(false);
				beforeRefine.current = null;
			}
		}
	}

	/** Back to the review "Wijzig" left, with everything that belongs to it. */
	function restoreLastReview() {
		if (!lastReview) return;
		run.current += 1;
		setText(lastReview.text);
		setTouched(lastReview.touched);
		described.current = lastReview.described;
		setFollowUps(lastReview.followUps);
		removed.current = lastReview.removed;
		setRefining(false);
		setPhase(lastReview.phase);
	}

	/** Leaving a correction halfway: nothing of it stays. */
	function undoRefine() {
		const before = beforeRefine.current;
		beforeRefine.current = null;
		if (!refining || !before) return touched;
		beforeRolled.current = before;
		described.current = before.described;
		setFollowUps(before.followUps);
		removed.current = before.removed;
		setTouched(before.touched);
		return before.touched;
	}

	// Continuing a logged meal: its review exactly as it was logged.
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, on open
	useEffect(() => {
		if (!resume) return;
		setPhase(reviewOf(resume.result, resume.items, null));
	}, []);

	const repeat = useMemo(
		() => (photo || !account ? null : aiSessionForText(account, text)),
		[photo, text, account],
	);

	return {
		ai,
		mealStarts,
		touched,
		/** Typed or chosen but not analysed yet: leaving would lose it. */
		inputChanged:
			(phase.kind === "input" || phase.kind === "analysing") &&
			(Boolean(photo) || !sameWords(text, resume?.text ?? initialText)),
		/** The meal last logged from exactly this text: no AI call, same numbers. */
		repeat: repeat?.repeatable ? repeat : null,
		applyRepeat: () => {
			if (!repeat) return;
			run.current += 1;
			described.current = { result: repeat.result };
			removed.current = [];
			setRefining(false);
			setFollowUps(repeat.followUps);
			setMealStarts((count) => count + 1);
			setTouched(false);
			setLastReview(undefined);
			setPhase(reviewOf(repeat.result, repeat.items, null));
		},
		/** Undoes "Wijzig" while the input has not been analysed again. */
		canGoBackToReview: lastReview !== undefined,
		backToReview: restoreLastReview,
		/** What was logged is what these words mean from now on, until it is undone. */
		rememberLogged: () => {
			const words = text;
			const result = described.current?.result;
			if (
				result &&
				phase.kind === "review" &&
				!photo &&
				!described.current?.image &&
				(resume?.repeatable ?? true) &&
				text.trim() &&
				account
			)
				cacheReview(
					account,
					text,
					locale,
					{ result, items: phase.items },
					savedFoodsSignature(),
				);
			return () => {
				if (account) forgetReview(account, words, locale);
			};
		},
		/** What a logged meal needs to be continued later. */
		context: () =>
			described.current &&
			phase.kind === "review" &&
			phase.analysis !== undefined
				? {
						text: text.trim(),
						result: described.current.result,
						followUps,
						items: phase.items,
						repeatable: !photo && (resume?.repeatable ?? true),
					}
				: undefined,
		text,
		setText,
		photo,
		setPhoto,
		phase,
		analyse,
		refine,
		refining,
		webSearch,
		setWebSearch,
		followUps,
		cancel: () => {
			run.current += 1;
			undoRefine();
			setRefining(false);
			setPhase({ kind: "input" });
		},
		/** "Wijzig": back to the input with everything still in it. */
		edit: () => {
			run.current += 1;
			const stillTouched = undoRefine();
			const rolledBack = {
				described: beforeRolled.current?.described ?? described.current,
				followUps: beforeRolled.current?.followUps ?? followUps,
				removed: removed.current,
			};
			beforeRolled.current = null;
			setRefining(false);
			if (phase.kind === "review")
				setLastReview({
					phase: { ...phase, problem: undefined, detail: undefined },
					text,
					touched: stillTouched,
					described: rolledBack.described,
					followUps: rolledBack.followUps,
					removed: rolledBack.removed,
				});
			setPhase({ kind: "input" });
		},
		setItems: (items: readonly ReviewItem[]) => {
			setTouched(true);
			const known = described.current;
			if (phase.kind !== "review") return;
			const gone = phase.items.filter(
				(row) => !items.some((item) => item.key === row.key),
			);
			const sentence = sentenceWithoutRemoved(
				phase,
				gone.map((row) => ({
					name: row.described,
					searchTerms:
						known?.result.items.find((item) => item.name === row.described)
							?.searchTerms ?? [],
				})),
				items.map((item) => item.described),
			);
			// A later correction starts from the same sentence as this review.
			if (known)
				described.current = {
					...known,
					result: { ...known.result, ...sentence },
				};
			setPhase(
				(current): AssistancePhase =>
					current.kind === "review"
						? { ...current, ...sentence, items }
						: current,
			);
		},
		showItems: (seen: string, items: readonly ReviewItem[]) =>
			setPhase({ kind: "review", seen, items }),
	};
}
