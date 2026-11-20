import { renderHook } from "@testing-library/react";
import { useConvexAuth, useQuery } from "convex/react";
import { expect, it, vi } from "vitest";
import { useActiveSession } from "./useActiveSession";

vi.mock("convex/react", () => ({
	useConvexAuth: vi.fn(),
	useQuery: vi.fn(),
}));

// `getActive` throws while signed out, which took down every page in the app
// shell for signed-out visitors, join links included.
it.each([
	[false, "skip"],
	[true, {}],
])("authenticated %s asks Convex with %o", (isAuthenticated, args) => {
	vi.mocked(useConvexAuth).mockReturnValue({
		isAuthenticated,
		isLoading: false,
		isRefreshing: false,
	});
	renderHook(() => useActiveSession());
	expect(vi.mocked(useQuery).mock.lastCall?.[1]).toEqual(args);
});
