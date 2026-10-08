import { router } from "expo-router";

jest.mock("../../ui/inset-list", () =>
	jest.requireActual("../../ui/inset-list.tsx"),
);

import { useMutation, useQueries } from "convex/react";
import { getFunctionName } from "convex/server";
import { act, fireEvent, screen } from "expo-router/testing-library";
import * as Flow from "../../../app/(app)/start-activity/_layout";
import * as Endurance from "../../../app/(app)/start-activity/endurance";
import * as Picker from "../../../app/(app)/start-activity/index";
import { renderApp } from "../../test-support/render-app";

jest.mock("expo-router/build/react-navigation/core", () => ({
	...jest.requireActual("expo-router/build/react-navigation/core"),
	usePreventRemove: (
		blocked: boolean,
		callback: (event: { data: { action: unknown } }) => void,
	) => {
		const React = require("react") as typeof import("react");
		const navigation = (
			require("expo-router") as typeof import("expo-router")
		).useNavigation();
		React.useEffect(
			() =>
				navigation.addListener("beforeRemove", (event) => {
					if (blocked) {
						event.preventDefault();
						callback({ data: event.data });
					}
				}),
			[navigation, blocked, callback],
		);
	},
}));
const routines = [{ _id: "routine-1", name: "Push day", exercises: [] }];
let active: Record<string, unknown> | undefined | null = null;
const mutations = new Map<string, jest.Mock>();
function mutation(name: string) {
	const fn = mutations.get(name);
	if (!fn) throw new Error(`Mutation was not mounted: ${name}`);
	return fn;
}
beforeEach(() => {
	mutations.clear();
	active = null;
	jest
		.mocked(useQueries)
		.mockImplementation((queries) =>
			Object.fromEntries(
				Object.entries(queries).map(([key, request]) => [
					key,
					getFunctionName(request.query) === "routines:list"
						? routines
						: active,
				]),
			),
		);
	jest.mocked(useMutation).mockImplementation((reference) => {
		const name = getFunctionName(reference);
		if (!mutations.has(name)) mutations.set(name, jest.fn());
		return Object.assign(mutation(name), {
			withOptimisticUpdate: jest.fn(),
		});
	});
});
function mount() {
	return renderApp("/start-activity", {
		"start-activity/_layout": Flow,
		"start-activity/index": Picker,
		"start-activity/endurance": Endurance,
	});
}
it("selects a routine without starting and restores the optional name after switching activities", async () => {
	mount();
	fireEvent.changeText(
		await screen.findByLabelText("Session name"),
		"Lunch training",
	);
	fireEvent.press(screen.getByRole("radio", { name: "Push day" }));
	expect(mutations.get("routines:startSession")).not.toHaveBeenCalled();
	expect(screen.queryByLabelText("Session name")).toBeNull();
	fireEvent.press(screen.getByRole("radio", { name: "Empty session" }));
	expect(screen.getByDisplayValue("Lunch training")).toBeTruthy();
	fireEvent.press(screen.getByRole("radio", { name: "Running" }));
	fireEvent.press(screen.getByRole("button", { name: "Continue" }));
	expect(await screen.findByText("Distance")).toBeTruthy();
	act(() => router.back());
	fireEvent.press(await screen.findByRole("radio", { name: "Strength" }));
	expect(screen.getByDisplayValue("Lunch training")).toBeTruthy();
	expect(mutations.get("workoutSessions:create")).not.toHaveBeenCalled();
});
it("retains the typed name after a rejected start", async () => {
	mount();
	fireEvent.changeText(
		await screen.findByLabelText("Session name"),
		"Lunch training",
	);
	mutation("workoutSessions:create").mockRejectedValue(new Error("Try again"));
	fireEvent.press(screen.getByRole("button", { name: "Start" }));
	expect(await screen.findByText("Try again")).toBeTruthy();
	expect(screen.getByDisplayValue("Lunch training")).toBeTruthy();
});

it("uses the same guarded action for keyboard submit and blocks duplicate starts", async () => {
	let reject: ((error: Error) => void) | undefined;
	mount();
	const input = await screen.findByLabelText("Session name");
	fireEvent.changeText(input, "Keyboard session");
	mutation("workoutSessions:create").mockImplementation(
		() =>
			new Promise((_resolve, fail) => {
				reject = fail;
			}),
	);
	fireEvent(input, "submitEditing");
	expect(screen.getByLabelText("Session name")).toBeDisabled();
	fireEvent.press(screen.getByRole("button", { name: "Starting…" }));
	expect(mutations.get("workoutSessions:create")).toHaveBeenCalledTimes(1);
	await act(async () => reject?.(new Error("Try again")));
	expect(await screen.findByDisplayValue("Keyboard session")).toBeTruthy();
	expect(screen.getByLabelText("Session name")).not.toBeDisabled();
});
it("does not interpret an unknown active-session query as permission to start", async () => {
	active = undefined;
	mount();
	fireEvent.press(await screen.findByRole("button", { name: "Start" }));
	expect(mutations.get("workoutSessions:create")).not.toHaveBeenCalled();
	expect(mutations.get("routines:startSession")).not.toHaveBeenCalled();
	fireEvent.press(screen.getByRole("radio", { name: "Running" }));
	fireEvent.press(screen.getByRole("button", { name: "Continue" }));
	expect(await screen.findByText("Distance")).toBeTruthy();
});
it("offers Resume instead of creating a second active strength session", async () => {
	active = { _id: "existing-session", status: "active" };
	mount();
	fireEvent.press(await screen.findByRole("button", { name: "Start" }));
	expect(
		await screen.findByRole("button", { name: "Resume session" }),
	).toBeTruthy();
	await act(async () =>
		fireEvent.press(screen.getByRole("button", { name: "Cancel" })),
	);
	expect(mutations.get("workoutSessions:create")).not.toHaveBeenCalled();
});
