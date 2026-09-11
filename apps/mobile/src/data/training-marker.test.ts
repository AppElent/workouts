/**
 * The marker's own state mapping: visible only on a confirmed "yes", hidden
 * on everything else — including the states a normal `useQuery` cannot
 * represent, which is exactly why this hook is built on
 * `useQuery_experimental` instead. A slow, failed, or offline lookup must
 * hide the marker, not throw through the food diary around it.
 */
import { renderHook } from "@testing-library/react-native";
import { useQuery_experimental } from "convex/react";
import { useTrainingMarker } from "./training-marker";

const mockUseQuery = jest.mocked(useQuery_experimental);

describe("the training marker's own hook", () => {
	it("is hidden while the lookup is still pending", () => {
		mockUseQuery.mockReturnValue({ status: "pending" });

		const { result } = renderHook(() => useTrainingMarker("2026-09-05"));

		expect(result.current).toBe("hidden");
	});

	it("is hidden when the lookup fails", () => {
		mockUseQuery.mockReturnValue({
			status: "error",
			error: new Error("offline"),
		});

		const { result } = renderHook(() => useTrainingMarker("2026-09-05"));

		expect(result.current).toBe("hidden");
	});

	it("is hidden when no completed Activity is found", () => {
		mockUseQuery.mockReturnValue({ status: "success", data: false });

		const { result } = renderHook(() => useTrainingMarker("2026-09-05"));

		expect(result.current).toBe("hidden");
	});

	it("is visible when a completed Activity is found", () => {
		mockUseQuery.mockReturnValue({ status: "success", data: true });

		const { result } = renderHook(() => useTrainingMarker("2026-09-05"));

		expect(result.current).toBe("visible");
	});
});
