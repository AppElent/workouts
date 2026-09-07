/**
 * The promise is narrow and worth keeping: what the platform says about
 * reduced motion is what the app does, including when the person changes
 * their mind with the app already open.
 */
import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { modalAnimation, useReduceMotion } from "./reduce-motion";

function Probe() {
	return <Text>{useReduceMotion() ? "reduced" : "full"}</Text>;
}

type Listener = (enabled: boolean) => void;

function mockPlatform(initial: boolean) {
	const listeners: Listener[] = [];
	jest
		.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
		.mockResolvedValue(initial);
	// `addEventListener` is overloaded per event name; the mock has to stand in
	// for all of them, so it is typed by its widest shape rather than one arm.
	const addEventListener = jest.spyOn(
		AccessibilityInfo,
		"addEventListener",
	) as unknown as jest.SpyInstance<
		{ remove: () => void },
		[string, (payload: never) => void]
	>;
	addEventListener.mockImplementation((event, handler) => {
		if (event === "reduceMotionChanged") listeners.push(handler as Listener);
		return { remove: () => undefined };
	});
	return {
		change: async (enabled: boolean) => {
			await act(async () => {
				for (const listener of listeners) listener(enabled);
			});
		},
	};
}

afterEach(() => jest.restoreAllMocks());

describe("reduced motion", () => {
	it("follows the system setting once the platform has answered", async () => {
		mockPlatform(true);
		render(<Probe />);
		expect(await screen.findByText("reduced")).toBeTruthy();
	});

	it("leaves motion alone when nobody asked for it to stop", async () => {
		mockPlatform(false);
		render(<Probe />);
		expect(await screen.findByText("full")).toBeTruthy();
	});

	it("follows a change made while the app is already open", async () => {
		const platform = mockPlatform(false);
		render(<Probe />);
		expect(await screen.findByText("full")).toBeTruthy();
		await platform.change(true);
		expect(screen.getByText("reduced")).toBeTruthy();
	});

	it("treats a platform that cannot answer as no preference", async () => {
		jest
			.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
			.mockRejectedValue(new Error("unsupported"));
		jest
			.spyOn(AccessibilityInfo, "addEventListener")
			.mockReturnValue({ remove: () => undefined } as never);
		render(<Probe />);
		expect(await screen.findByText("full")).toBeTruthy();
	});

	it("cuts rather than slides when motion is reduced, and still shows the modal", () => {
		expect(modalAnimation(false, "slide")).toBe("slide");
		expect(modalAnimation(false, "fade")).toBe("fade");
		// "none" is a cut, not a suppression: the modal still appears.
		expect(modalAnimation(true, "slide")).toBe("none");
		expect(modalAnimation(true, "fade")).toBe("none");
	});
});
