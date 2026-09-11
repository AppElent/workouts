/**
 * The haptic vocabulary's contract, which is a two-part promise:
 *
 * 1. Each named event plays the platform's own signal for that *meaning* —
 *    iOS's notification/impact types, Android's `AndroidHaptics` constants —
 *    so an Android user gets the equivalent outcome rather than an iOS feel
 *    replayed badly (spec #68, "Android delivers equivalent outcomes using its
 *    native conventions").
 * 2. A haptic never takes its caller down. The device refuses these constantly
 *    — Low Power Mode, haptics off, camera open — and a rejected buzz must not
 *    turn a saved meal into a failed one.
 *
 * These are the module's observable behaviour, not its internals: "warning,
 * not error, when you are about to delete something" is a decision the rest of
 * the app relies on and would notice being changed.
 */

const mockSelectionAsync = jest.fn(async () => undefined);
const mockNotificationAsync = jest.fn(async () => undefined);
const mockImpactAsync = jest.fn(async () => undefined);
const mockPerformAndroidHapticsAsync = jest.fn(async () => undefined);

jest.mock("expo-haptics", () => ({
	selectionAsync: (...args: unknown[]) => mockSelectionAsync(...(args as [])),
	notificationAsync: (...args: unknown[]) =>
		mockNotificationAsync(...(args as [])),
	impactAsync: (...args: unknown[]) => mockImpactAsync(...(args as [])),
	performAndroidHapticsAsync: (...args: unknown[]) =>
		mockPerformAndroidHapticsAsync(...(args as [])),
	NotificationFeedbackType: {
		Success: "success",
		Warning: "warning",
		Error: "error",
	},
	ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
	AndroidHaptics: {
		Confirm: "confirm",
		Reject: "reject",
		Long_Press: "long-press",
	},
}));

import { Platform } from "react-native";
import { haptics } from "./haptics";

const originalOs = Platform.OS;

/** `Platform.OS` is a plain property, so a test can stand on either platform. */
function pretendPlatformIs(os: typeof Platform.OS): void {
	Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

beforeEach(() => {
	jest.clearAllMocks();
	pretendPlatformIs("ios");
});

afterAll(() => {
	pretendPlatformIs(originalOs);
});

describe("the haptic vocabulary", () => {
	it("plays selection feedback when a meaningful choice moves", () => {
		haptics.selectionChanged();
		expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
	});

	it("marks a logged entry as a success on iOS and a confirm on Android", () => {
		haptics.entryLogged();
		expect(mockNotificationAsync).toHaveBeenCalledWith("success");

		pretendPlatformIs("android");
		haptics.entryLogged();
		expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith("confirm");
	});

	it("warns rather than errors when a destructive confirmation is raised", () => {
		haptics.destructiveWarning();
		// Nothing has gone wrong yet — the user is being asked, not told off.
		expect(mockNotificationAsync).toHaveBeenCalledWith("warning");
		expect(mockNotificationAsync).not.toHaveBeenCalledWith("error");

		pretendPlatformIs("android");
		haptics.destructiveWarning();
		expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith("reject");
	});

	it("gives a light tap when a swipe passes the point of no return", () => {
		haptics.swipeThresholdPassed();
		expect(mockImpactAsync).toHaveBeenCalledWith("light");
	});

	it("uses each platform's own long-press feel when a menu opens", () => {
		haptics.menuOpened();
		expect(mockImpactAsync).toHaveBeenCalledWith("medium");

		pretendPlatformIs("android");
		haptics.menuOpened();
		expect(mockPerformAndroidHapticsAsync).toHaveBeenCalledWith("long-press");
	});

	it("swallows a refused haptic instead of failing the action that asked for it", () => {
		mockNotificationAsync.mockRejectedValueOnce(
			new Error("haptics unavailable"),
		);
		expect(() => haptics.entryLogged()).not.toThrow();

		mockSelectionAsync.mockImplementationOnce(() => {
			throw new Error("no native module");
		});
		expect(() => haptics.selectionChanged()).not.toThrow();
	});
});
