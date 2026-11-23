import {
	sanitizeBreadcrumb,
	sanitizeEvent,
	sanitizeFeedbackEvent,
} from "@foundry/core";
import * as Sentry from "@sentry/react-native";
import { configureFeedbackLanguage } from "./sentry";

it("redacts events and never attaches personal data or automatic screenshots", () => {
	expect(Sentry.init).toHaveBeenCalledWith(
		expect.objectContaining({
			sendDefaultPii: false,
			attachScreenshot: false,
			attachViewHierarchy: false,
			beforeSend: sanitizeEvent,
			beforeBreadcrumb: sanitizeBreadcrumb,
		}),
	);
	expect(Sentry.addEventProcessor).toHaveBeenCalledWith(sanitizeFeedbackEvent);
	// User interaction tracing names transactions after the tapped element's
	// accessibility label, which carries workout values and the account name.
	expect(jest.mocked(Sentry.init).mock.calls[0][0]).not.toHaveProperty(
		"enableUserInteractionTracing",
	);
	expect(Sentry.feedbackIntegration).toHaveBeenCalledWith(
		expect.objectContaining({
			showEmail: false,
			showName: false,
			// Started by shake-to-report instead, which pauses under sheets.
			enableShakeToReport: false,
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
