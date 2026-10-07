import * as Sentry from "@sentry/react-native";
import { fireEvent, screen } from "expo-router/testing-library";
import { renderApp } from "../test-support/render-app";

it("opens feedback from Profile without requiring a shake", async () => {
	renderApp("/profile");
	fireEvent.press(await screen.findByLabelText("Report a problem"));
	expect(Sentry.showFeedbackForm).toHaveBeenCalled();
});

it("surfaces a feedback opening failure", async () => {
	jest.mocked(Sentry.showFeedbackForm).mockImplementationOnce(() => {
		throw new Error("Unavailable");
	});
	renderApp("/profile");
	fireEvent.press(await screen.findByLabelText("Report a problem"));
	expect(
		await screen.findByText(
			"Could not open the feedback form. Please try again.",
		),
	).toBeTruthy();
});
