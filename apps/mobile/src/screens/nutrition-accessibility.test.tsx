/**
 * What a person who cannot see the screen, or cannot use a gesture, gets.
 *
 * Three of spec #68's accessibility rules are checkable here without a device,
 * and they are the three that regress silently:
 *
 * 1. Icon-only controls have a name. A plus button, a chevron and a back arrow
 *    are all "button" to a screen reader unless someone says otherwise, and
 *    the whole meaning of the control is that label.
 * 2. Colour is never the only signal. Every goal state is a word as well as a
 *    colour, and the word is in the row's spoken name — so "over your salt
 *    maximum" reaches someone who cannot see the bar turn red.
 * 3. State that is drawn is also announced. A collapsed section reports that
 *    it is collapsed; a selected entry reports that it is checked.
 *
 * What is left for the device — contrast, hit-target size under a real finger,
 * and whether dynamic type actually clips at 310% — is in the verify skill's
 * mobile section, because none of it is answerable from a test renderer.
 */
import { useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { fireEvent, screen } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

const value = (amount: number) => ({ kind: "value" as const, amount });

const entry = {
	_id: "entry-1",
	meal: "breakfast" as const,
	name: { en: "Oatmeal", nl: "Havermout" },
	serving: { en: "Bowl × 1", nl: "Kom × 1" },
	quantity: 1,
	nutrients: {
		energy: value(180),
		protein: value(6),
		carbs: value(30),
		fat: value(3),
		saturatedFat: value(0.6),
		fibre: value(4),
		sugars: value(1),
		salt: value(0.01),
	},
};

/** One met minimum and one exceeded maximum, so both words have to appear. */
const goals = [
	{ nutrient: "protein", direction: "min", target: 100 },
	{ nutrient: "salt", direction: "max", target: 6 },
];

function mockDay(withGoals: boolean) {
	jest.mocked(useQuery).mockImplementation((reference, _args?) => {
		if (getFunctionName(reference) === "nutritionGoals:forDate")
			return {
				goals: withGoals ? goals : [],
				basis: "reference",
				effectiveFrom: null,
			};
		if (getFunctionName(reference) === "nutritionGoals:list")
			return withGoals ? goals : [];
		return {
			entries: [entry],
			totals: {
				protein: { amount: 120, qualified: false, incomplete: false },
				salt: { amount: 9, qualified: false, incomplete: false },
			},
		};
	});
}

beforeEach(() => {
	jest.clearAllMocks();
	mockDay(true);
	jest
		.mocked(useMutation)
		.mockReturnValue(
			jest.fn().mockResolvedValue(undefined) as unknown as ReturnType<
				typeof useMutation
			>,
		);
});

describe("Nutrition accessibility", () => {
	it("names every icon-only control on the day", async () => {
		renderApp();
		await screen.findByText("Today");

		// The four meal plus buttons say which meal they add to, so four
		// identical "+" glyphs are four different controls to a screen reader.
		for (const meal of ["Breakfast", "Lunch", "Dinner", "Snacks"]) {
			expect(screen.getByLabelText(`Add food to ${meal}`)).toBeTruthy();
		}
		// The date arrows carry a direction rather than a glyph.
		expect(screen.getAllByLabelText("Previous day").length).toBeGreaterThan(0);
		expect(screen.getAllByLabelText("Next day").length).toBeGreaterThan(0);
	});

	it("says how a goal is doing in words, not only in colour", async () => {
		renderApp();
		await screen.findByText("Today");

		// A minimum that has been reached and a maximum that has been passed are
		// two different sentences, and both are spoken as part of the row.
		expect(screen.getByLabelText(/Protein: .*\. Met\./)).toBeTruthy();
		fireEvent.press(screen.getByLabelText("Show additional goals"));
		expect(screen.getByLabelText(/Salt: .*\. Over\./)).toBeTruthy();
		// And the words are on screen too, not only in the accessible name.
		expect(screen.getByText("Met")).toBeTruthy();
		expect(screen.getByText("Over")).toBeTruthy();
	});

	it("announces the collapsed detail section as collapsed, and as expanded once opened", async () => {
		renderApp();
		const toggle = await screen.findByLabelText("Show other nutrients");

		expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
		fireEvent.press(toggle);

		const opened = screen.getByLabelText("Hide other nutrients");
		expect(opened.props.accessibilityState).toMatchObject({ expanded: true });
	});

	it("announces a Combo selection as a checkbox that is checked", async () => {
		renderApp();
		fireEvent.press(screen.getByLabelText("More nutrition tools"));
		fireEvent.press(await screen.findByText("Create Combo"));

		const row = await screen.findByLabelText("Select Oatmeal for Combo");
		expect(row.props.accessibilityRole).toBe("checkbox");
		expect(row.props.accessibilityState).toMatchObject({ checked: false });

		fireEvent.press(row);
		expect(
			screen.getByLabelText("Select Oatmeal for Combo").props
				.accessibilityState,
		).toMatchObject({ checked: true });
	});

	it("gives the loading day one spoken name rather than a screen of blank shapes", async () => {
		jest.mocked(useQuery).mockReturnValue(undefined);
		renderApp();

		expect(await screen.findByLabelText("Loading the day")).toBeTruthy();
	});
});
