import { useMutation } from "convex/react";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { StyleSheet } from "react-native";
import { renderApp } from "../../../../test-support/render-app";
import { isIOS26OrLater } from "../../../../ui/platform";

jest.mock("../../../../ui/platform", () => ({
	isIOS26OrLater: jest.fn(() => false),
}));

const mockUseMutation = jest.mocked(useMutation);
const mockIOS26 = jest.mocked(isIOS26OrLater);

afterEach(() => mockIOS26.mockReturnValue(false));

/** The picker's results: the scroll view that holds the quick-log rows. */
function resultsList() {
	return screen.getByTestId("log-food-results");
}

/** The bottom padding under the last result. */
function resultsBottomPadding() {
	return StyleSheet.flatten(resultsList().props.contentContainerStyle)
		.paddingBottom as number;
}

describe("quick log with the search keyboard open (APP-56)", () => {
	it("logs on the first tap and keeps the query and the keyboard", async () => {
		const log = jest.fn().mockResolvedValue("entry-1");
		mockUseMutation.mockReturnValue(
			log as unknown as ReturnType<typeof useMutation>,
		);
		await renderApp();
		await fireEvent.press(
			await screen.findByLabelText("Add food to Breakfast"),
		);
		const search = screen.getByPlaceholderText("Search foods");
		await fireEvent(search, "focus");
		await fireEvent.changeText(search, "apple");

		// A tap on a row's + is handled by the row, so the list must not spend
		// it on dismissing the keyboard first.
		expect(resultsList().props.keyboardShouldPersistTaps).toBe("handled");
		await fireEvent.press(await screen.findByLabelText("Quick log Apple"));

		await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
		expect(await screen.findByText("Added Apple to Breakfast")).toBeTruthy();
		expect(screen.getByPlaceholderText("Search foods").props.value).toBe(
			"apple",
		);
	});

	it("keeps the last results clear of the floating iOS 26 search field", async () => {
		mockIOS26.mockReturnValue(true);
		await renderApp();
		await fireEvent.press(
			await screen.findByLabelText("Add food to Breakfast"),
		);
		// The field floats 58pt above the keyboard, outside the system's keyboard
		// inset; a + resting under it would hit the field's close button instead.
		// 40 is the list's ordinary bottom padding.
		expect(resultsBottomPadding()).toBeGreaterThanOrEqual(40 + 58);
	});
});
