import { fireEvent, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { renderThemed } from "../../../../test-support/render-themed";
import { GoalRowMenu } from "./goal-row-menu.ios";

it("routes native nutrient menu actions without opening the fallback action sheet", () => {
	const onSources = jest.fn();
	const onEdit = jest.fn();
	const onReorder = jest.fn();
	const onOpen = jest.fn();
	renderThemed(
		<GoalRowMenu
			disabled={false}
			onOpen={onOpen}
			onSources={onSources}
			onEdit={onEdit}
			onReorder={onReorder}
			sourcesLabel="Largest sources"
			editLabel="Edit goal"
			reorderLabel="Change order"
		>
			{() => <Text>Fat</Text>}
		</GoalRowMenu>,
	);
	fireEvent.press(screen.getByLabelText("Largest sources"));
	fireEvent.press(screen.getByLabelText("Edit goal"));
	fireEvent.press(screen.getByLabelText("Change order"));
	expect(onSources).toHaveBeenCalledTimes(1);
	expect(onEdit).toHaveBeenCalledTimes(1);
	expect(onReorder).toHaveBeenCalledTimes(1);
	expect(onOpen).not.toHaveBeenCalled();
});
