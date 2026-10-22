jest.unmock("./query-cache");

import { renderHook } from "@testing-library/react-native";
import { usePaginatedQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { usePausablePaginatedQuery } from "./query-cache";

const list = makeFunctionReference<
	"query",
	{ date: string; paginationOpts: { numItems: number; cursor: string | null } },
	{ page: string[]; isDone: boolean; continueCursor: string }
>("test:list");

function page(results: string[] | undefined) {
	return results
		? { results, status: "Exhausted", isLoading: false, loadMore: jest.fn() }
		: {
				results: [],
				status: "LoadingFirstPage",
				isLoading: true,
				loadMore: jest.fn(),
			};
}

describe("usePausablePaginatedQuery", () => {
	it("keeps the last page for the same arguments while paused and resubscribing", async () => {
		let served: string[] | undefined = ["a", "b"];
		jest
			.mocked(usePaginatedQuery)
			.mockImplementation(((_query: unknown, args: unknown) =>
				page(args === "skip" ? undefined : served)) as never);
		const { result, rerender } = await renderHook(
			({ date, active }: { date: string; active: boolean }) =>
				usePausablePaginatedQuery(
					list,
					{ date },
					{ initialNumItems: 50 },
					active,
				),
			{ initialProps: { date: "2026-10-18", active: true } },
		);
		expect(result.current.status).toBe("Exhausted");

		await rerender({ date: "2026-10-18", active: false });
		expect(jest.mocked(usePaginatedQuery)).toHaveBeenLastCalledWith(
			list,
			"skip",
			{ initialNumItems: 50 },
		);
		expect(result.current).toMatchObject({
			status: "LoadingMore",
			results: ["a", "b"],
		});

		served = undefined;
		await rerender({ date: "2026-10-18", active: true });
		expect(result.current).toMatchObject({
			status: "LoadingMore",
			results: ["a", "b"],
		});

		await rerender({ date: "2026-10-19", active: true });
		expect(result.current).toMatchObject({
			status: "LoadingFirstPage",
			results: [],
		});
	});
});
