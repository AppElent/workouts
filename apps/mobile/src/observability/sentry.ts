import {
	type Locale,
	SENTRY_DSN,
	sanitizeBreadcrumb,
	sanitizeEvent,
	sanitizeFeedbackEvent,
	sanitizeText,
	sentryTracesSampleRate,
} from "@foundry/core";
import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import { DICTIONARIES } from "../i18n/dictionaries";

const native = Platform.OS !== "web" && !isRunningInExpoGo();
const environment = Updates.channel || (__DEV__ ? "development" : "production");

const feedback = Sentry.feedbackIntegration({
	enableShakeToReport: true,
	enableScreenshot: true,
	enableTakeScreenshot: native,
	imagePicker: {
		async launchImageLibraryAsync(options) {
			const result = await ImagePicker.launchImageLibraryAsync(options);
			return {
				assets: result.assets?.map((asset) => ({
					uri: asset.uri,
					fileName: "feedback-screenshot",
					base64: asset.base64 ?? undefined,
				})),
			};
		},
	},
	showName: false,
	showEmail: false,
});

export function configureFeedbackLanguage(locale: Locale) {
	const text = DICTIONARIES[locale].feedback;
	Object.assign(feedback.options, {
		formTitle: text.report,
		messageLabel: text.message,
		messagePlaceholder: text.description,
		submitButtonLabel: text.submit,
		cancelButtonLabel: text.cancel,
		addScreenshotButtonLabel: text.add,
		captureScreenshotButtonLabel: text.take,
		removeScreenshotButtonLabel: text.remove,
		genericError: text.error,
		successMessageText: text.success,
		errorTitle: text.report,
		formError: text.error,
		captureScreenshotError: text.error,
	});
	Object.assign(feedback.screenshotButtonOptions, {
		triggerLabel: text.take,
		triggerAriaLabel: text.take,
	});
}
configureFeedbackLanguage("en");

Sentry.init({
	dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || SENTRY_DSN,
	environment,
	sendDefaultPii: false,
	// Local development must not pollute production issues or consume quota.
	enabled: !__DEV__,
	tracesSampleRate: sentryTracesSampleRate(environment),
	profilesSampleRate: native ? 0.25 : 0,
	replaysSessionSampleRate: native ? 0.05 : 0,
	replaysOnErrorSampleRate: native ? 1 : 0,
	enableNativeFramesTracking: native,
	enableLogs: true,
	logsOrigin: "js",
	enableAutoConsoleLogs: false,
	attachScreenshot: false,
	attachViewHierarchy: false,
	// Convex uses a websocket, not tracing headers. Do not send headers to
	// Clerk, food APIs, or arbitrary external services.
	tracePropagationTargets: [],
	beforeSend: sanitizeEvent,
	beforeSendTransaction: sanitizeEvent,
	beforeBreadcrumb: sanitizeBreadcrumb,
	beforeSendLog: (log) => ({ ...log, message: sanitizeText(log.message) }),
	integrations: [
		Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: native }),
		feedback,
		...(native
			? [
					Sentry.mobileReplayIntegration({
						maskAllText: true,
						maskAllImages: true,
						maskAllVectors: true,
					}),
				]
			: []),
	],
});

// Feedback skips beforeSend; redact the typed report text separately.
Sentry.addEventProcessor(sanitizeFeedbackEvent);
Sentry.setTag("app", "foundry-mobile");
// Which install sent it: production, preview or development (app.config.ts).
Sentry.setTag(
	"app.variant",
	String(Constants.expoConfig?.extra?.appVariant ?? "unknown"),
);
