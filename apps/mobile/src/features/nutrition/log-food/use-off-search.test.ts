import { act, renderHook } from "@testing-library/react-native";
import type { OffSearchOutcome } from "../../../data/open-food-facts";
import type { PersonalFoodDraft } from "../../../data/personal-food-repository";
import { OFF_IDLE_MS, useOffSearch } from "./use-off-search";

function draft(name: string, barcode?: string): PersonalFoodDraft {
	return {
		name: { en: name, nl: name },
		baseUnit: "g",
		nutrients: {} as PersonalFoodDraft["nutrients"],
		servings: [],
		provenance: {
			recordOrigin: "import",
			nutritionSource: "openfoodfacts",
			locallyEdited: false,
			...(barcode ? { barcode } : {}),
		},
	} as unknown as PersonalFoodDraft;
}

function fakeClient(outcome: OffSearchOutcome = { kind: "not-found" }) {
	let cooling: number | undefined;
	return {
		search: jest.fn(async (_query: string) => outcome),
		coolingUntil: jest.fn(() => cooling),
		setCooling(until: number | undefined) {
			cooling = until;
		},
	};
}

async function flush() {
	await act(async () => {
		await Promise.resolve();
	});
}

beforeEach(() => {
	jest.useFakeTimers();
	jest.setSystemTime(0);
});
afterEach(() => jest.useRealTimers());

function render(
	client: ReturnType<typeof fakeClient>,
	initial: { query: string; online?: boolean },
	isImported: (barcode: string) => boolean = () => false,
) {
	return renderHook(
		({ query, online }: { query: string; online?: boolean }) =>
			useOffSearch(query, { client, online: online ?? true, isImported }),
		{ initialProps: initial },
	);
}

describe("when the food browser asks Open Food Facts", () => {
	it("stays local while the term is being typed, then asks once after it settles", async () => {
		const client = fakeClient({
			kind: "found",
			drafts: [draft("Optimel")],
			fromCache: false,
		});
		const { result, rerender } = render(client, { query: "a" });
		expect(result.current.state.kind).toBe("waiting");
		rerender({ query: "aa" });
		rerender({ query: "aar" });
		act(() => jest.advanceTimersByTime(OFF_IDLE_MS - 1));
		expect(client.search).not.toHaveBeenCalled();
		rerender({ query: "aard" });
		act(() => jest.advanceTimersByTime(OFF_IDLE_MS));
		await flush();
		expect(client.search).toHaveBeenCalledTimes(1);
		expect(client.search).toHaveBeenCalledWith("aard");
		expect(result.current.state).toMatchObject({ kind: "found" });
	});

	it("never asks on its own for fewer than three characters, but asks at once on Search", async () => {
		const client = fakeClient();
		const { result } = render(client, { query: "ei" });
		act(() => jest.advanceTimersByTime(OFF_IDLE_MS * 3));
		expect(client.search).not.toHaveBeenCalled();
		expect(result.current.state.kind).toBe("waiting");
		act(() => result.current.commit());
		await flush();
		expect(client.search).toHaveBeenCalledWith("ei");
		expect(result.current.state.kind).toBe("none");
	});

	it("asks once per term, even when Search follows the idle request", async () => {
		const client = fakeClient();
		const { result } = render(client, { query: "kwark" });
		act(() => jest.advanceTimersByTime(OFF_IDLE_MS));
		await flush();
		act(() => result.current.commit());
		await flush();
		expect(client.search).toHaveBeenCalledTimes(1);
	});

	it("drops products whose barcode is already a Personal Food", async () => {
		const client = fakeClient({
			kind: "found",
			drafts: [draft("Mine", "111"), draft("New", "222"), draft("No code")],
			fromCache: false,
		});
		const { result } = render(
			client,
			{ query: "yoghurt" },
			(code) => code === "111",
		);
		act(() => result.current.commit());
		await flush();
		const state = result.current.state;
		expect(state.kind).toBe("found");
		if (state.kind !== "found") return;
		expect(state.drafts.map((item) => item.name.en)).toEqual([
			"New",
			"No code",
		]);
	});

	it("reports nothing found when every product was already imported", async () => {
		const client = fakeClient({
			kind: "found",
			drafts: [draft("Mine", "111")],
			fromCache: false,
		});
		const { result } = render(client, { query: "yoghurt" }, () => true);
		act(() => result.current.commit());
		await flush();
		expect(result.current.state.kind).toBe("none");
	});

	it("counts down while rate-limited and retries on its own once the window opens", async () => {
		const client = fakeClient({ kind: "rate-limited" });
		const { result } = render(client, { query: "optimel" });
		client.setCooling(40_000);
		act(() => result.current.commit());
		await flush();
		expect(result.current.state).toEqual({ kind: "cooling", until: 40_000 });
		expect(client.search).toHaveBeenCalledTimes(1);

		client.search.mockResolvedValue({ kind: "not-found" });
		client.setCooling(undefined);
		act(() => jest.advanceTimersByTime(40_000));
		await flush();
		expect(client.search).toHaveBeenCalledTimes(2);
		expect(result.current.state.kind).toBe("none");
	});

	it("still answers a cached term while the budget is closed", async () => {
		const client = fakeClient({
			kind: "found",
			drafts: [draft("Cached")],
			fromCache: true,
		});
		client.setCooling(40_000);
		const { result } = render(client, { query: "optimel" });
		act(() => result.current.commit());
		await flush();
		expect(result.current.state.kind).toBe("found");
	});

	it("waits a minute after the provider says 429 when the budget has no better answer", async () => {
		const client = fakeClient({ kind: "rate-limited" });
		const { result } = render(client, { query: "optimel" });
		act(() => result.current.commit());
		await flush();
		expect(result.current.state).toEqual({ kind: "cooling", until: 60_000 });
	});

	it("says offline instead of asking, and asks once the connection returns", async () => {
		const client = fakeClient();
		const { result, rerender } = render(client, {
			query: "kip",
			online: false,
		});
		act(() => result.current.commit());
		expect(result.current.state.kind).toBe("offline");
		expect(client.search).not.toHaveBeenCalled();
		rerender({ query: "kip", online: true });
		await flush();
		expect(client.search).toHaveBeenCalledWith("kip");
	});

	it("ignores an answer for a term the person has already changed", async () => {
		let resolve: (outcome: OffSearchOutcome) => void = () => {};
		const client = fakeClient();
		client.search.mockImplementation(
			() =>
				new Promise<OffSearchOutcome>((done) => {
					resolve = done;
				}),
		);
		const { result, rerender } = render(client, { query: "appel" });
		act(() => result.current.commit());
		expect(result.current.state.kind).toBe("loading");
		rerender({ query: "peer" });
		resolve({ kind: "found", drafts: [draft("Appel")], fromCache: false });
		await flush();
		expect(result.current.state.kind).toBe("waiting");
	});

	it("is idle without a query", () => {
		const { result } = render(fakeClient(), { query: "  " });
		expect(result.current.state.kind).toBe("idle");
	});
});
