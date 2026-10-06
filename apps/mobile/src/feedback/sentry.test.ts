import * as Sentry from "@sentry/react-native";
import { configureFeedbackLanguage } from "./sentry";

it("keeps automatic error screenshots off while permitting user-selected feedback attachments", () => {
	expect(Sentry.init).toHaveBeenCalledWith(
		expect.objectContaining({
			attachScreenshot: false,
			attachViewHierarchy: false,
		}),
	);
	expect(Sentry.feedbackIntegration).toHaveBeenCalledWith(
		expect.objectContaining({
			enableScreenshot: true,
			enableShakeToReport: true,
			showEmail: false,
			showName: false,
		}),
	);
});

it("localizes screenshot and feedback controls", () => {
	configureFeedbackLanguage("nl");
	const integration = jest.mocked(Sentry.feedbackIntegration).mock.results[0]
		.value;
	expect(integration.options).toMatchObject({
		formTitle: "Probleem melden",
		removeScreenshotButtonLabel: "Screenshot verwijderen",
	});
});
