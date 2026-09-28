import { fireEvent, screen } from "@testing-library/react-native";
import { ActionSheetIOS, Pressable, Text } from "react-native";
import { Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { haptics } from "../feedback/haptics";
import { renderThemed } from "../test-support/render-themed";
import { SwipeableRow } from "./swipeable-row";

jest.mock("react-native-gesture-handler", () => ({
	...jest.requireActual("react-native-gesture-handler"),
	GestureHandlerRootView: jest.requireActual("react-native").View,
	GestureDetector: ({ children }: { children: import("react").ReactNode }) =>
		children,
}));
afterEach(() => jest.restoreAllMocks());
it("opens the iOS long-press menu with feedback but ignores swipe feedback when no actions can be revealed", () => {
	const menuHaptic = jest
		.spyOn(haptics, "menuOpened")
		.mockImplementation(() => {});
	const swipeHaptic = jest
		.spyOn(haptics, "swipeThresholdPassed")
		.mockImplementation(() => {});
	const menu = jest
		.spyOn(ActionSheetIOS, "showActionSheetWithOptions")
		.mockImplementation(() => {});
	const pan = jest.spyOn(Gesture, "Pan");
	renderThemed(
		<SafeAreaProvider
			initialMetrics={{
				frame: { x: 0, y: 0, width: 390, height: 844 },
				insets: { top: 0, right: 0, bottom: 0, left: 0 },
			}}
		>
			<GestureHandlerRootView>
				<SwipeableRow
					menuTitle="Bench press"
					closeMenuLabel="Cancel"
					actions={[
						{
							key: "clone",
							label: "Clone exercise",
							swipe: false,
							onPress: jest.fn(),
						},
					]}
				>
					{(props) => (
						<Pressable {...props} accessibilityLabel="Bench press">
							<Text>Bench press</Text>
						</Pressable>
					)}
				</SwipeableRow>
			</GestureHandlerRootView>
		</SafeAreaProvider>,
	);
	pan.mock.results[0].value.handlers.onUpdate({ translationX: -160 });
	pan.mock.results[0].value.handlers.onEnd();
	expect(swipeHaptic).not.toHaveBeenCalled();
	fireEvent(screen.getByLabelText("Bench press"), "longPress");
	expect(menu).toHaveBeenCalledWith(
		expect.objectContaining({ options: ["Clone exercise", "Cancel"] }),
		expect.any(Function),
	);
	expect(menuHaptic).toHaveBeenCalledTimes(1);
	expect(swipeHaptic).not.toHaveBeenCalled();
});
