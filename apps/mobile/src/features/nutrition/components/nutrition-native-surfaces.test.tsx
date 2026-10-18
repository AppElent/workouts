import { fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { renderThemed as render } from "../../../test-support/render-themed";
import { DatePickerSheet } from "../../../ui/date-picker-sheet.ios";
import { FoodEditorSheet } from "../../../ui/food-editor-sheet.ios";
import { NutritionHeaderMenu } from "./nutrition-header-menu.ios";

it("binds the Nutrition SwiftUI menu directly to feature callbacks", async () => {
	const onOpenFoodLibrary = jest.fn();
	const onOpenSettings = jest.fn();
	const onOpenWeekOverview = jest.fn();
	const onToggleDataSources = jest.fn();
	await render(
		<NutritionHeaderMenu
			label="More nutrition tools"
			closeLabel="Close"
			weekOverviewLabel="Week overview"
			foodLibraryLabel="Food library"
			assistanceLabel="Assistance"
			settingsLabel="Settings"
			goalsLabel="Goals"
			dataSourcesLabel="Data sources"
			onOpenFoodLibrary={onOpenFoodLibrary}
			onOpenWeekOverview={onOpenWeekOverview}
			onOpenAssistance={jest.fn()}
			onOpenSettings={onOpenSettings}
			onOpenGoals={jest.fn()}
			onToggleDataSources={onToggleDataSources}
		/>,
	);

	await fireEvent.press(screen.getByLabelText("More nutrition tools"));
	await fireEvent.press(screen.getByLabelText("Week overview"));
	await fireEvent.press(screen.getByLabelText("Food library"));
	await fireEvent.press(screen.getByLabelText("Settings"));
	await fireEvent.press(screen.getByLabelText("Data sources"));
	expect(onOpenWeekOverview).toHaveBeenCalledTimes(1);
	expect(onOpenFoodLibrary).toHaveBeenCalledTimes(1);
	expect(onOpenSettings).toHaveBeenCalledTimes(1);
	expect(onToggleDataSources).toHaveBeenCalledTimes(1);
});

it("presents food editing as a full-height native sheet with a drag indicator", async () => {
	await render(
		<FoodEditorSheet visible onClose={jest.fn()}>
			<Text>Food editor</Text>
		</FoodEditorSheet>,
	);

	const modifiers = screen.getByTestId("swiftui-group").props.modifiers;
	expect(modifiers).toContainEqual({
		type: "presentationDetents",
		args: [["large"]],
	});
	expect(modifiers).toContainEqual({
		type: "presentationDragIndicator",
		args: ["visible"],
	});
});

it("leaves no native overlay behind when the date picker is closed", async () => {
	const props = {
		date: "2026-10-04",
		today: "2026-10-04",
		locale: "en",
		title: "Date",
		todayLabel: "Today",
		doneLabel: "Done",
		closeLabel: "Close",
		onSelect: jest.fn(),
		onClose: jest.fn(),
	};
	const view = await render(<DatePickerSheet {...props} visible={false} />);
	expect(view.toJSON()).toBeNull();
	await view.rerender(<DatePickerSheet {...props} visible />);
	await fireEvent.press(screen.getByText("Done"));
	expect(props.onClose).toHaveBeenCalledTimes(1);
	await view.rerender(<DatePickerSheet {...props} visible={false} />);
	expect(view.toJSON()).toBeNull();
});
