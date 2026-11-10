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
import * as SessionRoute from "../../../app/(app)/session";
import * as GroupRoute from "../../../app/(app)/session-group";
import * as ManualRoute from "../../../app/(app)/session-manual";
import * as EditorLayout from "../../../app/(app)/set-editor/_layout";
import * as EditorRoute from "../../../app/(app)/set-editor/index";
import * as ProfileRoute from "../../../app/(app)/set-editor/strength-profile";
import { renderApp } from "../../test-support/render-app";
import { workspaceKey, workspaceStore } from "./data/session-workspace";
import {
	allRows,
	findRow,
	groupWith,
	markFailed,
	type PlanSet,
	type SessionPlan,
	seedPlan,
	setGroupMode,
	setGroupRounds,
	startClock,
	stopClock,
	updateRow,
} from "./session-plan";

// Every test signs in as a new account, so nothing it leaves on the phone carries over.
let mockSubject = "";
jest.mock("@clerk/expo", () => ({
	useAuth: () => ({ userId: mockSubject, isLoaded: true, isSignedIn: true }),
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

const planKey = () => workspaceKey(mockSubject, "session-1");
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
const removeSet = jest.fn();
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
	mockSubject = `test-user-${Math.random().toString(36).slice(2)}`;
	currentSession = { ...session, userId: mockSubject };
	loggedSets = [];
	receipt = null;
	online = true;
	add.mockReset();
	update.mockReset();
	removeSet.mockReset();
	finish.mockReset();
	cancel.mockReset();
	add.mockImplementation(async () => {
		const id = `set-${loggedSets.length + 1}`;
		loggedSets = [...loggedSets, serverSet(id, 8, loggedSets.length + 1)];
		return id;
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
					: name === "sets:remove"
						? removeSet
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
	// The answer links to the planned row rather than adding one beside it.
	expect(screen.getAllByLabelText(/, Logged/)).toHaveLength(1);
	expect(
		screen.getAllByLabelText(/Log Barbell Back Squat 60 × 8/),
	).toHaveLength(1);
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

it("keeps a set frozen while it is unknown whether its send landed", async () => {
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await screen.findByTestId("session-toast-action");
	const sent = add.mock.calls[0][0];
	await fireEvent.press((await screen.findAllByLabelText(/set 1, /))[0]);
	expect(await screen.findByText(/may already be saved/)).toBeTruthy();
	const load = screen.getByDisplayValue(String(sent.weight));
	expect(load.props.editable).toBe(false);
	await fireEvent.press(screen.getByRole("button", { name: /^Try again/ }));
	expect(add).toHaveBeenCalledTimes(2);
	expect(add.mock.calls[1][0]).toEqual(sent);
});

it("starts rest when a send fails, but not again when it is retried", async () => {
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await fireEvent.press(await screen.findByTestId("session-rest-stop"));
	await fireEvent.press(await screen.findByTestId("session-toast-action"));
	expect(add).toHaveBeenCalledTimes(2);
	expect(screen.queryByTestId("session-rest-stop")).toBeNull();
});

it("starts the next rest offline once the last one has run out", async () => {
	online = false;
	await mount();
	await fireEvent.press(await firstCheck());
	const realNow = Date.now();
	const later = jest.spyOn(Date, "now").mockReturnValue(realNow + 3_600_000);
	try {
		await fireEvent.press(
			(await screen.findAllByLabelText("Log Barbell Back Squat 60 × 8"))[1],
		);
		const hidden = { includeHiddenElements: true };
		expect(await screen.findByText(/^Rest \d/, hidden)).toBeTruthy();
		expect(screen.queryByText("Rest over", hidden)).toBeNull();
	} finally {
		later.mockRestore();
	}
});

it("won't remove a set whose send is still on its way", async () => {
	add.mockImplementation(() => new Promise(() => {}));
	await mount();
	await fireEvent.press(await firstCheck());
	await fireEvent.press(
		screen.getAllByRole("button", {
			name: "Delete",
			includeHiddenElements: true,
		})[0],
	);
	expect(await screen.findByText(/still being logged/)).toBeTruthy();
});

it("won't remove a set until its lost send is settled", async () => {
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await screen.findByTestId("session-toast-action");
	const sets = () =>
		screen.getAllByRole("checkbox", { name: /Barbell Back Squat 60 × 8/ })
			.length;
	const before = sets();
	await fireEvent.press(
		screen.getAllByRole("button", {
			name: "Delete",
			includeHiddenElements: true,
		})[0],
	);
	expect(await screen.findByText(/may already be saved/)).toBeTruthy();
	expect(sets()).toBe(before);
});

it("won't cancel the session until a lost send is settled", async () => {
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await screen.findByTestId("session-toast-action");
	await fireEvent.press(
		await screen.findByText("Cancel session", { includeHiddenElements: true }),
	);
	expect(await screen.findByText(/may already be saved/)).toBeTruthy();
	expect(screen.queryByText("Cancel session?")).toBeNull();
	expect(cancel).not.toHaveBeenCalled();
});

it("won't finish while a set failed, and offers the retry instead", async () => {
	loggedSets = [serverSet("set-1", 8, 1)];
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await fireEvent.press(await screen.findByRole("button", { name: "Done" }));
	expect(await screen.findByText(/Retry or remove it/)).toBeTruthy();
	expect(screen.queryByText("Lower A done")).toBeNull();
	expect(finish).not.toHaveBeenCalled();
});

it("won't finish on a send left unresolved by a restart, and retries it", async () => {
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	loggedSets = [serverSet("set-1", 8, 1)];
	let app = await mount();
	await fireEvent.press(await firstCheck());
	await screen.findByTestId("session-toast-action");
	await act(async () =>
		workspaceStore.update(planKey(), (plan) => {
			const row = allRows(plan).find((item) => item.attempt) as PlanSet;
			return updateRow(plan, row.id, { ...row, failed: undefined });
		}),
	);
	await app.unmount();
	app = await mount();
	await fireEvent.press(await screen.findByRole("button", { name: "Done" }));
	expect(await screen.findByText(/Retry or remove it/)).toBeTruthy();
	expect(finish).not.toHaveBeenCalled();
	const sent = add.mock.calls[0][0];
	await fireEvent.press(screen.getByTestId("session-toast-action"));
	expect(add).toHaveBeenCalledTimes(2);
	expect(add.mock.calls[1][0].operationId).toBe(sent.operationId);
	await app.unmount();
});

it("won't take a Krachtprofiel value onto a set with an unresolved send", async () => {
	receipt = undefined;
	add.mockRejectedValueOnce(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await screen.findByTestId("session-toast-action");
	const sent = add.mock.calls[0][0];
	await fireEvent.press((await screen.findAllByLabelText(/set 1, /))[0]);
	await fireEvent.press(
		await screen.findByRole("button", { name: /Strength profile/ }),
	);
	await fireEvent.press(await screen.findByText("80%"));
	await fireEvent.press(
		screen.getByRole("button", { name: /Apply · 80 kg × / }),
	);
	expect(screen.queryByDisplayValue("80")).toBeNull();
	await fireEvent.press(
		await screen.findByRole("button", { name: /^Try again/ }),
	);
	expect(add).toHaveBeenCalledTimes(2);
	expect(add.mock.calls[1][0]).toEqual(sent);
});

it("keeps other changes when undoing a log fails", async () => {
	add.mockResolvedValue("set-1");
	removeSet.mockRejectedValue(new Error("Connection lost"));
	await mount();
	await fireEvent.press(await firstCheck());
	await screen.findByTestId("session-toast-action");
	const plan = workspaceStore.plan(planKey()) as SessionPlan;
	const other = allRows(plan).find((row) => !row.done) as PlanSet;
	const logged = allRows(plan).find((row) => row.done) as PlanSet;
	await act(async () =>
		workspaceStore.update(planKey(), (current) =>
			updateRow(current, other.id, { ...other, reps: 9 }),
		),
	);
	await act(async () => {
		fireEvent.press(screen.getByTestId("session-toast-action"));
	});
	const after = workspaceStore.plan(planKey()) as SessionPlan;
	expect(removeSet).toHaveBeenCalledTimes(1);
	expect(findRow(after, other.id)?.reps).toBe(9);
	expect(findRow(after, logged.id)?.done).toBe(true);
});

it("keeps a set logged until the server has let it go", async () => {
	add.mockResolvedValue("set-1");
	let fail = (_error: Error) => {};
	removeSet.mockImplementation(
		() =>
			new Promise((_resolve, reject) => {
				fail = reject;
			}),
	);
	await mount();
	await fireEvent.press(await firstCheck());
	await screen.findByTestId("session-toast-action");
	const logged = () =>
		screen.queryAllByRole("checkbox", {
			name: "Barbell Back Squat 60 × 8, logged",
		});
	const later = Date.now() + 60_000;
	const clock = jest.spyOn(Date, "now").mockReturnValue(later);
	await fireEvent.press(logged()[0]);
	await fireEvent.press(logged()[0]);
	expect(removeSet).toHaveBeenCalledTimes(1);
	expect(logged()).toHaveLength(1);
	await act(async () => fail(new Error("Connection lost")));
	expect(logged()).toHaveLength(1);
	removeSet.mockResolvedValue(undefined);
	await fireEvent.press(logged()[0]);
	clock.mockRestore();
	expect(logged()).toHaveLength(0);
});

it("won't close a group while one of its sets failed", async () => {
	const facts = {
		bodyweight: false,
		stepKg: 2.5,
		measured: 100,
		estimated: null,
		savedManual: null,
		measuredDate: 1,
		last: null,
	};
	const second = "shipped:exercise:barbell-bench-press";
	const plannedSets = [{ weight: 60, reps: 8, unit: "kg" as const }];
	const exercises = [
		{ exerciseId, plannedSets },
		{ exerciseId: second, plannedSets },
	];
	currentSession = { ...currentSession, exercises };
	const grouped = groupWith(
		seedPlan(exercises, [], () => facts),
		exerciseId,
		second,
	);
	const id = grouped.groupId as string;
	let plan = setGroupMode(grouped.plan, id, "amrap").plan;
	plan = startClock(plan, id, 0).plan;
	plan = stopClock(plan, id, 1000);
	const row = plan.groups[id]?.rounds[0]?.items[0] as PlanSet;
	workspaceStore.setPlan(planKey(), markFailed(plan, row.id, false));
	await mount();
	await fireEvent.press(
		await screen.findByRole("button", { name: /Reset clock|^Close/ }),
	);
	expect(await screen.findByText(/Retry or remove it first/)).toBeTruthy();
	expect(workspaceStore.plan(planKey())?.groups[id]?.state).toBe("timeup");
});

it("won't drop a failed set by shrinking its group or switching it to a clock", async () => {
	const facts = {
		bodyweight: false,
		stepKg: 2.5,
		measured: 100,
		estimated: null,
		savedManual: null,
		measuredDate: 1,
		last: null,
	};
	const second = "shipped:exercise:barbell-bench-press";
	const plannedSets = [{ weight: 60, reps: 8, unit: "kg" as const }];
	const exercises = [
		{ exerciseId, plannedSets },
		{ exerciseId: second, plannedSets },
	];
	currentSession = { ...currentSession, exercises };
	const grouped = groupWith(
		seedPlan(exercises, [], () => facts),
		exerciseId,
		second,
	);
	const id = grouped.groupId as string;
	const plan = setGroupRounds(grouped.plan, id, 1).plan;
	const rounds = plan.groups[id]?.rounds ?? [];
	const row = rounds.at(-1)?.items[0] as PlanSet;
	workspaceStore.setPlan(planKey(), markFailed(plan, row.id, false));
	await mount();
	await act(() =>
		router.push(`/session-group?sessionId=session-1&groupId=${id}`),
	);
	await fireEvent.press(
		await screen.findByRole("button", { name: "One round fewer" }),
	);
	expect(workspaceStore.plan(planKey())?.groups[id]?.rounds).toHaveLength(
		rounds.length,
	);
	await fireEvent.press(await screen.findByLabelText("As many as possible"));
	expect(workspaceStore.plan(planKey())?.groups[id]?.mode).toBe("rounds");
});

it("undoes a removed set, unless the session changed since", async () => {
	const removeFirst = () =>
		fireEvent.press(
			screen.getAllByRole("button", {
				name: "Delete",
				includeHiddenElements: true,
			})[0],
		);
	await mount();
	await firstRow();
	const start = workspaceStore.plan(planKey());
	await removeFirst();
	await fireEvent.press(await screen.findByTestId("session-toast-action"));
	expect(workspaceStore.plan(planKey())).toBe(start);

	await removeFirst();
	await screen.findByTestId("session-toast-action");
	await act(async () =>
		workspaceStore.update(planKey(), (plan) => ({ ...plan, restDefault: 45 })),
	);
	await fireEvent.press(screen.getByTestId("session-toast-action"));
	expect(await screen.findByText(/Can't undo/)).toBeTruthy();
	expect(workspaceStore.plan(planKey())?.restDefault).toBe(45);
});

it("won't log the old value behind a cleared field", async () => {
	await mount();
	await fireEvent.press(await firstRow());
	const reps = await screen.findByTestId("session-editor-reps");
	await fireEvent(reps, "focus");
	await fireEvent.changeText(reps, "");
	expect(screen.getByRole("button", { name: "Enter reps" })).toBeDisabled();
	expect(add).not.toHaveBeenCalled();
});

it("keeps a correction to a logged set across a fresh app mount", async () => {
	loggedSets = [serverSet("set-1", 8, 1)];
	let app = await mount();
	await fireEvent.press((await screen.findAllByLabelText(/set 1, Logged/))[0]);
	await fireEvent.changeText(
		await screen.findByTestId("session-editor-load"),
		"75",
	);
	await act(() => router.back());
	await app.unmount();
	app = await mount();
	await fireEvent.press((await screen.findAllByLabelText(/set 1, Logged/))[0]);
	expect(await screen.findByDisplayValue("75")).toBeTruthy();
	expect(update).not.toHaveBeenCalled();
	await app.unmount();
});

it("freezes a correction while its save is on its way", async () => {
	loggedSets = [serverSet("set-1", 8, 1)];
	let finishSave = () => {};
	update.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishSave = resolve;
			}),
	);
	await mount();
	await fireEvent.press((await screen.findAllByLabelText(/set 1, Logged/))[0]);
	const load = await screen.findByTestId("session-editor-load");
	await fireEvent.changeText(load, "75");
	await fireEvent(load, "blur");
	await fireEvent.press(screen.getByRole("button", { name: /^Save/ }));
	expect(update).toHaveBeenCalledTimes(1);
	expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
	expect(screen.getByTestId("session-editor-load").props.editable).toBe(false);
	await act(async () => finishSave());
});

it("won't log a pasted negative value as the old one", async () => {
	await mount();
	await fireEvent.press(await firstRow());
	const reps = await screen.findByTestId("session-editor-reps");
	await fireEvent(reps, "focus");
	await fireEvent.changeText(reps, "-1");
	expect(screen.getByRole("button", { name: "Enter reps" })).toBeDisabled();
});

it("asks about a likely typo even when Log is tapped with the keyboard up", async () => {
	await mount();
	await fireEvent.press(await firstRow());
	const load = await screen.findByTestId("session-editor-load");
	await fireEvent(load, "focus");
	await fireEvent.changeText(load, "200");
	await fireEvent.press(screen.getByRole("button", { name: /^Log · 200 kg/ }));
	await fireEvent(load, "blur");
	expect(
		screen.getByRole("button", { name: /200 kg.*(right|correct)/i }),
	).toBeTruthy();
	expect(add).not.toHaveBeenCalled();
});

it("says so at Finish when a correction to a logged set isn't saved", async () => {
	loggedSets = [serverSet("set-1", 8, 1)];
	const app = await mount();
	await fireEvent.press((await screen.findAllByLabelText(/set 1, Logged/))[0]);
	await fireEvent.changeText(
		await screen.findByTestId("session-editor-load"),
		"75",
	);
	await app.unmount();
	await mount();
	await fireEvent.press(await screen.findByRole("button", { name: "Done" }));
	expect(
		await screen.findByText(/1 change to a logged set is not saved/),
	).toBeTruthy();
	expect(finish).not.toHaveBeenCalled();
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
	await fireEvent.press(await screen.findByRole("button", { name: "Discard" }));
	expect(screen.queryByTestId("session-editor-load")).toBeNull();
	expect(await screen.findAllByLabelText(/set 1, Logged/)).toBeTruthy();
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
	currentSession = { ...emptySession, userId: mockSubject };
	await mount();
	expect(await screen.findByTestId("session-add-exercise")).toBeTruthy();
	await fireEvent.press(await screen.findByRole("button", { name: "Done" }));
	await fireEvent.press(
		await screen.findByRole("button", { name: "Delete session" }),
	);
	expect(cancel).toHaveBeenCalled();
});
