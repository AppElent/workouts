import { fireEvent, screen } from "@testing-library/react-native";
import { itemNutrients, type ReviewItem } from "../../../../data/nutrition-ai";
import { renderScreen } from "../../../../test-support/render-screen";
import { AssistanceItemSheet } from "../assistance-item-sheet";

const value = (amount: number) => ({ kind: "value", amount }) as const;

const estimated = {
	key: "item-0",
	kind: "product",
	described: "Lasagne",
	amount: 400,
	grams: 400,
	unit: "g",
	amountLabel: "1 portie",
	confidence: "medium",
	candidates: [],
	estimate: {
		energy: value(400),
		protein: value(20),
		carbs: value(40),
		fat: value(15),
		saturatedFat: value(5),
		sugars: value(5),
		fibre: value(3),
		salt: value(1),
	},
} as unknown as ReviewItem;

describe("AssistanceItemSheet", () => {
	async function edit(item: ReviewItem) {
		const onChange = jest.fn();
		await renderScreen(
			<AssistanceItemSheet
				item={item}
				onChange={onChange}
				onRemove={jest.fn()}
				onClose={jest.fn()}
			/>,
		);
		await fireEvent.changeText(screen.getByLabelText("Energy"), "600");
		return onChange;
	}

	it("scales a value set by hand when the portion changes", async () => {
		const onChange = await edit(estimated);
		await fireEvent.press(screen.getByText("2×"));
		await fireEvent.press(screen.getByText("Done"));
		const saved = onChange.mock.calls[0]?.[0] as ReviewItem;
		expect(itemNutrients(saved)?.energy).toEqual(value(1200));
	});

	it("keeps a value set by hand after going back to the first amount", async () => {
		const onChange = await edit(estimated);
		await fireEvent.press(screen.getByText("2×"));
		await fireEvent.press(screen.getByText("½×"));
		await fireEvent.press(screen.getByText("Done"));
		const saved = onChange.mock.calls[0]?.[0] as ReviewItem;
		expect(itemNutrients(saved)?.energy).toEqual(value(600));
	});
});
