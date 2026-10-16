import { fireEvent, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { renderThemed as render } from "../../../test-support/render-themed";
import { DatePickerSheet } from "../../../ui/date-picker-sheet.ios";
import { FoodEditorSheet } from "../../../ui/food-editor-sheet.ios";
import { NativeSwipeableRow } from "../../../ui/native-swipeable-row.ios";
import { NutritionHeaderMenu } from "./nutrition-header-menu.ios";

it("keeps native swipe deletion tap-only and screen-reader reachable", async () => {
	const open = jest.fn();
	const remove = jest.fn();
	await render(
		<NativeSwipeableRow
			menuTitle="Squat"
			closeMenuLabel="Close"
			actions={[
				{ key: "open", label: "View exercise", onPress: open },
				{ key: "delete", label: "Delete", destructive: true, onPress: remove },
			]}
		>
			{(accessibility) => (
				<Pressable accessibilityLabel="Squat" {...accessibility}>
					<Text>Squat</Text>
				</Pressable>
			)}
		</NativeSwipeableRow>,
	);

	expect(
		screen.getByTestId("swiftui-swipe-actions").props.allowsFullSwipe,
	).toBe(false);
	await fireEvent.press(screen.getByLabelText("Delete"));
	expect(remove).toHaveBeenCalledTimes(1);
	await fireEvent(screen.getByLabelText("Squat"), "accessibilityAction", {
		nativeEvent: { actionName: "open" },
	});
	expect(open).toHaveBeenCalledTimes(1);
});

it("keeps a native swipe row full-width and lets its child handle a plain tap", async () => {
	const open = jest.fn();
	await render(
		<NativeSwipeableRow
			menuTitle="Squat"
			closeMenuLabel="Close"
			actions={[{ key: "open", label: "View exercise", onPress: open }]}
		>
			{(accessibility) => (
				<Pressable onPress={open} accessibilityLabel="Squat" {...accessibility}>
					<Text>Squat</Text>
				</Pressable>
			)}
		</NativeSwipeableRow>,
	);

	expect(screen.getByTestId("native-swipeable-row").props.style).toEqual(
		expect.objectContaining({ width: "100%" }),
	);
	await fireEvent.press(screen.getByLabelText("Squat"));
	expect(open).toHaveBeenCalledTimes(1);
});

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
