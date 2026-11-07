/** The session as a person uses it: the table, the editor, offline, finishing. */
import {
	useConvexConnectionState,
	useMutation,
	useQueries,
	useQuery,
} from "convex/react";
import { getFunctionName } from "convex/server";
import { router } from "expo-router";
import { act, fireEvent, screen } from "expo-router/testing-library";
import Storage from "expo-sqlite/kv-store";
import * as SessionRoute from "../../../app/(app)/session";
import * as GroupRoute from "../../../app/(app)/session-group";
import * as ManualRoute from "../../../app/(app)/session-manual";
import * as EditorLayout from "../../../app/(app)/set-editor/_layout";
import * as EditorRoute from "../../../app/(app)/set-editor/index";
import * as ProfileRoute from "../../../app/(app)/set-editor/strength-profile";
import { renderApp } from "../../test-support/render-app";
import { workspaceStore } from "./data/session-workspace";

jest.mock("@clerk/expo", () => ({
	useAuth: () => ({ userId: "test-user", isLoaded: true, isSignedIn: true }),
	useUser: () => ({ user: null }),
}));
jest.mock("expo-notifications", () => ({
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
	requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
	scheduleNotificationAsync: jest.fn().mockResolvedValue("id"),
	cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
	SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));
jest.mock("../../ui/inset-list", () =>
	jest.requireActual("../../ui/inset-list.tsx"),
);
jest.mock("../../ui/selection-menu", () =>
	jest.requireActual("../../ui/selection-menu.tsx"),
);

const PLAN_KEY = "strength-session-plan:v1:test-user:session-1";
const exerciseId = "shipped:exercise:barbell-back-squat";
const session = {
	_id: "session-1",
	userId: "test-user",
	status: "active",
	name: "Lower A",
	startTime: Date.now(),
	exercises: [
		{
			exerciseId,
			plannedSets: [
				{ weight: 60, reps: 8, unit: "kg" },
				{ weight: 60, reps: 8, unit: "kg" },
			],
			references: {
				measured: { value: 100, unit: "kg", date: 1, source: "actual" },
				estimated: null,
				manual: null,
			},
		},
	],
};
const emptySession = { ...session, name: "Free", exercises: [] };
const empty: never[] = [];

let currentSession: Record<string, unknown> = session;
let loggedSets: Record<string, unknown>[] = [];
let receipt: { setId: string; status: "saved" } | null | undefined = null;
let online = true;
const add = jest.fn();
const update = jest.fn();
const finish = jest.fn();
const cancel = jest.fn();

const connection = (isWebSocketConnected: boolean) => ({
	isWebSocketConnected,
	hasEverConnected: true,
	connectionCount: 1,
	connectionRetries: 0,
	inflightMutations: 0,
	inflightActions: 0,
	hasInflightRequests: false,
	timeOfOldestInflightRequest: null,
});
const serverSet = (id: string, reps: number, setNumber: number) => ({
	_id: id,
	sessionId: "session-1",
	userId: "test-user",
	exerciseId,
	setNumber,
	weight: 60,
	reps,
	unit: "kg",
	setType: "working",
	loggedAt: 1,
});

beforeEach(() => {
	Storage.removeItemSync("strength-rest:v1");
	workspaceStore.clear(PLAN_KEY);
	currentSession = session;
	loggedSets = [];
	receipt = null;
	online = true;
	add.mockReset();
	update.mockReset();
	finish.mockReset();
	cancel.mockReset();
	add.mockImplementation(async ({ operationId }) => {
		const id = `set-${loggedSets.length + 1}`;
		loggedSets = [...loggedSets, serverSet(id, 8, loggedSets.length + 1)];
		return { setId: id, status: "saved", operationId };
	});
	finish.mockResolvedValue(undefined);
	cancel.mockResolvedValue(undefined);
	jest
		.mocked(useConvexConnectionState)
		.mockImplementation(() => connection(online));
	jest.mocked(useQueries).mockImplementation((queries) =>
		Object.fromEntries(
			Object.entries(queries).map(([key, request]) => {
				const name = getFunctionName(request.query);
				if (name === "workoutSessions:getById") return [key, currentSession];
				if (name === "sets:listForSession") return [key, loggedSets];
				if (name === "sets:getLastForExercise") return [key, null];
				if (name === "sets:getLogResult") return [key, receipt];
				return [key, empty];
			}),
		),
	);
	jest.mocked(useQuery).mockImplementation((...args) => {
		const name = getFunctionName(args[0]);
		if (name === "workoutSessions:getActive") return currentSession;
		if (name === "sets:getLogResult") return receipt;
		return null;
	});
	jest.mocked(useMutation).mockImplementation((reference) => {
		const name = getFunctionName(reference);
		const fn =
			name === "sets:add"
				? add
				: name === "sets:update"
					? update
					: name === "workoutSessions:finish"
						? finish
						: name === "workoutSessions:cancel"
							? cancel
							: jest.fn().mockResolvedValue(undefined);
		return Object.assign(fn, {
			withOptimisticUpdate: jest.fn(() => fn),
		}) as never;
	});
});

async function mount() {
	return await renderApp("/session?id=session-1", {
		session: SessionRoute,
		"session-group": GroupRoute,
		"session-manual": ManualRoute,
		"set-editor/_layout": EditorLayout,
		"set-editor/index": EditorRoute,
		"set-editor/strength-profile": ProfileRoute,
	});
}
const firstCheck = async () =>
	(await screen.findAllByLabelText("Log Barbell Back Squat 60 × 8"))[0];
const firstRow = async () =>
	(await screen.findAllByLabelText(/set 1, .*60 × 8/))[0];

it("shows the plan against the measured 1RM, with what each set would be worth", async () => {
	await mount();
	expect(await screen.findByText(/Measured 1RM 100 kg/)).toBeTruthy();
	expect(
		screen.getAllByLabelText(
			/set 1, 60 percent, 60 × 8, 1RM about 76 kilograms/,
		),
	).toHaveLength(1);
});

it("logs a planned set from its check, says what it was worth, and starts rest", async () => {
	await mount();
	await fireEvent.press(await firstCheck());
	expect(add).toHaveBeenCalledTimes(1);
	expect(add.mock.calls[0][0]).toMatchObject({
		exerciseId,
		weight: 60,
		reps: 8,
		unit: "kg",
	});
	expect(add.mock.calls[0][0].operationId).toBeTruthy();
	expect(await screen.findByText(/60 × 8 logged · ≈76 kg/)).toBeTruthy();
	expect(await screen.findByTestId("session-rest-stop")).toBeTruthy();
});

it("keeps an unfinished edit across closing and a fresh app mount without logging", async () => {
	let app = await mount();
	await fireEvent.press(await firstRow());
	await fireEvent.changeText(
		await screen.findByTestId("session-editor-load"),
		"72.5",
	);
	await fireEvent.changeText(screen.getByTestId("session-editor-reps"), "5");
	await act(() => router.back());
	await app.unmount();
	app = await mount();
	await fireEvent.press((await screen.findAllByLabelText(/set 1, /))[0]);
	expect(await screen.findByDisplayValue("72.5")).toBeTruthy();
	expect(screen.getByDisplayValue("5")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
	await app.unmount();
});

it("recovers a committed log after losing its response, without a second write", async () => {
	add.mockImplementation(async () => {
		receipt = { setId: "set-1", status: "saved" };
		loggedSets = [serverSet("set-1", 8, 1)];
		throw new Error("Response lost");
	});
	const app = await mount();
	await fireEvent.press(await firstCheck());
	await app.unmount();
	await mount();
	expect(await screen.findByText(/1 logged/)).toBeTruthy();
	expect(add).toHaveBeenCalledTimes(1);
});

it("does not send a set while offline and says it failed", async () => {
	online = false;
	await mount();
	await fireEvent.press(await firstCheck());
	expect(await screen.findByTestId("session-toast-action")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
});

it("retries under the same operation until the server says the first never landed", async () => {
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await fireEvent.press(await screen.findByTestId("session-toast-action"));
	expect(add).toHaveBeenCalledTimes(2);
	expect(add.mock.calls[1][0].operationId).toBe(
		add.mock.calls[0][0].operationId,
	);
});

it("applies a Krachtprofiel row only at Apply, and logs nothing", async () => {
	await mount();
	await fireEvent.press(await firstRow());
	await fireEvent.press(
		await screen.findByRole("button", { name: /Strength profile/ }),
	);
	await fireEvent.press(await screen.findByText("80%"));
	expect(add).not.toHaveBeenCalled();
	await fireEvent.press(
		screen.getByRole("button", { name: /Apply · 80 kg × / }),
	);
	expect(await screen.findByDisplayValue("80")).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
});

it("asks before dropping a change to a logged set", async () => {
	loggedSets = [serverSet("set-1", 8, 1)];
	await mount();
	await fireEvent.press((await screen.findAllByLabelText(/set 1, Logged/))[0]);
	await fireEvent.changeText(
		await screen.findByTestId("session-editor-load"),
		"75",
	);
	await act(() => router.back());
	expect(await screen.findByText("Save your changes?")).toBeTruthy();
	expect(update).not.toHaveBeenCalled();
});

it("finishes through the recap, saving only at Done", async () => {
	loggedSets = [serverSet("set-1", 8, 1)];
	await mount();
	await fireEvent.press(await screen.findByRole("button", { name: "Done" }));
	await fireEvent.press(
		await screen.findByRole("button", { name: /Finish · 1 set/ }),
	);
	expect(await screen.findByText("Lower A done")).toBeTruthy();
	await fireEvent.press(await screen.findByTestId("session-recap-confirm"));
	expect(finish).toHaveBeenCalled();
});

it("starts empty and offers to delete a session with nothing in it", async () => {
	currentSession = emptySession;
	await mount();
	expect(await screen.findByTestId("session-add-exercise")).toBeTruthy();
	await fireEvent.press(await screen.findByRole("button", { name: "Done" }));
	await fireEvent.press(
		await screen.findByRole("button", { name: "Delete session" }),
	);
	expect(cancel).toHaveBeenCalled();
});
