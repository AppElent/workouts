import * as Sentry from "@sentry/react-native";
import { act } from "@testing-library/react-native";
import {
	launchCameraAsync as nativeLaunchCamera,
	launchImageLibraryAsync as nativeLaunchLibrary,
} from "expo-image-picker";
import { ActionSheetIOS, Alert, type AlertButton } from "react-native";
import {
	launchCameraAsync,
	launchImageLibraryAsync,
	showActionSheet,
	showAlert,
} from "./native-presentation";
import {
	DISMISS_SETTLE_MS,
	resetShakeToReportForTests,
	startShakeToReport,
} from "./shake-to-report";

jest.mock("expo-image-picker", () => ({
	launchImageLibraryAsync: jest.fn(),
	launchCameraAsync: jest.fn(),
}));

const settle = () =>
	act(() => {
		jest.advanceTimersByTime(DISMISS_SETTLE_MS);
	});
const paused = () => jest.mocked(Sentry.disableFeedbackOnShake);
const listening = () => jest.mocked(Sentry.enableFeedbackOnShake);

beforeEach(() => {
	jest.useFakeTimers();
	resetShakeToReportForTests();
	jest.restoreAllMocks();
	paused().mockClear();
	listening().mockClear();
	startShakeToReport();
	listening().mockClear();
});

afterEach(() => {
	jest.useRealTimers();
});

describe("showAlert", () => {
	function open(buttons?: AlertButton[], onDismiss?: () => void) {
		const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
		showAlert("Title", "Body", buttons, { cancelable: true, onDismiss });
		const [, , shown, options] = alert.mock.calls[0];
		return { shown: shown ?? [], options };
	}

	it("pauses shake while open and resumes after a button press settles", () => {
		const onPress = jest.fn();
		const { shown } = open([{ text: "Delete", onPress }]);
		expect(paused()).toHaveBeenCalledTimes(1);

		shown[0].onPress?.();
		expect(onPress).toHaveBeenCalledTimes(1);
		expect(listening()).not.toHaveBeenCalled();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases for the implicit OK button when no buttons are passed", () => {
		const { shown } = open();
		expect(shown).toHaveLength(1);
		shown[0].onPress?.();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases on dismiss and still calls the caller's onDismiss", () => {
		const onDismiss = jest.fn();
		const { options } = open([{ text: "OK" }], onDismiss);
		options?.onDismiss?.();
		expect(onDismiss).toHaveBeenCalledTimes(1);
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases once when both a button and dismiss fire", () => {
		const { shown, options } = open([{ text: "OK" }]);
		shown[0].onPress?.();
		options?.onDismiss?.();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases when Alert.alert throws", () => {
		jest.spyOn(Alert, "alert").mockImplementation(() => {
			throw new Error("boom");
		});
		expect(() => showAlert("Title")).toThrow("boom");
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});
});

describe("showActionSheet", () => {
	it("pauses shake until a choice, then calls back", () => {
		const sheet = jest
			.spyOn(ActionSheetIOS, "showActionSheetWithOptions")
			.mockImplementation(() => {});
		const callback = jest.fn();
		showActionSheet(
			{ options: ["A", "Cancel"], cancelButtonIndex: 1 },
			callback,
		);
		expect(paused()).toHaveBeenCalledTimes(1);

		sheet.mock.calls[0][1](1);
		expect(callback).toHaveBeenCalledWith(1);
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});
});

describe.each([
	["launchImageLibraryAsync", launchImageLibraryAsync, nativeLaunchLibrary],
	["launchCameraAsync", launchCameraAsync, nativeLaunchCamera],
] as const)("%s", (_name, launch, native) => {
	it("pauses shake while the picker is open and resumes after it settles", async () => {
		let finish: (result: unknown) => void = () => {};
		jest
			.mocked(native)
			.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
		const pending = launch({ quality: 1 });
		expect(paused()).toHaveBeenCalledTimes(1);
		expect(native).toHaveBeenCalledWith({ quality: 1 });

		finish({ canceled: true, assets: null });
		await expect(pending).resolves.toEqual({ canceled: true, assets: null });
		expect(listening()).not.toHaveBeenCalled();
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});

	it("releases when the picker throws", async () => {
		jest.mocked(native).mockRejectedValue(new Error("no camera"));
		await expect(launch()).rejects.toThrow("no camera");
		settle();
		expect(listening()).toHaveBeenCalledTimes(1);
	});
});
