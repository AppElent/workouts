/** The session as a person uses it: the table, the editor, offline, finishing. */
import {
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
	useQueries,
	useQuery,
} from "convex/react";
import { getFunctionName } from "convex/server";
import { router } from "expo-router";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { ActionSheetIOS, Dimensions, StyleSheet } from "react-native";
import * as SessionRoute from "../../../app/(app)/session";
import * as GroupRoute from "../../../app/(app)/session-group";
import * as ManualRoute from "../../../app/(app)/session-manual";
import * as EditorLayout from "../../../app/(app)/set-editor/_layout";
import * as EditorRoute from "../../../app/(app)/set-editor/index";
import * as ProfileRoute from "../../../app/(app)/set-editor/strength-profile";
import {
	PREFERENCE_KEYS,
	removeLocal,
	writeLocal,
} from "../../local-store/local-store";
import { renderApp } from "../../test-support/render-app";
import { workspaceKey, workspaceStore } from "./data/session-workspace";
import {
	addToGroup,
	allRows,
	beginAttempt,
	findRow,
	groupWith,
	markFailed,
	markLogged,
	type PlanSet,
	type SessionPlan,
	seedPlan,
	sessionExercises,
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
let receipt: { setId: string; status: "saved" | "removed" } | null | undefined =
	null;
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
	removeLocal(PREFERENCE_KEYS.setEditorMode);
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

it.each([
	["Chin-Up", "shipped:exercise:chin-up"],
	["Inverted Row", "shipped:exercise:inverted-row"],
])("logs a bodyweight %s set with reps only (APP-217)", async (name, id) => {
	currentSession = {
		...currentSession,
		exercises: [{ exerciseId: id, plannedSets: [] }],
	};
	await mount();
	await fireEvent.press(await screen.findByLabelText(`Add set, ${name}`));
	const reps = await screen.findByTestId("session-editor-reps");
	await fireEvent(reps, "focus");
	await fireEvent.changeText(reps, "8");
	await fireEvent(reps, "blur");
	await fireEvent.press(screen.getByText("Log · +0 × 8"));
	expect(add).toHaveBeenCalledTimes(1);
	expect(add.mock.calls[0][0]).toMatchObject({
		exerciseId: id,
		reps: 8,
		weight: 0,
		unit: "kg",
	});
});

it("shows the plan against the measured 1RM, with what each set would be worth", async () => {
	await mount();
	expect(await screen.findByText(/Measured 1RM 100 kg/)).toBeTruthy();
	expect(
		screen.getAllByLabelText(
			/set 1, 60 percent, 60 × 8, 1RM about 76 kilograms/,
		),
	).toHaveLength(1);
});

it.each([
	[
		"en",
		"RPE 8.5",
		/set 1, Logged, 60 percent, 60 × 8, RPE 8\.5, 1RM about 76 kilograms$/,
	],
	[
		"nl",
		"RPE 8,5",
		/set 1, Gelogd, 60 procent, 60 × 8, RPE 8,5, 1RM ongeveer 76 kilo$/,
	],
])(
	"speaks the RPE a logged row shows in %s (APP-836)",
	async (locale, shown, spoken) => {
		writeLocal(PREFERENCE_KEYS.locale, locale);
		try {
			loggedSets = [{ ...serverSet("set-1", 8, 1), rpe: 8.5 }];
			await mount();
			expect(await screen.findByText(shown)).toBeTruthy();
			expect(screen.getAllByLabelText(spoken)).toHaveLength(1);
			expect(screen.getAllByLabelText(/RPE/)).toHaveLength(1);
		} finally {
			writeLocal(PREFERENCE_KEYS.locale, "en");
		}
	},
);

it("says the session ended when it was finished elsewhere and the plan is gone", async () => {
	await mount();
	await screen.findByText(/Measured 1RM 100 kg/);
	await act(async () => {
		currentSession = { ...currentSession, status: "completed" };
		workspaceStore.clear(planKey());
	});
	await mount();
	expect(await screen.findByText(/This session has ended/)).toBeTruthy();
	expect(screen.queryByText(/Checking/)).toBeNull();
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
	expect(await screen.findByTestId("session-rest-timer")).toBeTruthy();
	// The answer links to the planned row rather than adding one beside it.
	expect(screen.getAllByLabelText(/, Logged/)).toHaveLength(1);
	expect(
		screen.getAllByLabelText(/Log Barbell Back Squat 60 × 8/),
	).toHaveLength(1);
});

describe("the progress line under the title (APP-931)", () => {
	const direction = () =>
		StyleSheet.flatten(
			screen.getByTestId("session-progress-labels").props.style,
		).flexDirection;
	let dimensions: jest.SpyInstance | undefined;
	const logOne = async (fontScale: number) => {
		// Jest's React Native reports fontScale 2, so both cases pin it.
		dimensions = jest
			.spyOn(Dimensions, "get")
			.mockReturnValue({ width: 375, height: 812, scale: 3, fontScale });
		await mount();
		await fireEvent.press(await firstCheck());
		expect(await screen.findByText(/^1 of \d+ sets$/)).toBeTruthy();
	};

	afterEach(() => dimensions?.mockRestore());

	it("puts the set count and the volume on one line", async () => {
		await logOne(1);
		expect(direction()).toBe("row");
	});

	it("stacks them at accessibility text sizes so neither runs off screen", async () => {
		await logOne(3.1);
		expect(direction()).toBe("column");
	});
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
	expect(await screen.findByText(/· 1 set$/)).toBeTruthy();
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
	// The Now card has no close button; VoiceOver's "stop" action ends rest.
	await fireEvent(
		await screen.findByTestId("session-rest-timer"),
		"accessibilityAction",
		{
			nativeEvent: { actionName: "stop" },
		},
	);
	await fireEvent.press(await screen.findByTestId("session-toast-action"));
	expect(add).toHaveBeenCalledTimes(2);
	expect(screen.queryByTestId("session-rest-timer")).toBeNull();
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
		expect(await screen.findByText(/^Rest · of \d/, hidden)).toBeTruthy();
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
	await fireEvent.press(await screen.findByRole("button", { name: "Finish" }));
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
	await fireEvent.press(await screen.findByRole("button", { name: "Finish" }));
	expect(await screen.findByText(/Retry or remove it/)).toBeTruthy();
	expect(finish).not.toHaveBeenCalled();
	const sent = add.mock.calls[0][0];
	await fireEvent.press(screen.getByTestId("session-toast-action"));
	expect(add).toHaveBeenCalledTimes(2);
	expect(add.mock.calls[1][0].operationId).toBe(sent.operationId);
	await app.unmount();
});

it("won't take a Krachtprofiel value onto a set with an unresolved send", async () => {
	// The 1RM line and the profile link live in the advanced editor.
	writeLocal(PREFERENCE_KEYS.setEditorMode, "advanced");
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
		exercise: { equipment: "barbell" as const },
		bodyweight: false,
		timed: false,
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

describe("a set logged elsewhere while a grouped send is unresolved (APP-699)", () => {
	const facts = {
		exercise: { equipment: "barbell" as const },
		bodyweight: false,
		timed: false,
		stepKg: 2.5,
		measured: 100,
		estimated: null,
		savedManual: null,
		measuredDate: 1,
		last: null,
	};
	const second = "shipped:exercise:barbell-bench-press";
	const plannedSets = [
		{ weight: 60, reps: 8, unit: "kg" as const },
		{ weight: 60, reps: 8, unit: "kg" as const },
	];
	const exercises = [
		{ exerciseId, plannedSets },
		{ exerciseId: second, plannedSets },
	];
	/** One cell per exercise and round: the linked set's id, or "open". */
	const shape = (groupId: string) =>
		(workspaceStore.plan(planKey())?.groups[groupId]?.rounds ?? []).map(
			(round) =>
				round.items.map(
					(row) =>
						`${row.exerciseId === exerciseId ? "squat" : "bench"}:${row.setId ?? "open"}`,
				),
		);
	// The live query pushes a new value: a new plan object makes the screens render again.
	const queryAnswers = () =>
		act(async () => workspaceStore.update(planKey(), (plan) => ({ ...plan })));

	// Like the query cache, answer with the same object until a value changes. The
	// shared mocks build a new one per render (queries, exercise catalog), which
	// would re-run every reconcile and hide whether the settled receipt triggers it.
	const exercisePage = {
		results: [],
		status: "Exhausted",
		loadMore: jest.fn(),
	};
	beforeEach(() => {
		jest
			.mocked(usePaginatedQuery)
			.mockImplementation(() => exercisePage as never);
		const answer = jest.mocked(useQueries).getMockImplementation();
		const previous = new Map<string, Record<string, unknown>>();
		jest.mocked(useQueries).mockImplementation((queries) => {
			const next = (answer as NonNullable<typeof answer>)(queries);
			const id = Object.keys(queries).join("|");
			const before = previous.get(id);
			const same =
				before &&
				Object.keys(next).every((key) => Object.is(before[key], next[key]));
			if (before && same) return before;
			previous.set(id, next);
			return next;
		});
	});

	afterEach(() => {
		jest
			.mocked(usePaginatedQuery)
			.mockImplementation(
				() =>
					({ results: [], status: "Exhausted", loadMore: jest.fn() }) as never,
			);
	});

	async function mountWithUnresolvedSend() {
		currentSession = { ...currentSession, exercises };
		const grouped = groupWith(
			seedPlan(exercises, [], () => facts),
			exerciseId,
			second,
		);
		const groupId = grouped.groupId as string;
		const first = grouped.plan.groups[groupId]?.rounds[0]?.items[0] as PlanSet;
		// A send left unresolved by a restart: its receipt has not arrived.
		receipt = undefined;
		workspaceStore.setPlan(
			planKey(),
			updateRow(
				grouped.plan,
				first.id,
				beginAttempt(grouped.plan, first.id, "op-1") as PlanSet,
			),
		);
		await mount();
		return { groupId, first };
	}

	it("fills the first open planned row once the attempt's receipt says it was removed", async () => {
		const { groupId, first } = await mountWithUnresolvedSend();
		expect(
			findRow(workspaceStore.plan(planKey()) as SessionPlan, first.id)?.attempt,
		).toMatchObject({
			setNumber: 1,
		});
		// Another device or the MCP logs a set with the attempt's number.
		loggedSets = [serverSet("mcp-1", 5, 1)];
		await queryAnswers();
		// It waits: only the receipt can say whether it is the attempt's own set.
		expect(shape(groupId)).toEqual([
			["squat:open", "bench:open"],
			["squat:open", "bench:open"],
		]);
		expect(
			findRow(workspaceStore.plan(planKey()) as SessionPlan, first.id)?.attempt,
		).toBeTruthy();

		receipt = { setId: "gone", status: "removed" };
		await queryAnswers();
		await waitFor(() =>
			expect(shape(groupId)).toEqual([
				["squat:mcp-1", "bench:open"],
				["squat:open", "bench:open"],
			]),
		);
		// It took the freed planned row, keeping its place and target, and added no round.
		const filled = findRow(
			workspaceStore.plan(planKey()) as SessionPlan,
			first.id,
		);
		expect(filled).toMatchObject({
			setId: "mcp-1",
			done: true,
			reps: 5,
			plan: { kg: 60, reps: 8 },
		});
		expect(filled?.attempt).toBeUndefined();
		expect(
			workspaceStore.plan(planKey())?.groups[groupId]?.rounds,
		).toHaveLength(2);
	});

	it("skips the row when input was entered here while the set waited", async () => {
		const { groupId, first } = await mountWithUnresolvedSend();
		loggedSets = [serverSet("mcp-1", 5, 1)];
		await queryAnswers();
		receipt = { setId: "gone", status: "removed" };
		// The person changes the load before the receipt is read.
		await act(async () =>
			workspaceStore.update(planKey(), (plan) => {
				const row = findRow(plan, first.id) as PlanSet;
				return updateRow(plan, first.id, { ...row, kg: 100 });
			}),
		);
		await waitFor(() =>
			expect(shape(groupId)).toEqual([
				["squat:open", "bench:open"],
				["squat:mcp-1", "bench:open"],
			]),
		);
		expect(
			findRow(workspaceStore.plan(planKey()) as SessionPlan, first.id),
		).toMatchObject({
			kg: 100,
			done: false,
		});
	});
});

it("won't drop a failed set by shrinking its group or switching it to a clock", async () => {
	const facts = {
		exercise: { equipment: "barbell" as const },
		bodyweight: false,
		timed: false,
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

it("takes one exercise out of a group from the group sheet (APP-215)", async () => {
	const facts = {
		exercise: { equipment: "barbell" as const },
		bodyweight: false,
		timed: false,
		stepKg: 2.5,
		measured: 100,
		estimated: null,
		savedManual: null,
		measuredDate: 1,
		last: null,
	};
	const second = "shipped:exercise:barbell-bench-press";
	const third = "shipped:exercise:barbell-deadlift";
	const plannedSets = [{ weight: 60, reps: 8, unit: "kg" as const }];
	const exercises = [
		{ exerciseId, plannedSets },
		{ exerciseId: second, plannedSets },
		{ exerciseId: third, plannedSets },
	];
	currentSession = { ...currentSession, exercises };
	const grouped = groupWith(
		seedPlan(exercises, [], () => facts),
		exerciseId,
		second,
	);
	const id = grouped.groupId as string;
	workspaceStore.setPlan(planKey(), addToGroup(grouped.plan, id, third).plan);
	await mount();
	await act(() =>
		router.push(`/session-group?sessionId=session-1&groupId=${id}`),
	);
	await fireEvent.press(
		await screen.findByLabelText(/^Options for Barbell Bench Press/),
	);
	await fireEvent.press(
		await screen.findByRole("button", { name: "Remove from group" }),
	);
	const plan = workspaceStore.plan(planKey()) as SessionPlan;
	expect(sessionExercises(plan)).toEqual([exerciseId, third, second]);
	expect(plan.order).toEqual([
		{ kind: "group", groupId: id },
		{ kind: "exercise", exerciseId: second },
	]);
});

it("asks before removing a grouped exercise with logged sets, and keeps it on Keep training (APP-215)", async () => {
	const facts = {
		exercise: { equipment: "barbell" as const },
		bodyweight: false,
		timed: false,
		stepKg: 2.5,
		measured: 100,
		estimated: null,
		savedManual: null,
		measuredDate: 1,
		last: null,
	};
	const second = "shipped:exercise:barbell-bench-press";
	const third = "shipped:exercise:barbell-deadlift";
	const plannedSets = [{ weight: 60, reps: 8, unit: "kg" as const }];
	const exercises = [
		{ exerciseId, plannedSets },
		{ exerciseId: second, plannedSets },
		{ exerciseId: third, plannedSets },
	];
	currentSession = { ...currentSession, exercises };
	const grouped = groupWith(
		seedPlan(exercises, [], () => facts),
		exerciseId,
		second,
	);
	const id = grouped.groupId as string;
	const joined = addToGroup(grouped.plan, id, third).plan;
	const benchRow = (joined.groups[id]?.rounds[0]?.items ?? []).find(
		(item) => item.exerciseId === second,
	) as PlanSet;
	const logged = markLogged(joined, benchRow.id, "set-b1", 1, facts).plan;
	loggedSets = [{ ...serverSet("set-b1", 8, 1), exerciseId: second }];
	removeSet.mockImplementation(async ({ id: setId }: { id: string }) => {
		loggedSets = loggedSets.filter((item) => item._id !== setId);
	});
	workspaceStore.setPlan(planKey(), logged);
	const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions");
	await mount();
	await act(() =>
		router.push(`/session-group?sessionId=session-1&groupId=${id}`),
	);
	const removeBench = async () => {
		await fireEvent.press(
			await screen.findByLabelText(/^Options for Barbell Bench Press/),
		);
		await fireEvent.press(
			await screen.findByRole("button", { name: "Remove exercise" }),
		);
	};

	sheet.mockImplementationOnce((_options, pick) => pick(1));
	await removeBench();
	expect(sheet).toHaveBeenLastCalledWith(
		expect.objectContaining({
			title: "Remove Barbell Bench Press?",
			options: ["Remove", "Keep training"],
			destructiveButtonIndex: 0,
		}),
		expect.any(Function),
	);
	expect(removeSet).not.toHaveBeenCalled();
	let plan = workspaceStore.plan(planKey()) as SessionPlan;
	expect(sessionExercises(plan)).toEqual([exerciseId, second, third]);
	expect(findRow(plan, benchRow.id)?.done).toBe(true);

	sheet.mockImplementationOnce((_options, pick) => pick(0));
	await removeBench();
	expect(removeSet).toHaveBeenCalledWith({ id: "set-b1" });
	plan = workspaceStore.plan(planKey()) as SessionPlan;
	expect(sessionExercises(plan)).toEqual([exerciseId, third]);
	expect(allRows(plan).some((row) => row.exerciseId === second)).toBe(false);
	sheet.mockRestore();
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
	await fireEvent.press(await screen.findByRole("button", { name: "Finish" }));
	expect(
		await screen.findByText(/1 change to a logged set is not saved/),
	).toBeTruthy();
	expect(finish).not.toHaveBeenCalled();
});

it("applies a Krachtprofiel row only at Apply, and logs nothing", async () => {
	// The 1RM line and the profile link live in the advanced editor.
	writeLocal(PREFERENCE_KEYS.setEditorMode, "advanced");
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

it("opens Krachtprofiel from the current exercise's menu and applies to its next set (APP-393)", async () => {
	await mount();
	await fireEvent.press(
		await screen.findByLabelText(/^Options for Barbell Back Squat/),
	);
	await fireEvent.press(
		await screen.findByRole("button", { name: "Strength profile" }),
	);
	await fireEvent.press(await screen.findByText("80%"));
	await fireEvent.press(
		screen.getByRole("button", { name: /Apply · 80 kg × 8/ }),
	);
	expect(
		await screen.findAllByLabelText(/set 1, 80 percent, 80 × 8/),
	).toHaveLength(1);
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

it("finishes through the recap, saving only at Save", async () => {
	loggedSets = [serverSet("set-1", 8, 1)];
	await mount();
	await fireEvent.press(await screen.findByRole("button", { name: "Finish" }));
	await fireEvent.press(
		await screen.findByRole("button", { name: /Finish · 1 set/ }),
	);
	expect(await screen.findByText("Lower A done")).toBeTruthy();
	await fireEvent.press(await screen.findByTestId("session-recap-confirm"));
	expect(finish).toHaveBeenCalled();
});

describe("session leftovers (APP-624)", () => {
	const benchId = "shipped:exercise:barbell-bench-press";
	const warmup = (id: string, number: number) => ({
		...serverSet(id, 5, number),
		weight: 20,
		setType: "warmup",
	});

	it("counts working sets at Finish, not the logged warm-up", async () => {
		loggedSets = [warmup("w-1", 1), serverSet("set-2", 8, 2)];
		await mount();
		await fireEvent.press(
			await screen.findByRole("button", { name: "Finish" }),
		);
		// One work set is logged, one is open; the warm-up counts for neither.
		expect(await screen.findByText(/1 set is still open/)).toBeTruthy();
		expect(screen.getByText(/Only the logged set counts/)).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /Finish · 1 set$/ }),
		).toBeTruthy();
	});

	it("keeps an exercise with only logged warm-ups open, never '0 sets'", async () => {
		currentSession = {
			...currentSession,
			exercises: [
				{
					exerciseId: benchId,
					plannedSets: [{ weight: 60, reps: 8, unit: "kg" }],
					references: { measured: null, estimated: null, manual: null },
				},
				{
					exerciseId,
					plannedSets: [],
					references: { measured: null, estimated: null, manual: null },
				},
			],
		};
		loggedSets = [warmup("w-1", 1)];
		await mount();
		await screen.findAllByLabelText(/Barbell Back Squat/);
		expect(screen.queryByLabelText(/Barbell Back Squat, 0 sets/)).toBeNull();
		expect(screen.queryByText(/^0 sets$/)).toBeNull();
	});

	it("shows no totals before the first set of a free exercise is logged", async () => {
		currentSession = {
			...currentSession,
			exercises: [
				{
					exerciseId,
					plannedSets: [],
					references: { measured: null, estimated: null, manual: null },
				},
			],
		};
		await mount();
		await screen.findAllByLabelText(/Barbell Back Squat/);
		expect(screen.queryByText(/0 sets · 0 exercises/)).toBeNull();
	});
});

it("starts empty and offers to delete a session with nothing in it", async () => {
	currentSession = { ...emptySession, userId: mockSubject };
	await mount();
	expect(await screen.findByTestId("session-add-exercise")).toBeTruthy();
	await fireEvent.press(await screen.findByRole("button", { name: "Finish" }));
	await fireEvent.press(
		await screen.findByRole("button", { name: "Delete session" }),
	);
	expect(cancel).toHaveBeenCalled();
});

describe("a set's note (APP-690)", () => {
	const note = () => screen.findByTestId("session-editor-note");
	const save = async () =>
		fireEvent.press(await screen.findByRole("button", { name: /^Save/ }));
	const openLogged = async (notes?: string) => {
		loggedSets = [
			{ ...serverSet("set-1", 8, 1), ...(notes ? { notes } : {}) },
		] as typeof loggedSets;
		update.mockResolvedValue(undefined);
		await mount();
		await fireEvent.press((await screen.findAllByLabelText(/set 1, /))[0]);
	};

	it("survives a restart on an open set and is logged trimmed", async () => {
		writeLocal(PREFERENCE_KEYS.setEditorMode, "advanced");
		const app = await mount();
		await fireEvent.press(await firstRow());
		await fireEvent.changeText(await note(), "narrow grip ");
		await act(() => router.back());
		await app.unmount();
		await mount();
		await fireEvent.press(await firstCheck());
		expect(add).toHaveBeenCalledWith(
			expect.objectContaining({ notes: "narrow grip" }),
		);
	});

	it("is kept for the retry after a lost connection", async () => {
		writeLocal(PREFERENCE_KEYS.setEditorMode, "advanced");
		receipt = undefined;
		add.mockRejectedValueOnce(new Error("Connection lost"));
		await mount();
		await fireEvent.press(await firstRow());
		await fireEvent.changeText(await note(), "narrow grip");
		await fireEvent.press(screen.getByTestId("session-editor-primary"));
		await fireEvent.press(await screen.findByTestId("session-toast-action"));
		await waitFor(() => expect(add).toHaveBeenCalledTimes(2));
		expect(add.mock.calls[1][0]).toEqual(add.mock.calls[0][0]);
		expect(add.mock.calls[1][0]).toMatchObject({ notes: "narrow grip" });
	});

	it("is hidden in the simple view without a note", async () => {
		await openLogged();
		await screen.findByTestId("session-editor-reps");
		expect(screen.queryByTestId("session-editor-note")).toBeNull();
	});

	it("shows on the logged row and in the simple view, and is cleared with an empty string", async () => {
		await openLogged("narrow grip");
		expect(
			screen.getAllByLabelText(/note: narrow grip/, {
				includeHiddenElements: true,
			}).length,
		).toBeGreaterThan(0);
		expect(await screen.findByDisplayValue("narrow grip")).toBeTruthy();
		await fireEvent.changeText(await note(), "");
		await save();
		expect(update).toHaveBeenCalledWith(
			expect.objectContaining({ id: "set-1", notes: "" }),
		);
	});

	it("is left out of a correction that doesn't touch it", async () => {
		await openLogged("narrow grip");
		await fireEvent.changeText(
			await screen.findByTestId("session-editor-reps"),
			"7",
		);
		await save();
		expect(update).toHaveBeenCalledTimes(1);
		expect(update.mock.calls[0][0]).not.toHaveProperty("notes");
	});

	it("is not wiped by a draft stored before notes existed", async () => {
		loggedSets = [
			{ ...serverSet("set-1", 8, 1), notes: "narrow grip" },
		] as typeof loggedSets;
		update.mockResolvedValue(undefined);
		await mount();
		const row = allRows(workspaceStore.plan(planKey()) as SessionPlan).find(
			(item) => item.setId === "set-1",
		) as PlanSet;
		const { notes: _none, ...old } = row;
		await act(async () =>
			workspaceStore.setDraft(planKey(), row.id, { ...old, reps: 7 }),
		);
		await fireEvent.press((await screen.findAllByLabelText(/set 1, /))[0]);
		expect(await screen.findByDisplayValue("narrow grip")).toBeTruthy();
		await save();
		expect(update.mock.calls[0][0]).not.toHaveProperty("notes");
	});
});

describe("Live Activity", () => {
	type Activity = { props: Record<string, unknown>; ended: boolean };
	const fake = (
		jest.requireMock("expo-widgets") as {
			__liveActivities: { activities: Activity[] };
		}
	).__liveActivities;
	const running = () => fake.activities.filter((item) => !item.ended);
	beforeEach(() => {
		fake.activities.length = 0;
	});

	it("shows the session, follows a logged set into rest, and ends once the session is saved", async () => {
		await mount();
		await waitFor(() => expect(running()).toHaveLength(1));
		expect(running()[0]?.props).toMatchObject({
			title: "Lower A",
			exercise: "Barbell Back Squat",
			setLine: expect.stringMatching(/^Set 1 of /),
			loadLine: "60 kg × 8",
			restEndsAt: null,
		});
		await fireEvent.press(await firstCheck());
		await waitFor(() =>
			expect(running()[0]?.props).toMatchObject({
				setLine: expect.stringMatching(/^Set 2 of /),
				restEndsAt: expect.any(Number),
			}),
		);
		expect(running()).toHaveLength(1);

		await fireEvent.press(
			await screen.findByRole("button", { name: "Finish" }),
		);
		await fireEvent.press(
			await screen.findByRole("button", { name: /Finish · 1 set/ }),
		);
		// The recap can still go back to the session, so the activity stays.
		expect(await screen.findByText("Lower A done")).toBeTruthy();
		expect(running()).toHaveLength(1);
		finish.mockImplementation(async () => {
			currentSession = null as never;
		});
		await fireEvent.press(await screen.findByTestId("session-recap-confirm"));
		await waitFor(() => expect(running()).toHaveLength(0));
	});

	it("ends when the account signs out mid-session", async () => {
		await mount();
		await waitFor(() => expect(running()).toHaveLength(1));
		screen.unmount();
		await waitFor(() => expect(running()).toHaveLength(0));
	});
});
