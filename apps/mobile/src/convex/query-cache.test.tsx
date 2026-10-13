jest.unmock("./query-cache");

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
	ConvexProvider,
	ConvexReactClient,
	useConvex,
	useQueries,
} from "convex/react";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { useState } from "react";
import { AppState, type AppStateStatus, Pressable, Text } from "react-native";
import {
	AppQueryCacheProvider,
	useQueries as useCachedQueries,
	useQuery as useCachedQuery,
} from "./query-cache";

const day = makeFunctionReference<"query", { date: string }, string>(
	"test:day",
);

/** Public Watch transport: data exists locally only while someone subscribes. */
function transport() {
	const client = new ConvexReactClient("https://cache-test.convex.cloud", {
		unsavedChangesWarning: false,
	});
	const listeners = new Map<string, Set<() => void>>();
	const values = new Map<string, string>();
	let starts = 0;
	let stops = 0;
	let owner = "first";
	jest.spyOn(client, "watchQuery").mockImplementation((...watchArgs) => {
		const [reference, args = {}] = watchArgs;
		const key = JSON.stringify([getFunctionName(reference), args]);
		return {
			localQueryResult: () => values.get(key),
			localQueryLogs: () => undefined,
			journal: () => undefined,
			onUpdate: (callback) => {
				let subscribers = listeners.get(key);
				if (!subscribers) {
					starts++;
					subscribers = new Set();
					listeners.set(key, subscribers);
					values.set(key, `${owner}:${args?.date}`);
				}
				subscribers.add(callback);
				return () => {
					subscribers.delete(callback);
					if (subscribers.size === 0) {
						stops++;
						listeners.delete(key);
						values.delete(key);
					}
				};
			},
		};
	});
	return {
		client,
		get starts() {
			return starts;
		},
		get stops() {
			return stops;
		},
		get active() {
			return listeners.size;
		},
		setOwner: (next: string) => {
			owner = next;
		},
		publish: (date: string, value: string) => {
			const key = JSON.stringify(["test:day", { date }]);
			if (!listeners.has(key)) throw new Error("No subscription");
			values.set(key, value);
			for (const notify of listeners.get(key) ?? []) notify();
		},
	};
}

function Day({ date }: { date: string }) {
	const value = useCachedQuery(day, { date });
	return <Text>{value ?? "Loading"}</Text>;
}

const lifecycle = new Set<(state: AppStateStatus) => void>();
const initialAppState = AppState.currentState;

beforeEach(() => {
	jest.useFakeTimers();
	AppState.currentState = "active";
	jest
		.spyOn(AppState, "addEventListener")
		.mockImplementation((_event, notify) => {
			lifecycle.add(notify);
			return { remove: () => lifecycle.delete(notify) };
		});
	const actual =
		jest.requireActual<typeof import("convex/react")>("convex/react");
	jest.mocked(useConvex).mockImplementation(actual.useConvex);
	jest.mocked(useQueries).mockImplementation(actual.useQueries);
});

afterEach(() => {
	lifecycle.clear();
	jest.restoreAllMocks();
	AppState.currentState = initialAppState;
	jest.useRealTimers();
});

it("reuses a live updated result on return, then releases an abandoned query", () => {
	const remote = transport();
	const tree = (shown: boolean) => (
		<ConvexProvider client={remote.client}>
			<AppQueryCacheProvider scope="first">
				{shown && <Day date="today" />}
			</AppQueryCacheProvider>
		</ConvexProvider>
	);
	const view = render(tree(true));
	expect(screen.getByText("first:today")).toBeTruthy();
	view.rerender(tree(false));
	act(() => {
		jest.advanceTimersByTime(10_000);
		remote.publish("today", "Updated meal");
	});
	view.rerender(tree(true));
	expect(screen.getByText("Updated meal")).toBeTruthy();
	expect(remote.starts).toBe(1);
	view.rerender(tree(false));
	act(() => jest.advanceTimersByTime(4 * 60_000));
	expect(remote.active).toBe(1);
	act(() => jest.advanceTimersByTime(60_000));
	expect(remote.active).toBe(0);
	view.rerender(tree(true));
	expect(remote.starts).toBe(2);
	view.unmount();
	expect(remote.active).toBe(0);
});

it("shares identical consumers and keeps different arguments separate", () => {
	const remote = transport();
	function Days() {
		const values = useCachedQueries({
			first: { query: day, args: { date: "today" } },
			second: { query: day, args: { date: "tomorrow" } },
		});
		return <Text>{`${values.first}/${values.second}`}</Text>;
	}
	const view = render(
		<ConvexProvider client={remote.client}>
			<AppQueryCacheProvider scope="first">
				<Day date="today" />
				<Days />
			</AppQueryCacheProvider>
		</ConvexProvider>,
	);
	expect(screen.getByText("first:today/first:tomorrow")).toBeTruthy();
	expect(remote.starts).toBe(2);
	view.unmount();
	expect(remote.active).toBe(0);
});

it("drops idle subscriptions on account change before revisiting their queries", () => {
	const remote = transport();
	const tree = (scope: string, shown: boolean) => (
		<ConvexProvider client={remote.client}>
			<AppQueryCacheProvider scope={scope}>
				{shown && <Day date="today" />}
			</AppQueryCacheProvider>
		</ConvexProvider>
	);
	const view = render(tree("first", true));
	view.rerender(tree("first", false));
	remote.setOwner("second");
	view.rerender(tree("second", false));
	expect(remote.active).toBe(0);
	view.rerender(tree("second", true));
	expect(screen.getByText("second:today")).toBeTruthy();
	expect(remote.starts).toBe(2);
	view.unmount();
});

it("releases idle queries in background, keeps mounted ones, and preserves editor input", () => {
	const remote = transport();
	function Editor() {
		const [input, setInput] = useState("Unfinished input");
		return (
			<Pressable onPress={() => setInput("Edited input")}>
				<Text>{input}</Text>
			</Pressable>
		);
	}
	const tree = (shown: boolean) => (
		<ConvexProvider client={remote.client}>
			<AppQueryCacheProvider scope="first">
				<Day date="active" />
				{shown && <Day date="idle" />}
				<Editor />
			</AppQueryCacheProvider>
		</ConvexProvider>
	);
	const view = render(tree(true));
	fireEvent.press(screen.getByText("Unfinished input"));
	view.rerender(tree(false));
	act(() => {
		for (const notify of lifecycle) notify("background");
	});
	expect(remote.active).toBe(1);
	expect(screen.getByText("Edited input")).toBeTruthy();
	act(() => {
		for (const notify of lifecycle) notify("active");
	});
	expect(screen.getByText("first:active")).toBeTruthy();
	expect(screen.getByText("Edited input")).toBeTruthy();
	expect(remote.active).toBe(1);
	view.unmount();
});

it("bounds idle subscriptions when browsing many distinct dates", () => {
	const remote = transport();
	const tree = (date?: string) => (
		<ConvexProvider client={remote.client}>
			<AppQueryCacheProvider scope="first">
				{date && <Day date={date} />}
			</AppQueryCacheProvider>
		</ConvexProvider>
	);
	const view = render(tree("0"));
	for (let index = 1; index <= 25; index++) view.rerender(tree(String(index)));
	view.rerender(tree());
	expect(remote.active).toBe(20);
	act(() => jest.advanceTimersByTime(5 * 60_000));
	expect(remote.active).toBe(0);
	view.unmount();
});
