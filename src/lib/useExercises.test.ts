import { renderHook } from "@testing-library/react";
import { SHIPPED_EXERCISES } from "@workouts/core/exercises";
import { usePaginatedQuery, useQuery } from "convex/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExercise, useExercises } from "./useExercises";

vi.mock("convex/react", () => ({
	useQuery: vi.fn(),
	usePaginatedQuery: vi.fn(),
}));
vi.mock("@convex/_generated/api", () => ({
	api: { exercises: { listPersonal: "listPersonal", getById: "getById" } },
}));

describe("locally shipped exercise reads", () => {
	beforeEach(() => vi.clearAllMocks());
	it("loads only personal pages, with no mapping or catalog query", () => {
		const loadMore = vi.fn();
		vi.mocked(usePaginatedQuery).mockReturnValue({
			results: [
				{ ...SHIPPED_EXERCISES[0], _id: "custom-id", isDefault: false },
			],
			status: "CanLoadMore",
			isLoading: false,
			loadMore,
		});
		const { result } = renderHook(() => useExercises());
		expect(result.current).toHaveLength(673);
		expect(
			result.current.some(
				(exercise) => exercise._id === SHIPPED_EXERCISES[0]._id,
			),
		).toBe(true);
		expect(loadMore).toHaveBeenCalledWith(100);
		expect(useQuery).not.toHaveBeenCalled();
		expect(usePaginatedQuery).toHaveBeenCalledWith(
			"listPersonal",
			{},
			{ initialNumItems: 100 },
		);
	});
	it("shows the entire shipped list while personal data is loading", () => {
		vi.mocked(usePaginatedQuery).mockReturnValue({
			results: [],
			status: "LoadingFirstPage",
			isLoading: true,
			loadMore: vi.fn(),
		});
		expect(renderHook(() => useExercises()).result.current).toHaveLength(672);
	});
	it("resolves an old bookmarked ID through the backend only when needed", () => {
		vi.mocked(useQuery).mockReturnValue({
			...SHIPPED_EXERCISES[0],
			_id: "legacy-id",
		});
		const { result } = renderHook(() => useExercise("legacy-id"));
		expect(result.current?.name).toBe(SHIPPED_EXERCISES[0].name);
		expect(useQuery).toHaveBeenCalledWith("getById", { id: "legacy-id" });
	});
	it("reads shipped instructions immediately without a network query", () => {
		vi.mocked(useQuery).mockReturnValue(undefined);
		const { result } = renderHook(() => useExercise(SHIPPED_EXERCISES[0]._id));
		expect(result.current?.name).toBe(SHIPPED_EXERCISES[0].name);
		expect(useQuery).toHaveBeenCalledWith("getById", "skip");
	});
});
