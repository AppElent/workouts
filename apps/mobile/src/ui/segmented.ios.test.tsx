import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions } from "react-native";
import { renderThemed } from "../test-support/render-themed";
import { Segmented } from "./segmented.ios";

const options = [
	{ value: "g", label: "Grams" },
	{ value: "ml", label: "Millilitres" },
];
const originalWindow = Dimensions.get("window");
afterEach(() => {
	Dimensions.set({ window: originalWindow });
	jest.restoreAllMocks();
});

it("delegates selection to the native segmented picker", () => {
	Dimensions.set({
		window: { width: 390, height: 844, scale: 3, fontScale: 1 },
	});
	const change = jest.fn();
	renderThemed(<Segmented options={options} value="g" onChange={change} />);
	const picker = screen.getByTestId("swiftui-picker");
	expect(picker.props.modifiers).toContainEqual({
		type: "pickerStyle",
		args: ["segmented"],
	});
	fireEvent(picker, "selectionChange", "ml");
	expect(change).toHaveBeenCalledWith("ml");
});

it("uses a native menu to preserve full labels at large text sizes", () => {
	Dimensions.set({
		window: { width: 390, height: 844, scale: 3, fontScale: 2 },
	});
	renderThemed(<Segmented options={options} value="g" onChange={jest.fn()} />);
	expect(screen.getByTestId("swiftui-picker").props.modifiers).toContainEqual({
		type: "pickerStyle",
		args: ["menu"],
	});
	expect(screen.getByText("Millilitres")).toBeTruthy();
});
