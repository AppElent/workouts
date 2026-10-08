import {
	useConvexConnectionState,
	useMutation,
	useQueries,
	useQuery,
} from "convex/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { router } from "expo-router";
import { act, fireEvent, screen } from "expo-router/testing-library";
import Storage from "expo-sqlite/kv-store";
import * as SessionRoute from "../../../app/(app)/session";
import * as EditorLayout from "../../../app/(app)/set-editor/_layout";
import * as EditorRoute from "../../../app/(app)/set-editor/index";
import * as ProfileRoute from "../../../app/(app)/set-editor/strength-profile";
import { renderApp } from "../../test-support/render-app";

let mockSubject = "test-user";
jest.mock("@clerk/expo", () => ({
	useAuth: () => ({ userId: mockSubject, isLoaded: true, isSignedIn: true }),
	useUser: () => ({ user: null }),
}));

jest.mock("../../ui/inset-list", () =>
	jest.requireActual("../../ui/inset-list.tsx"),
);
jest.mock("../../ui/selection-menu", () =>
	jest.requireActual("../../ui/selection-menu.tsx"),
);
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
const exerciseId = "shipped:exercise:barbell-back-squat";
const session = {
	_id: "session-1",
	userId: "test-user",
	status: "active",
	startTime: Date.now(),
	exercises: [
		{
			exerciseId,
			plannedSets: [{ weight: 60, reps: 8, unit: "kg" }],
			references: {
				measured: { value: 100, unit: "kg", date: 1, source: "actual" },
				estimated: {
					value: 110,
					unit: "kg",
					date: 2,
					source: "calculated",
					formula: "epley",
				},
				manual: null,
			},
		},
	],
};
const empty: never[] = [];
let receipt: { setId: string; status: "saved" } | null = null;
let recoveryVisible = false;
const add = jest.fn();
const update = jest.fn();
let currentSession: Record<string, unknown> | Error | undefined = session;
let loggedSets: Record<string, unknown>[] = [];
const loggedSet = {
	_id: "set-1",
	sessionId: "session-1",
	userId: "test-user",
	exerciseId,
	setNumber: 1,
	weight: 70,
	reps: 5,
	unit: "kg",
	setType: "working",
	rpe: 8.5,
	loggedAt: 1,
};

beforeEach(() => {
	Storage.removeItemSync("strength-set-drafts:v1:test-user");
	receipt = null;
	recoveryVisible = false;
	mockSubject = "test-user";
	add.mockReset();
	update.mockReset();
	currentSession = session;
	loggedSets = [];
	jest.mocked(useConvexConnectionState).mockReturnValue({
		isWebSocketConnected: true,
		hasEverConnected: true,
		connectionCount: 1,
		connectionRetries: 0,
		inflightMutations: 0,
		inflightActions: 0,
		hasInflightRequests: false,
		timeOfOldestInflightRequest: null,
	});
	jest
		.mocked(useQueries)
		.mockImplementation((queries) =>
			Object.fromEntries(
				Object.entries(queries).map(([key, request]) => [
					key,
					getFunctionName(request.query) === "workoutSessions:getById"
						? currentSession
						: getFunctionName(request.query) === "sets:listForSession"
							? loggedSets
							: getFunctionName(request.query) === "sets:getLastForExercise"
								? null
								: getFunctionName(request.query) === "sets:getLogResult"
									? recoveryVisible
										? receipt
										: null
									: empty,
				]),
			),
		);
	jest
		.mocked(useQuery)
		.mockImplementation((...args) =>
			getFunctionName(args[0]) === "workoutSessions:getActive"
				? session
				: getFunctionName(args[0]) === "sets:getLogResult"
					? recoveryVisible
						? receipt
						: null
					: null,
		);
	jest
		.mocked(useMutation)
		.mockImplementation((reference) =>
			Object.assign(
				getFunctionName(reference) === "sets:add"
					? add
					: getFunctionName(reference) === "sets:update"
						? update
						: jest.fn().mockResolvedValue(undefined),
				{ withOptimisticUpdate: jest.fn() },
			),
		);
});
function mount() {
	return renderApp("/session?id=session-1", {
		session: SessionRoute,
		"set-editor/_layout": EditorLayout,
		"set-editor/index": EditorRoute,
		"set-editor/strength-profile": ProfileRoute,
	});
}
async function openEditor() {
	fireEvent.press(
		await screen.findByRole("button", { name: "Add set Barbell Back Squat" }),
	);
	return screen.findByLabelText("Weight");
}
it("keeps an unfinished set across closing and a fresh app mount without logging", async () => {
	let app = mount();
	fireEvent.changeText(await openEditor(), "72.5");
	fireEvent.changeText(screen.getByLabelText("Reps"), "5");
	act(() => router.back());
	app.unmount();
	app = mount();
	await openEditor();
	expect(screen.getByDisplayValue("72.5")).toBeTruthy();
	expect(screen.getByDisplayValue("5")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
	app.unmount();
});
it("recovers a committed Log after losing its response and restarting without a second write", async () => {
	const app = mount();
	await openEditor();
	add.mockImplementation(async () => {
		receipt = { setId: "set-1", status: "saved" };
		throw new Error("Response lost");
	});
	fireEvent.press(screen.getByRole("button", { name: "Log set" }));
	await screen.findByText("Response lost");
	const original = add.mock.calls[0][0];
	expect(original.operationId).toBeTruthy();
	app.unmount();
	recoveryVisible = true;
	mount();
	fireEvent.press(
		await screen.findByRole("button", { name: "Add set Barbell Back Squat" }),
	);
	expect(
		await screen.findByText("Your previous set was already saved."),
	).toBeTruthy();
	expect(add).toHaveBeenCalledTimes(1);
});
it("stages a profile load until Apply and preserves RPE", async () => {
	mount();
	await openEditor();
	fireEvent.changeText(screen.getByLabelText("RPE"), "8.5");
	fireEvent.press(screen.getByRole("button", { name: "Strength profile" }));
	fireEvent.press(await screen.findByLabelText("80%"));
	expect(add).not.toHaveBeenCalled();
	fireEvent.press(screen.getByRole("radio", { name: "Measured 1RM: 80 kg" }));
	fireEvent.press(screen.getByRole("button", { name: "Apply to set" }));
	expect(await screen.findByDisplayValue("80")).toBeTruthy();
	expect(screen.getByDisplayValue("8.5")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
});

it("protects saved edits on Back and explicitly clears optional effort", async () => {
	loggedSets = [loggedSet];
	mount();
	fireEvent.press(
		await screen.findByRole("button", {
			name: "Edit set 1 Barbell Back Squat",
		}),
	);
	fireEvent.changeText(await screen.findByLabelText("Weight"), "75");
	act(() => router.back());
	expect(await screen.findByText("Discard changes?")).toBeTruthy();
	fireEvent.press(screen.getByRole("button", { name: "Keep editing" }));
	expect(screen.getByDisplayValue("75")).toBeTruthy();
	expect(update).not.toHaveBeenCalled();
	fireEvent.changeText(screen.getByLabelText("Weight"), "70");
	fireEvent.changeText(screen.getByLabelText("RPE"), "");
	fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByRole("button", { name: "Add set Barbell Back Squat" });
	expect(update).toHaveBeenCalledWith({
		id: "set-1",
		weight: 70,
		reps: 5,
		unit: "kg",
		setType: "working",
		rpe: null,
	});
});
it("prepares Repeat as input and records it only after Log", async () => {
	loggedSets = [loggedSet];
	mount();
	fireEvent.press(
		await screen.findByRole("button", {
			name: "Edit set 1 Barbell Back Squat",
		}),
	);
	fireEvent.press(
		await screen.findByRole("button", { name: "Repeat as new set" }),
	);
	await openEditor();
	expect(screen.getByDisplayValue("70")).toBeTruthy();
	expect(screen.getByDisplayValue("8.5")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
	fireEvent.press(screen.getByRole("button", { name: "Log set" }));
	await screen.findByRole("button", { name: "Add set Barbell Back Squat" });
	expect(add).toHaveBeenCalledWith(
		expect.objectContaining({ weight: 70, reps: 5, rpe: 8.5, setNumber: 2 }),
	);
});
it("locks a pending Log against edits, dismissal and duplicate submissions", async () => {
	let resolve: (() => void) | undefined;
	add.mockImplementation(
		() =>
			new Promise<void>((done) => {
				resolve = done;
			}),
	);
	mount();
	await openEditor();
	fireEvent.press(screen.getByRole("button", { name: "Log set" }));
	fireEvent.press(screen.getByRole("button", { name: "Saving…" }));
	act(() => router.back());
	expect(screen.getByLabelText("Weight")).toBeDisabled();
	expect(add).toHaveBeenCalledTimes(1);
	await act(async () => resolve?.());
	await screen.findByRole("button", { name: "Add set Barbell Back Squat" });
});
it("allows offline input recovery while refusing to record performance", async () => {
	const app = mount();
	fireEvent.changeText(await openEditor(), "82.5");
	app.unmount();
	jest.mocked(useConvexConnectionState).mockReturnValue({
		isWebSocketConnected: false,
		hasEverConnected: true,
		connectionCount: 1,
		connectionRetries: 0,
		inflightMutations: 0,
		inflightActions: 0,
		hasInflightRequests: false,
		timeOfOldestInflightRequest: null,
	});
	mount();
	await openEditor();
	expect(screen.getByDisplayValue("82.5")).toBeTruthy();
	fireEvent.changeText(screen.getByLabelText("Reps"), "4");
	expect(screen.getByRole("button", { name: "Log set" })).toBeDisabled();
	expect(add).not.toHaveBeenCalled();
});
it("keeps input when session verification fails and never writes from an unverified session", async () => {
	const app = mount();
	fireEvent.changeText(await openEditor(), "77.5");
	app.unmount();
	currentSession = new Error("Unavailable");
	renderApp(`/set-editor?sessionId=session-1&exerciseId=${exerciseId}`, {
		"set-editor/_layout": EditorLayout,
		"set-editor/index": EditorRoute,
		"set-editor/strength-profile": ProfileRoute,
	});
	expect(await screen.findByDisplayValue("77.5")).toBeTruthy();
	expect(screen.getByRole("button", { name: "Log set" })).toBeDisabled();
	expect(add).not.toHaveBeenCalled();
});
it("leaves weight, reps and RPE unchanged when returning without Apply", async () => {
	mount();
	await openEditor();
	fireEvent.changeText(screen.getByLabelText("RPE"), "7.5");
	fireEvent.press(screen.getByRole("button", { name: "Strength profile" }));
	fireEvent.press(
		await screen.findByRole("radio", { name: "Measured 1RM: 80 kg" }),
	);
	act(() => router.back());
	expect(await screen.findByDisplayValue("60")).toBeTruthy();
	expect(screen.getByDisplayValue("8")).toBeTruthy();
	expect(screen.getByDisplayValue("7.5")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
});

it("isolates unfinished input by account and restores it when its owner returns", async () => {
	let app = mount();
	fireEvent.changeText(await openEditor(), "91.5");
	app.unmount();
	mockSubject = "other-user";
	app = renderApp(`/set-editor?sessionId=session-1&exerciseId=${exerciseId}`, {
		"set-editor/_layout": EditorLayout,
		"set-editor/index": EditorRoute,
	});
	expect(screen.queryByDisplayValue("91.5")).toBeNull();
	expect(screen.getByRole("button", { name: "Log set" })).toBeDisabled();
	app.unmount();
	mockSubject = "test-user";
	mount();
	await openEditor();
	expect(screen.getByDisplayValue("91.5")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
});
it("does not replace stored input or send a Log when durable storage fails", async () => {
	mount();
	await openEditor();
	const stored = Storage.getItemSync("strength-set-drafts:v1:test-user");
	const write = jest.spyOn(Storage, "setItemSync").mockImplementation(() => {
		throw new Error("Disk unavailable");
	});
	try {
		fireEvent.changeText(screen.getByLabelText("Weight"), "95");
		expect(
			await screen.findAllByText(/Could not access local set storage/),
		).not.toHaveLength(0);
		expect(screen.getByRole("button", { name: "Log set" })).toBeDisabled();
		expect(Storage.getItemSync("strength-set-drafts:v1:test-user")).toBe(
			stored,
		);
		expect(add).not.toHaveBeenCalled();
	} finally {
		write.mockRestore();
	}
});
it.each([
	"completed",
	"cancelled",
])("refuses to log a recovered draft into a %s session", async (status) => {
	const app = mount();
	fireEvent.changeText(await openEditor(), "87.5");
	app.unmount();
	currentSession = { ...session, status };
	renderApp(`/set-editor?sessionId=session-1&exerciseId=${exerciseId}`, {
		"set-editor/_layout": EditorLayout,
		"set-editor/index": EditorRoute,
	});
	expect(
		await screen.findByText(
			"This session has ended. Unfinished sets cannot be logged.",
		),
	).toBeTruthy();
	expect(screen.getByRole("button", { name: "Log set" })).toBeDisabled();
	expect(add).not.toHaveBeenCalled();
});
it("keeps historical saved-set corrections available without allowing new performance", async () => {
	currentSession = { ...session, status: "completed" };
	loggedSets = [loggedSet];
	mount();
	fireEvent.press(
		await screen.findByRole("button", {
			name: "Edit set 1 Barbell Back Squat",
		}),
	);
	fireEvent.changeText(await screen.findByLabelText("RPE"), "");
	fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
	await screen.findByRole("button", { name: "Edit set 1 Barbell Back Squat" });
	expect(update).toHaveBeenCalledWith(
		expect.objectContaining({ id: "set-1", rpe: null }),
	);
	expect(add).not.toHaveBeenCalled();
});
it("retains a separate unfinished set for each exercise", async () => {
	currentSession = {
		...session,
		exercises: [
			...session.exercises,
			{
				exerciseId: "shipped:exercise:barbell-bench-press",
				plannedSets: [{ weight: 40, reps: 10, unit: "kg" }],
				references: { measured: null, estimated: null, manual: null },
			},
		],
	};
	mount();
	fireEvent.changeText(await openEditor(), "92.5");
	act(() => router.back());
	fireEvent.press(
		await screen.findByRole("button", { name: "Add set Barbell Bench Press" }),
	);
	fireEvent.changeText(await screen.findByLabelText("Weight"), "42.5");
	act(() => router.back());
	await openEditor();
	expect(screen.getByDisplayValue("92.5")).toBeTruthy();
	act(() => router.back());
	fireEvent.press(
		await screen.findByRole("button", { name: "Add set Barbell Bench Press" }),
	);
	expect(await screen.findByDisplayValue("42.5")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
});

it("unlocks kept input after a confirmed rejected Log", async () => {
	add.mockRejectedValue(new ConvexError("Set rejected"));
	mount();
	await openEditor();
	fireEvent.press(screen.getByRole("button", { name: "Log set" }));
	expect(await screen.findByText("Set rejected")).toBeTruthy();
	expect(screen.getByLabelText("Weight")).not.toBeDisabled();
	fireEvent.changeText(screen.getByLabelText("Weight"), "65");
	expect(screen.getByDisplayValue("65")).toBeTruthy();
});
it("shows above-reference loads without claiming a zero-rep prediction", async () => {
	mount();
	fireEvent.changeText(await openEditor(), "120");
	expect(screen.getAllByText("Above 1RM")).toHaveLength(2);
	expect(screen.queryByText("≈0")).toBeNull();
});
it("distinguishes unavailable references while preserving recovered input in Strength Profile", async () => {
	const app = mount();
	fireEvent.changeText(await openEditor(), "77.5");
	app.unmount();
	currentSession = new Error("Unavailable");
	renderApp(`/set-editor?sessionId=session-1&exerciseId=${exerciseId}`, {
		"set-editor/_layout": EditorLayout,
		"set-editor/index": EditorRoute,
		"set-editor/strength-profile": ProfileRoute,
	});
	fireEvent.press(
		await screen.findByRole("button", { name: "Strength profile" }),
	);
	expect(
		await screen.findByText(
			"Strength references are unavailable. Your unfinished input is kept.",
		),
	).toBeTruthy();
	act(() => router.back());
	expect(await screen.findByDisplayValue("77.5")).toBeTruthy();
});
