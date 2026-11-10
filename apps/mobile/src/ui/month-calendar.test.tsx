import { fireEvent, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { LocaleProvider } from "../i18n";
import {
	PREFERENCE_KEYS,
	removeLocal,
	writeLocal,
} from "../local-store/local-store";
import { renderThemed } from "../test-support/render-themed";
import { MonthCalendar } from "./month-calendar";

const render = (ui: ReactElement) =>
	renderThemed(ui, { wrapper: LocaleProvider });

describe("MonthCalendar", () => {
	afterEach(() => removeLocal(PREFERENCE_KEYS.locale));

	it("renders an actual leap-month grid and lets the user select a day", async () => {
		const onSelect = jest.fn();
		await render(
			<MonthCalendar
				selectedDate="2028-02-29"
				today="2028-02-01"
				onSelect={onSelect}
			/>,
		);
		expect(screen.getByText("February 2028")).toBeTruthy();
		await fireEvent.press(
			screen.getByLabelText(/Tuesday 29 February, 2028-02-29/),
		);
		expect(onSelect).toHaveBeenCalledWith("2028-02-29");
	});

	it("moves to the next month without snapping back and selects its date", async () => {
		const onSelect = jest.fn();
		await render(
			<MonthCalendar
				selectedDate="2026-01-15"
				today="2026-01-15"
				onSelect={onSelect}
			/>,
		);
		await fireEvent.press(screen.getByLabelText("Next month"));
		expect(screen.getByText("February 2026")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText(/10 February, 2026-02-10/));
		expect(onSelect).toHaveBeenCalledWith("2026-02-10");
	});

	it("has an accessible Today action", async () => {
		const onSelect = jest.fn();
		await render(
			<MonthCalendar
				selectedDate="2026-01-15"
				today="2026-03-03"
				onSelect={onSelect}
			/>,
		);
		await fireEvent.press(screen.getByLabelText("Today"));
		expect(onSelect).toHaveBeenCalledWith("2026-03-03");
	});

	it("follows the app language for its labels, month and weekdays", async () => {
		writeLocal(PREFERENCE_KEYS.locale, "nl");
		await render(
			<MonthCalendar selectedDate="2026-01-15" onSelect={jest.fn()} />,
		);

		expect(screen.getByLabelText("Vorige maand")).toBeTruthy();
		expect(screen.getByLabelText("Volgende maand")).toBeTruthy();
		expect(screen.getByText(/januari 2026/i)).toBeTruthy();
	});
});
