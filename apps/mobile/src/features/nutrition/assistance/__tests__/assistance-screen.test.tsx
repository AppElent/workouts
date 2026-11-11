import { type NutritionOperationEnvelope, shiftIsoDate } from "@foundry/core";
import { useAction, useConvexConnectionState } from "convex/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import {
	act,
	fireEvent,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { formatLongDate, todayIsoDate } from "../../../../dates/calendar-day";
import {
	PREFERENCE_KEYS,
	removeLocal,
	writeLocal,
} from "../../../../local-store/local-store";
import { renderApp } from "../../../../test-support/render-app";
import { ACTION_ARM_MS } from "../../../../ui/toast";
import { forgetReview } from "../assistance-history";

type App = Awaited<ReturnType<typeof renderApp>>;
type Operation = NutritionOperationEnvelope["operation"];

/** The diary operations the fixture server received, of one kind. */
function sent<K extends Operation["kind"]>(app: App, kind: K) {
	return app.accountTransport.apply.mock.calls
		.map(([args]) => args.operation)
		.filter(
			(operation): operation is Extract<Operation, { kind: K }> =>
				operation.kind === kind,
		);
}

function refuse(app: App, kind: Operation["kind"], times = 1) {
	const { apply } = app.accountTransport;
	const real = apply.getMockImplementation();
	let left = times;
	apply.mockImplementation(async (args) => {
		if (args.operation.kind === kind && left-- > 0) throw new Error("failed");
		return real?.(args);
	});
}

type Item = {
	name: string;
	amount: number;
	unit: "g" | "ml";
	grams: number;
	amountLabel: string;
	confidence: "high" | "medium" | "low";
	brand: string | null;
	searchTerms: string[];
};

const bread: Item = {
	name: "Volkorenbrood",
	amount: 70,
	unit: "g",
	grams: 70,
	amountLabel: "2 sneetjes",
	confidence: "high",
	brand: null,
	searchTerms: ["brood volkoren", "brood"],
};
const pancake: Item = {
	...bread,
	name: "Grandma's banana pancake",
	amount: 120,
	grams: 120,
	amountLabel: "1 piece",
	confidence: "low",
	searchTerms: ["zzz unknown"],
};

const describeMeal = jest.fn();
const choose = jest.fn();
const readLabel = jest.fn();

function scriptActions() {
	jest.mocked(useAction).mockImplementation(((reference: never) => {
		const name = getFunctionName(reference);
		return name === "nutritionAi:describe"
			? describeMeal
			: name === "nutritionAi:choose"
				? choose
				: readLabel;
	}) as never);
}

const url = "/nutrition-assistance?meal=lunch&text=bread+and+a+pancake";
/** The diary row of the bread the help matched and logged. */
const LOGGED_ENTRY = /^Edit entry: Wholemeal bread/;

beforeEach(() => {
	describeMeal.mockReset();
	choose.mockReset();
	readLabel.mockReset();
	scriptActions();
	writeLocal(PREFERENCE_KEYS.nutritionAiConsent, "granted");
	// Each test analyses this text afresh; one test covers the cached answer.
	forgetReview("test-user", "bread and a pancake", "en");
	// The first candidate for a known food; an estimate for an unknown one.
	choose.mockImplementation(
		async (args: { items: { candidates: { ref: string }[] }[] }) =>
			args.items.map((item, index) => ({
				index,
				ref: item.candidates[0]?.ref ?? null,
				estimate: item.candidates.length
					? null
					: {
							energy: 260,
							protein: 8,
							carbs: 38,
							fat: 8,
							saturatedFat: 2,
							sugars: 14,
							fibre: 2,
							salt: 0.5,
						},
			})),
	);
});

describe("Hulp bij invoeren", () => {
	it("asks for consent once before anything is sent", async () => {
		removeLocal(PREFERENCE_KEYS.nutritionAiConsent);
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Continue"));
		expect(await screen.findByText("Analyse")).toBeTruthy();
		expect(describeMeal).not.toHaveBeenCalled();
	});

	it("reviews matched and estimated items, then logs them as separate entries", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "Bread and a pancake",
			items: [bread, pancake],
		});
		const app = await renderApp();
		await screen.findByText("Today");
		await testRouter.push(url);
		await fireEvent.press(await screen.findByText("Analyse"));

		expect(await screen.findByText("Bread and a pancake")).toBeTruthy();
		expect(describeMeal).toHaveBeenCalledWith(
			expect.objectContaining({ text: "bread and a pancake", locale: "en" }),
		);
		expect(choose).toHaveBeenCalledTimes(1);
		expect(
			screen.getByText(
				"~ 1 item is an estimate. Tap it to change its values, or correct it below.",
			),
		).toBeTruthy();
		expect(screen.getByText("Grandma's banana pancake")).toBeTruthy();
		expect(screen.getByText("~ 1 piece · 260 kcal")).toBeTruthy();
		expect(screen.getByText("Total")).toBeTruthy();

		await fireEvent.press(screen.getByText("Log 2 items"));
		expect(await screen.findByText("2 items logged to Lunch")).toBeTruthy();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});

	it("keeps the person's words for a count, and grams when there is no plural", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "Bread and a pancake",
			items: [bread, pancake],
		});
		await renderApp();
		await screen.findByText("Today");
		await testRouter.push(url);
		await fireEvent.press(await screen.findByText("Analyse"));

		await fireEvent.press(await screen.findByText(/^2 sneetjes/));
		await fireEvent.press(await screen.findByText("+1"));
		await fireEvent.press(screen.getByText("Done"));
		expect(await screen.findByText(/^3 sneetjes/)).toBeTruthy();

		await fireEvent.press(screen.getByText(/1 piece/));
		await fireEvent.press(await screen.findByText("+1"));
		await fireEvent.press(screen.getByText("Done"));
		expect(await screen.findByText(/240 g/)).toBeTruthy();
		expect(screen.queryByText(/2 piece/)).toBeNull();
	});

	it("says when nothing edible was recognised and keeps the text", async () => {
		describeMeal.mockResolvedValue({ kind: "no_food", seen: "?", items: [] });
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		expect(await screen.findByText("No food recognised")).toBeTruthy();
		expect(screen.getByDisplayValue("bread and a pancake")).toBeTruthy();
	});

	it("shows the AI's own reason when it cannot log the text", async () => {
		describeMeal.mockResolvedValue({
			kind: "no_food",
			seen: "I can't see earlier meals; describe what you ate.",
			items: [],
		});
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		expect(
			await screen.findByText(
				"I can't see earlier meals; describe what you ate.",
			),
		).toBeTruthy();
	});

	it("logs a single result in one tap as one item, with the form still reachable", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "A pancake",
			title: "Pancake",
			sources: [],
			question: null,
			items: [pancake],
		});
		const app = await renderApp();
		await screen.findByText("Today");
		await testRouter.push(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		expect(await screen.findByText("Adjust or save as a food…")).toBeTruthy();
		await fireEvent.press(screen.getByText("Log as one item"));
		expect(await screen.findByText("1 item logged to Lunch")).toBeTruthy();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});

	describe("logging and continuing", () => {
		// Each test logs words of its own, so it never continues an earlier
		// test's meal or gets an earlier answer back.
		let logged = 0;
		let words = "";
		beforeEach(() => {
			logged += 1;
			words = `log+me+${logged}`;
		});
		afterEach(() => jest.restoreAllMocks());

		const assistWith = (text: string) =>
			`/nutrition-assistance?meal=lunch&text=${text}`;

		/** A continued meal can be logged once the day it replaces has loaded. */
		async function logWhenReady() {
			await waitFor(() =>
				expect(
					screen.getByRole("button", { name: "Log as one item" }),
				).toBeEnabled(),
			);
			await fireEvent.press(screen.getByText("Log as one item"));
		}

		async function logOnce() {
			describeMeal.mockResolvedValue({
				kind: "meal",
				seen: "Bread",
				title: "Bread",
				sources: [],
				question: null,
				items: [{ ...bread, name: "Logged bread", confidence: "low" }],
			});
			const app = await renderApp();
			await screen.findByText("Today");
			await testRouter.push(assistWith(words));
			await fireEvent.press(await screen.findByText("Analyse"));
			await fireEvent.press(await screen.findByText("Log as one item"));
			await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
			return app;
		}

		/** Picks the logged meal up again from its entry, as a person does. */
		async function continueFromDiary(app: App) {
			await fireEvent.press(await screen.findByLabelText(LOGGED_ENTRY));
			await fireEvent.press(await screen.findByLabelText("Continue with help"));
			await waitFor(() =>
				expect(app.getPathname()).toBe("/nutrition-assistance"),
			);
		}

		it("reports a failed log instead of hanging, and can log again", async () => {
			describeMeal.mockResolvedValue({
				kind: "meal",
				seen: "Bread",
				title: "Bread",
				sources: [],
				question: null,
				items: [{ ...bread, name: "Logged bread" }],
			});
			const app = await renderApp();
			refuse(app, "createBatch");
			await screen.findByText("Today");
			await testRouter.push(assistWith(words));
			await fireEvent.press(await screen.findByText("Analyse"));
			await fireEvent.press(await screen.findByText("Log as one item"));
			await waitFor(() => expect(sent(app, "createBatch")).toHaveLength(1));
			expect(app.getPathname()).toBe("/nutrition-assistance");
			await fireEvent.press(await screen.findByText("Log as one item"));
			await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
		});

		it("replaces the logged entries in the same write when continuing", async () => {
			const app = await logOnce();
			const [first] = sent(app, "createBatch");
			await continueFromDiary(app);
			await logWhenReady();
			await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
			expect(sent(app, "createBatch")[1]?.replaces).toEqual(
				first?.entries.map((entry) => ({
					kind: "clientEntryId",
					id: entry.clientEntryId,
				})),
			);
			expect(sent(app, "removeBatch")).toHaveLength(0);
		});

		it("says the meal is as it was when replacing it fails", async () => {
			const app = await logOnce();
			refuse(app, "createBatch");
			await continueFromDiary(app);
			await logWhenReady();
			expect(
				await screen.findByText(
					"This meal could not be replaced. Your diary is as it was.",
				),
			).toBeTruthy();
			expect(app.getPathname()).toBe("/nutrition-assistance");
		});

		it("offers undo again when it fails", async () => {
			const app = await logOnce();
			refuse(app, "removeBatch");
			// A toast's action only takes taps once it has been on screen a moment.
			const armed = () =>
				act(() => jest.advanceTimersByTime(ACTION_ARM_MS + 50));
			const undo = await screen.findByText("Undo");
			await armed();
			await fireEvent.press(undo);
			const again = await screen.findByText("Try again");
			await armed();
			await fireEvent.press(again);
			await waitFor(() => expect(sent(app, "removeBatch")).toHaveLength(2));
		});

		it("keeps the restored meal continuable when undo is retried", async () => {
			const app = await logOnce();
			await continueFromDiary(app);
			await logWhenReady();
			await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
			refuse(app, "createBatch");
			const armed = () =>
				act(() => jest.advanceTimersByTime(ACTION_ARM_MS + 50));
			const undo = await screen.findByText("Undo");
			await armed();
			await fireEvent.press(undo);
			const again = await screen.findByText("Try again");
			await armed();
			await fireEvent.press(again);
			// Logged once, replaced once, then the restore: refused, then retried.
			await waitFor(() => expect(sent(app, "createBatch")).toHaveLength(4));
			const [refused, retried] = sent(app, "createBatch")
				.slice(2)
				.map((operation) =>
					operation.entries.map((entry) => entry.clientEntryId),
				);
			expect(retried).toEqual(refused);
			// The fixture server does not push, so the diary is read afresh by
			// leaving the day and coming back to it.
			await fireEvent.press(
				screen.getByLabelText(
					formatLongDate(shiftIsoDate(todayIsoDate(), -1), "en"),
				),
			);
			await fireEvent.press(
				await screen.findByLabelText(formatLongDate(todayIsoDate(), "en")),
			);
			// The meal that came back is the one the help remembers.
			await continueFromDiary(app);
		});

		it("does not replace a meal that was edited since", async () => {
			const app = await logOnce();
			// A link to continuing, taken before the meal was edited.
			await continueFromDiary(app);
			const continuing = app.getSearchParams().resume;
			await testRouter.back();
			await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));

			await fireEvent.press(await screen.findByLabelText(LOGGED_ENTRY));
			await fireEvent.changeText(await screen.findByLabelText("Quantity"), "2");
			await fireEvent.press(screen.getByLabelText("Save changes"));
			await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));

			await fireEvent.press(await screen.findByLabelText(LOGGED_ENTRY));
			await screen.findByLabelText("Quantity");
			expect(screen.queryByLabelText("Continue with help")).toBeNull();

			await testRouter.push(
				`/nutrition-assistance?meal=lunch&resume=${continuing}`,
			);
			await logWhenReady();
			expect(sent(app, "createBatch")).toHaveLength(1);
		});
	});

	it("offers an earlier result for the same text without calling the AI", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "Bread",
			title: "Bread",
			sources: [],
			question: null,
			items: [{ ...bread, name: "Repeatable bread" }],
		});
		const repeatUrl = "/nutrition-assistance?meal=lunch&text=repeat+me";
		const app = await renderApp();
		await screen.findByText("Today");
		await testRouter.push(repeatUrl);
		await fireEvent.press(await screen.findByText("Analyse"));
		await fireEvent.press(await screen.findByText("Log as one item"));
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));

		describeMeal.mockClear();
		await testRouter.push(repeatUrl);
		await fireEvent.press(await screen.findByText(/^Use it again:/));
		expect(await screen.findByText("Bread")).toBeTruthy();
		expect(describeMeal).not.toHaveBeenCalled();
	});

	it("gives the same answer for the same words without calling the AI", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "Bread",
			title: "Bread",
			sources: [],
			question: null,
			items: [{ ...bread, kind: "ingredient", components: [], estimate: null }],
		});
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		await fireEvent.press(await screen.findByText("Change"));
		describeMeal.mockClear();
		await fireEvent.press(await screen.findByText("Analyse"));
		expect(await screen.findByText("Change")).toBeTruthy();
		expect(describeMeal).not.toHaveBeenCalled();
	});

	it("keeps the rows when looking up foods fails, after one retry", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "Bread",
			items: [bread],
		});
		choose.mockRejectedValue(new Error("network"));
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		expect(
			await screen.findByText(
				"Looking up the foods failed, so these are best guesses. Tap a row to change one.",
			),
		).toBeTruthy();
		// The best-ranked food stands in, marked as a guess, so it can be logged.
		expect(screen.getByText(/2 sneetjes/)).toBeTruthy();
		expect(choose).toHaveBeenCalledTimes(2);
	});

	it("keeps a typed correction when it fails, and sends the current rows", async () => {
		describeMeal.mockResolvedValueOnce({
			kind: "meal",
			seen: "Bread",
			title: "Bread",
			sources: [],
			question: null,
			items: [{ ...bread, kind: "ingredient", components: [], estimate: null }],
		});
		describeMeal.mockRejectedValueOnce(new Error("network"));
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		const field = await screen.findByLabelText("Adjust… e.g. “no onion”");
		await fireEvent.changeText(field, "three slices");
		await fireEvent.press(screen.getByLabelText("Send adjustment"));
		expect(
			await screen.findByText(
				"Analysing failed. Your text is still here; try again.",
			),
		).toBeTruthy();
		expect(screen.getByDisplayValue("three slices")).toBeTruthy();
		expect(describeMeal).toHaveBeenLastCalledWith(
			expect.objectContaining({ followUps: ["three slices"] }),
		);
	});

	it("says a removal changed nothing and keeps the words in the field", async () => {
		const meal = {
			kind: "meal",
			seen: "Bread",
			title: "Bread",
			sources: [],
			question: null,
			items: [{ ...bread, kind: "ingredient", components: [], estimate: null }],
		};
		describeMeal.mockResolvedValue(meal);
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		const field = await screen.findByLabelText("Adjust… e.g. “no onion”");
		await fireEvent.changeText(field, "no onion");
		await fireEvent.press(screen.getByLabelText("Send adjustment"));
		expect(
			await screen.findByText(
				"That correction did not apply. Try saying it another way.",
			),
		).toBeTruthy();
		expect(screen.getByDisplayValue("no onion")).toBeTruthy();
	});

	it("asks one question per meal, also when the AI rewords it", async () => {
		const asked = {
			kind: "meal",
			seen: "Bread",
			title: "Bread",
			sources: [],
			items: [{ ...bread, kind: "ingredient", components: [], estimate: null }],
		};
		describeMeal.mockResolvedValueOnce({
			...asked,
			question: { text: "Raw or cooked?", options: ["Raw", "Cooked"] },
		});
		describeMeal.mockResolvedValueOnce({
			...asked,
			question: { text: "Weighed raw?", options: ["Yes", "No"] },
		});
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		await fireEvent.press(await screen.findByText("Raw"));
		await waitFor(() => expect(describeMeal).toHaveBeenCalledTimes(2));
		await waitFor(() =>
			expect(screen.queryByText("Raw or cooked?")).toBeNull(),
		);
		expect(screen.queryByText("Weighed raw?")).toBeNull();
	});

	it("does not log past a correction that was typed and not sent", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "Bread",
			title: "Bread",
			sources: [],
			question: null,
			items: [{ ...bread, kind: "ingredient", components: [], estimate: null }],
		});
		const app = await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		const field = await screen.findByLabelText("Adjust… e.g. “no onion”");
		await fireEvent.changeText(field, "three slices");
		expect(
			await screen.findByText("Send your correction first, or clear it."),
		).toBeTruthy();
		await fireEvent.press(screen.getByText("Log as one item"));
		expect(sent(app, "createBatch")).toEqual([]);
		await fireEvent.changeText(field, "");
		await waitFor(() =>
			expect(
				screen.queryByText("Send your correction first, or clear it."),
			).toBeNull(),
		);
	});

	it("explains the daily limit and offers saving a note instead", async () => {
		describeMeal.mockRejectedValue(new ConvexError({ code: "limit" }));
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		expect(
			await screen.findByText("You reached today's 50 analyses"),
		).toBeTruthy();
		expect(screen.getByText("Save as note")).toBeTruthy();
	});

	it("does not send anything while offline", async () => {
		const connection = jest.mocked(useConvexConnectionState);
		const previous = connection.getMockImplementation();
		connection.mockReturnValue({ isWebSocketConnected: false } as never);
		await renderApp(url);
		await fireEvent.press(await screen.findByText("Analyse"));
		expect(await screen.findByText("No connection")).toBeTruthy();
		expect(describeMeal).not.toHaveBeenCalled();
		if (previous) connection.mockImplementation(previous);
	});
});
