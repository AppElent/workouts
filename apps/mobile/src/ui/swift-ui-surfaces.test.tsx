import { fireEvent, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { NutritionHeaderMenu } from "../screens/nutrition-header-menu.ios";
import { renderThemed as render } from "../test-support/render-themed";
import { FoodEditorSheet } from "./food-editor-sheet.ios";
import { NativeSwipeableRow } from "./native-swipeable-row.ios";
import { SetEditSheetPresentation } from "./set-edit-sheet-presentation.ios";

it("keeps native swipe deletion tap-only and screen-reader reachable", () => {
	const open = jest.fn();
	const remove = jest.fn();
	render(
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
	fireEvent.press(screen.getByLabelText("Delete"));
	expect(remove).toHaveBeenCalledTimes(1);
	fireEvent(screen.getByLabelText("Squat"), "accessibilityAction", {
		nativeEvent: { actionName: "open" },
	});
	expect(open).toHaveBeenCalledTimes(1);
});

it("binds the Nutrition SwiftUI menu directly to feature callbacks", () => {
	const onOpenFoodLibrary = jest.fn();
	const onOpenSettings = jest.fn();
	const onOpenWeekOverview = jest.fn();
	const onToggleDataSources = jest.fn();
	render(
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

	fireEvent.press(screen.getByLabelText("More nutrition tools"));
	fireEvent.press(screen.getByLabelText("Week overview"));
	fireEvent.press(screen.getByLabelText("Food library"));
	fireEvent.press(screen.getByLabelText("Settings"));
	fireEvent.press(screen.getByLabelText("Data sources"));
	expect(onOpenWeekOverview).toHaveBeenCalledTimes(1);
	expect(onOpenFoodLibrary).toHaveBeenCalledTimes(1);
	expect(onOpenSettings).toHaveBeenCalledTimes(1);
	expect(onToggleDataSources).toHaveBeenCalledTimes(1);
});

it("disables interactive Set Edit dismissal while dirty or pending", () => {
	render(
		<SetEditSheetPresentation
			setNumber={1}
			exerciseName="Squat"
			weight={100}
			reps={5}
			setType="working"
			weightStep={2.5}
			busy={false}
			dirty
			onWeightChange={jest.fn()}
			onRepsChange={jest.fn()}
			onSetTypeChange={jest.fn()}
			onRequestClose={jest.fn()}
			onSave={jest.fn()}
			onDuplicate={jest.fn()}
			onDelete={jest.fn()}
		/>,
	);

	const modifiers = screen.getByTestId("swiftui-group").props.modifiers;
	expect(modifiers).toContainEqual({
		type: "interactiveDismissDisabled",
		args: [true],
	});
});

it("presents food editing as a full-height native sheet with a drag indicator", () => {
	render(
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
