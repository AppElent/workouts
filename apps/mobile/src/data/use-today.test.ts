import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useToday } from "./use-today";

afterEach(() => jest.useRealTimers());

it("moves to the new day at local midnight", () => {
	jest.useFakeTimers({ now: new Date(2026, 9, 7, 23, 59, 0) });
	const { result } = renderHook(() => useToday());
	expect(result.current).toBe("2026-10-07");

	act(() => jest.advanceTimersByTime(2 * 60 * 1000));
	expect(result.current).toBe("2026-10-08");
});

it("catches up when the app returns from the background", () => {
	jest.useFakeTimers({ now: new Date(2026, 9, 7, 12, 0, 0) });
	const listeners: ((state: string) => void)[] = [];
	jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
		listeners.push(listener as (state: string) => void);
		return { remove: jest.fn() } as never;
	});
	const { result } = renderHook(() => useToday());

	// The timer did not fire while suspended; only the clock moved.
	jest.setSystemTime(new Date(2026, 9, 9, 8, 0, 0));
	act(() => {
		for (const listener of listeners) listener("active");
	});
	expect(result.current).toBe("2026-10-09");
});
