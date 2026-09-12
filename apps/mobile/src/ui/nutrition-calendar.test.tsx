import { fireEvent, render, screen } from "@testing-library/react-native";
import { NutritionCalendar } from "./nutrition-calendar";

describe("NutritionCalendar", () => {
	it("renders an actual leap-month grid and lets the user select a day", () => {
		const onSelect = jest.fn();
		render(
			<NutritionCalendar
				selectedDate="2028-02-29"
				today="2028-02-01"
				onSelect={onSelect}
			/>,
		);
		expect(screen.getByText("February 2028")).toBeTruthy();
		fireEvent.press(screen.getByLabelText(/Tuesday, February 29, 2028/));
		expect(onSelect).toHaveBeenCalledWith("2028-02-29");
	});

	it("moves to the next month without snapping back and selects its date", () => {
		const onSelect = jest.fn();
		render(
			<NutritionCalendar
				selectedDate="2026-01-15"
				today="2026-01-15"
				onSelect={onSelect}
			/>,
		);
		fireEvent.press(screen.getByLabelText("Next month"));
		expect(screen.getByText("February 2026")).toBeTruthy();
		fireEvent.press(screen.getByLabelText(/February 10, 2026/));
		expect(onSelect).toHaveBeenCalledWith("2026-02-10");
	});

	it("has an accessible Today action", () => {
		const onSelect = jest.fn();
		render(
			<NutritionCalendar
				selectedDate="2026-01-15"
				today="2026-03-03"
				onSelect={onSelect}
			/>,
		);
		fireEvent.press(screen.getByLabelText("Today"));
		expect(onSelect).toHaveBeenCalledWith("2026-03-03");
	});

	it("localizes navigation labels in Dutch", () => {
		const onSelect = jest.fn();
		render(
			<NutritionCalendar
				selectedDate="2026-01-15"
				onSelect={onSelect}
				locale="nl"
			/>,
		);

		expect(screen.getByLabelText("Vorige maand")).toBeTruthy();
		expect(screen.getByLabelText("Volgende maand")).toBeTruthy();
	});
});
