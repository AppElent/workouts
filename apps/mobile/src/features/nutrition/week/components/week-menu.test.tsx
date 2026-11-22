import { fireEvent, screen } from "@testing-library/react-native";
import { renderThemed as render } from "../../../../test-support/render-themed";
import { WeekMenu } from "./week-menu.ios";

function renderMenu() {
	const onOpenToday = jest.fn();
	const onOpenGoals = jest.fn();
	return {
		onOpenToday,
		onOpenGoals,
		rendered: render(
			<WeekMenu
				label="More"
				openTodayLabel="Open today"
				goalsLabel="Goals"
				onOpenToday={onOpenToday}
				onOpenGoals={onOpenGoals}
			/>,
		),
	};
}

it("centres the ellipsis in the full 44pt header capsule (APP-576)", async () => {
	await renderMenu().rendered;
	const modifiers = screen.getByTestId("swiftui-menu").props.modifiers;
	expect(modifiers).toContainEqual({
		type: "frame",
		args: [{ width: 44, height: 44 }],
	});
	expect(modifiers).toContainEqual(
		expect.objectContaining({ type: "contentShape" }),
	);
});

it("binds both week actions to the feature callbacks", async () => {
	const { onOpenToday, onOpenGoals, rendered } = renderMenu();
	await rendered;
	await fireEvent.press(screen.getByLabelText("More"));
	await fireEvent.press(screen.getByLabelText("Open today"));
	await fireEvent.press(screen.getByLabelText("Goals"));
	expect(onOpenToday).toHaveBeenCalledTimes(1);
	expect(onOpenGoals).toHaveBeenCalledTimes(1);
});
