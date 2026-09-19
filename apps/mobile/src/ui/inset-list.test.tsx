import { fireEvent, render, screen } from "@testing-library/react-native";
import { InsetList, InsetRow } from "./inset-list";

// Jest resolves `./inset-list` to the SwiftUI file (jest-expo defaults to
// iOS), against the `@expo/ui` mock in jest.setup.ts. The RN drawing is
// covered by the Android device pass, not here.

it("renders a section with header, footer and rows the user can press", () => {
	const open = jest.fn();
	render(
		<InsetList header="Library" footer="Benchmarks and your own.">
			<InsetRow
				title="Exercises"
				secondary="42 exercises"
				chevron
				onPress={open}
				leading={{ sport: "strength" }}
			/>
			<InsetRow title="WODs" value="12" leading={{ symbol: "flame" }} />
		</InsetList>,
	);
	expect(screen.getByText("Library")).toBeTruthy();
	expect(screen.getByText("Benchmarks and your own.")).toBeTruthy();
	expect(screen.getByText("12")).toBeTruthy();
	fireEvent.press(screen.getByLabelText("Exercises, 42 exercises"));
	expect(open).toHaveBeenCalledTimes(1);
	// A row without onPress is not announced as a button.
	expect(screen.getByLabelText("WODs").props.accessibilityRole).toBeUndefined();
});

it("puts every action in the context menu and only swipeable ones in the swipe", () => {
	const edit = jest.fn();
	const remove = jest.fn();
	render(
		<InsetList>
			<InsetRow
				title="Push day"
				actions={[
					{ key: "edit", label: "Edit routine", onPress: edit, swipe: false },
					{
						key: "delete",
						label: "Delete routine",
						destructive: true,
						onPress: remove,
					},
				]}
			/>
		</InsetList>,
	);
	const swipe = screen.getByTestId("swiftui-swipe-actions");
	expect(swipe.props.allowsFullSwipe).toBe(false);
	expect(screen.getAllByLabelText("Delete routine")).toHaveLength(2);
	expect(screen.getAllByLabelText("Edit routine")).toHaveLength(1);
	fireEvent.press(screen.getAllByLabelText("Delete routine")[0]);
	expect(remove).toHaveBeenCalledTimes(1);
});

it("keeps a row without actions free of swipe and menu wrappers", () => {
	render(
		<InsetList>
			<InsetRow title="Language" value="Nederlands" chevron />
		</InsetList>,
	);
	expect(screen.queryByTestId("swiftui-swipe-actions")).toBeNull();
	expect(screen.queryByTestId("swiftui-context-menu")).toBeNull();
});
