/**
 * The markers' own state mapping: a day is marked only on a confirmed "yes",
 * and none are on everything else — including the states a normal `useQuery`
 * cannot represent, which is exactly why this hook is built on
 * `useQuery_experimental` instead. A slow, failed, or offline lookup must
 * hide the markers, not throw through the food diary around it.
 */
import { renderHook } from "@testing-library/react-native";
import { useQuery_experimental } from "convex/react";
import { useTrainedDates } from "./training-marker";

const mockUseQuery = jest.mocked(useQuery_experimental);
const week = () => useTrainedDates("2026-09-07", "2026-09-09");

describe("the training markers' own hook", () => {
	it("marks nothing while the lookup is still pending", async () => {
		mockUseQuery.mockReturnValue({ status: "pending" });
		const { result } = await renderHook(week);
		expect([...result.current]).toEqual([]);
	});

	it("marks nothing when the lookup fails", async () => {
		mockUseQuery.mockReturnValue({
			status: "error",
			error: new Error("offline"),
		});
		const { result } = await renderHook(week);
		expect([...result.current]).toEqual([]);
	});

	it("asks for each local day and marks the confirmed ones", async () => {
		mockUseQuery.mockReturnValue({
			status: "success",
			data: [true, false, true],
		});
		const { result } = await renderHook(week);
		expect([...result.current]).toEqual(["2026-09-07", "2026-09-09"]);
		const [{ args }] = mockUseQuery.mock.lastCall as [
			{ args: { days: unknown[] } },
		];
		expect(args.days).toHaveLength(3);
	});
});
