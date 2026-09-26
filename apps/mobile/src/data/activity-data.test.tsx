import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
	ConvexProvider,
	type ConvexReactClient,
	useQueries,
} from "convex/react";
import { useActivityPages } from "./activity-data";

const row = (id: string) => ({
	id,
	sport: "running",
	occurredAt: 100,
	durationSeconds: 600,
	distanceMeters: 2000,
});
const mockQueries = jest.mocked(useQueries);

beforeEach(() => {
	mockQueries.mockReset();
});

it("renders with the real Convex subscription hook when options are recreated", () => {
	const actual =
		jest.requireActual<typeof import("convex/react")>("convex/react");
	mockQueries.mockImplementation(actual.useQueries);
	const client = {
		watchQuery: () => ({
			localQueryResult: () => ({
				items: [row("live")],
				cursor: null,
				isDone: true,
			}),
			onUpdate: () => () => {},
			journal: () => undefined,
		}),
	} as unknown as ConvexReactClient;
	const { result, rerender } = renderHook(
		() => useActivityPages({ limit: 4 }),
		{
			wrapper: ({ children }) => (
				<ConvexProvider client={client}>{children}</ConvexProvider>
			),
		},
	);
	expect(result.current.items[0].id).toBe("live");
	rerender({});
	expect(result.current.items[0].id).toBe("live");
});

it("loads every page before reporting complete totals", async () => {
	mockQueries.mockImplementation((queries) =>
		Object.fromEntries(
			Object.entries(queries).map(([name, { args }]) => [
				name,
				args.cursor === null
					? { items: [row("1")], cursor: "next", isDone: false }
					: { items: [row("2")], cursor: null, isDone: true },
			]),
		),
	);
	const { result } = renderHook(() =>
		useActivityPages({ from: 0, to: 200 }, true),
	);
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.items.map((item) => item.id)).toEqual(["1", "2"]);
});

it("loads older history only when requested and resets pages for a new sport", async () => {
	mockQueries.mockImplementation((queries) =>
		Object.fromEntries(
			Object.entries(queries).map(([name, { args }]) => [
				name,
				{
					items: [row(`${args.sport}-${args.cursor ?? "first"}`)],
					cursor: args.cursor ? null : "next",
					isDone: Boolean(args.cursor),
				},
			]),
		),
	);
	const { result, rerender } = renderHook(
		({ sport }: { sport: "running" | "cycling" }) =>
			useActivityPages({ sport }),
		{ initialProps: { sport: "running" } },
	);
	expect(result.current.items).toHaveLength(1);
	act(() => result.current.loadMore());
	await waitFor(() => expect(result.current.items).toHaveLength(2));
	rerender({ sport: "cycling" });
	expect(result.current.items.map((item) => item.id)).toEqual([
		"cycling-first",
	]);
});

it("invalidates later pages when a live edit changes the preceding cursor", async () => {
	let edited = false;
	mockQueries.mockImplementation((queries) =>
		Object.fromEntries(
			Object.entries(queries).map(([name, { args }]) => [
				name,
				args.cursor === null
					? {
							items: [row(edited ? "changed" : "1")],
							cursor: edited ? "new" : "old",
							isDone: false,
						}
					: { items: [row(args.cursor as string)], cursor: null, isDone: true },
			]),
		),
	);
	const { result, rerender } = renderHook(() => useActivityPages({}, true));
	await waitFor(() =>
		expect(result.current.items.map((item) => item.id)).toEqual(["1", "old"]),
	);
	edited = true;
	rerender({});
	await waitFor(() =>
		expect(result.current.items.map((item) => item.id)).toEqual([
			"changed",
			"new",
		]),
	);
});
