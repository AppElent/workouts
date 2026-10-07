import { act, fireEvent, screen } from "@testing-library/react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { renderThemed as render } from "../test-support/render-themed";
import { ToastProvider, useToast } from "./toast";

function Trigger({ onUndo }: { onUndo: () => void }) {
	const toast = useToast();
	useEffect(() => {
		toast.success("Appel toegevoegd aan Lunch", {
			action: { label: "Ongedaan maken", onPress: onUndo },
		});
	}, [onUndo, toast]);
	return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("a toast with an action", () => {
	it("offers the action and dismisses itself once it is used", () => {
		const undo = jest.fn();
		render(
			<SafeAreaProvider
				initialMetrics={{
					frame: { x: 0, y: 0, width: 390, height: 844 },
					insets: { top: 47, left: 0, right: 0, bottom: 34 },
				}}
			>
				<ToastProvider>
					<Trigger onUndo={undo} />
				</ToastProvider>
			</SafeAreaProvider>,
		);
		expect(screen.getByText("Appel toegevoegd aan Lunch")).toBeTruthy();
		fireEvent.press(screen.getByRole("button", { name: "Ongedaan maken" }));
		expect(undo).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("Appel toegevoegd aan Lunch")).toBeNull();
	});

	it("stays long enough to reach the action", () => {
		render(
			<SafeAreaProvider
				initialMetrics={{
					frame: { x: 0, y: 0, width: 390, height: 844 },
					insets: { top: 47, left: 0, right: 0, bottom: 34 },
				}}
			>
				<ToastProvider>
					<Trigger onUndo={() => {}} />
				</ToastProvider>
			</SafeAreaProvider>,
		);
		act(() => jest.advanceTimersByTime(4500));
		expect(screen.getByText("Appel toegevoegd aan Lunch")).toBeTruthy();
		act(() => jest.advanceTimersByTime(2000));
		expect(screen.queryByText("Appel toegevoegd aan Lunch")).toBeNull();
	});
});
