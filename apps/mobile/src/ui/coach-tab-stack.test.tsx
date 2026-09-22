import { screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { renderThemed as render } from "../test-support/render-themed";
import { CoachTabStack } from "./coach-tab-stack";

jest.mock("expo-router", () => {
	const React = jest.requireActual("react");
	const { View } = jest.requireActual("react-native");
	const Stack = ({
		children,
		screenOptions,
	}: {
		children: ReactNode;
		screenOptions: unknown;
	}) =>
		React.createElement(View, { screenOptions, testID: "tab-stack" }, children);
	Stack.Screen = ({ options }: { options: unknown }) =>
		React.createElement(View, { options, testID: "tab-root" });
	return { Stack };
});

it("configures tab roots with native large titles and minimal back buttons", () => {
	render(
		<View>
			<CoachTabStack title="Train" />
		</View>,
	);
	const options = screen.getByTestId("tab-stack").props.screenOptions;
	expect(options.headerBackButtonDisplayMode).toBe("minimal");
	expect(options.headerLargeTitle).toBe(true);
	expect(options.headerTransparent).toBe(true);
	expect(screen.getByTestId("tab-root").props.options.title).toBe("Train");
});
