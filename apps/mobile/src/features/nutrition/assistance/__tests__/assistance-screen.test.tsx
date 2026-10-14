import { useAction, useConvexConnectionState } from "convex/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import {
	fireEvent,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import {
	clearPreference,
	PREFERENCE_KEYS,
	writePreference,
} from "../../../../prefs/local-preference";
import { renderApp } from "../../../../test-support/render-app";

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

beforeEach(() => {
	describeMeal.mockReset();
	choose.mockReset();
	readLabel.mockReset();
	scriptActions();
	writePreference(PREFERENCE_KEYS.nutritionAiConsent, "granted");
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
		clearPreference(PREFERENCE_KEYS.nutritionAiConsent);
		renderApp(url);
		fireEvent.press(await screen.findByText("Continue"));
		expect(await screen.findByText("Analyse")).toBeTruthy();
		expect(describeMeal).not.toHaveBeenCalled();
	});

	it("reviews matched and estimated items, then logs them as separate entries", async () => {
		describeMeal.mockResolvedValue({
			kind: "meal",
			seen: "Bread and a pancake",
			items: [bread, pancake],
		});
		const app = renderApp();
		await screen.findByText("Today");
		testRouter.push(url);
		fireEvent.press(await screen.findByText("Analyse"));

		expect(await screen.findByText("Bread and a pancake")).toBeTruthy();
		expect(describeMeal).toHaveBeenCalledWith(
			expect.objectContaining({ text: "bread and a pancake", locale: "en" }),
		);
		expect(choose).toHaveBeenCalledTimes(1);
		expect(screen.getByText("1 item is estimated")).toBeTruthy();
		expect(screen.getByText("Grandma's banana pancake")).toBeTruthy();
		expect(screen.getByText("~ 1 piece · 260 kcal")).toBeTruthy();
		expect(screen.getByText("Total")).toBeTruthy();

		fireEvent.press(screen.getByText("Log 2 items"));
		expect(await screen.findByText("2 items logged to Lunch")).toBeTruthy();
		await waitFor(() => expect(app.getPathname()).toBe("/nutrition"));
	});

	it("says when nothing edible was recognised and keeps the text", async () => {
		describeMeal.mockResolvedValue({ kind: "no_food", seen: "?", items: [] });
		renderApp(url);
		fireEvent.press(await screen.findByText("Analyse"));
		expect(await screen.findByText("No food recognised")).toBeTruthy();
		expect(screen.getByDisplayValue("bread and a pancake")).toBeTruthy();
	});

	it("explains the daily limit and offers saving a note instead", async () => {
		describeMeal.mockRejectedValue(new ConvexError("limit"));
		renderApp(url);
		fireEvent.press(await screen.findByText("Analyse"));
		expect(
			await screen.findByText("You reached today's 50 analyses"),
		).toBeTruthy();
		expect(screen.getByText("Save as note")).toBeTruthy();
	});

	it("does not send anything while offline", async () => {
		const connection = jest.mocked(useConvexConnectionState);
		const previous = connection.getMockImplementation();
		connection.mockReturnValue({ isWebSocketConnected: false } as never);
		renderApp(url);
		fireEvent.press(await screen.findByText("Analyse"));
		expect(await screen.findByText("No connection")).toBeTruthy();
		expect(describeMeal).not.toHaveBeenCalled();
		if (previous) connection.mockImplementation(previous);
	});
});
