import { convertLoad } from "@foundry/core";
import * as Sentry from "@sentry/react-native";
import { renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { DICTIONARIES } from "../../../i18n/dictionaries";
import {
	type ExerciseFacts,
	seedPlan,
	switchUnit,
	withTypedLoad,
} from "../session-plan";
import { endSessionActivity, showSessionActivity } from "./live-activity.ios";
import {
	contentKey,
	type LiveActivityProps,
	liveActivityProps,
} from "./live-activity-props";
import {
	useEndActivityWhenSignedOut,
	useRetryFailedActivityEnd,
} from "./session-live-activity";
import { nextSetOf, type SessionNow } from "./use-session-now";

type FakeState = {
	activities: {
		id: string;
		props: LiveActivityProps;
		ended: boolean;
		staleDate?: Date;
	}[];
	enabled: boolean;
	endGate: Promise<void> | null;
	endError: Error | null;
	updateGate: Promise<void> | null;
};
const fake = (
	jest.requireMock("expo-widgets") as { __liveActivities: FakeState }
).__liveActivities;
const live = () => fake.activities.filter((item) => !item.ended);
const flush = () => new Promise((resolve) => setImmediate(resolve));

const en = {
	...DICTIONARIES.en.strength.plan.liveActivity,
	freeSession: DICTIONARIES.en.strength.freeSession,
};
const nl = {
	...DICTIONARIES.nl.strength.plan.liveActivity,
	freeSession: DICTIONARIES.nl.strength.freeSession,
};
const T0 = 1_700_000_000_000;
const lifting: SessionNow = {
	sessionName: "Push day",
	exerciseName: "Bench press",
	setIndex: 3,
	setCount: 4,
	kg: 80,
	reps: 8,
	durationSeconds: null,
	restEndsAt: null,
	startedAt: T0 - 600_000,
};

describe("Live Activity props", () => {
	it("reads a lifting set as exercise, set n of m and load × reps", () => {
		const props = liveActivityProps(lifting, en, "en", false, T0);
		expect(props).toMatchObject({
			title: "Push day",
			exercise: "Bench press",
			setLine: "Set 3 of 4",
			loadLine: "80 kg × 8",
			restEndsAt: null,
			startedAt: T0 - 600_000,
		});
	});

	it("keeps the rest end while resting and drops it once the rest is over", () => {
		const resting = { ...lifting, restEndsAt: T0 + 90_000 };
		expect(liveActivityProps(resting, en, "en", false, T0).restEndsAt).toBe(
			T0 + 90_000,
		);
		expect(
			liveActivityProps(resting, en, "en", false, T0 + 90_001),
		).toMatchObject({ restEndsAt: null, restOver: true });
		// Once the app has seen it run out, it says so until the next set.
		expect(liveActivityProps(lifting, en, "en", true, T0).restOver).toBe(true);
		expect(liveActivityProps(lifting, en, "en", false, T0).restOver).toBe(
			false,
		);
	});

	it("shows seconds for a hold, reps on bodyweight, and Dutch copy", () => {
		const hold = { ...lifting, kg: 0, reps: null, durationSeconds: 45 };
		expect(liveActivityProps(hold, en, "en", false, T0).loadLine).toBe("45 s");
		expect(
			liveActivityProps({ ...hold, kg: 10 }, en, "en", false, T0).loadLine,
		).toBe("10 kg × 45 s");
		const pullup = { ...lifting, kg: 0, reps: 8 };
		expect(liveActivityProps(pullup, nl, "nl", false, T0)).toMatchObject({
			loadLine: "8 herhalingen",
			setLine: "Set 3 van 4",
		});
		expect(
			liveActivityProps({ ...lifting, kg: 82.5 }, nl, "nl", false, T0).loadLine,
		).toBe("82,5 kg × 8");
	});

	it("shows pounds for a set in lb, as the session screen does", () => {
		const lb = { ...lifting, kg: 101.6, unit: "lbs" as const, typedLbs: 224 };
		expect(liveActivityProps(lb, en, "en", false, T0).loadLine).toBe(
			"224 lbs × 8",
		);
		// Without a typed value the pounds are rounded to a tenth, as on screen.
		expect(
			liveActivityProps(
				{ ...lifting, kg: 95, unit: "lbs" },
				nl,
				"nl",
				false,
				T0,
			).loadLine,
		).toBe("209,4 lbs × 8");
		expect(
			liveActivityProps(
				{ ...lifting, kg: 20, unit: "lbs", reps: null, durationSeconds: 45 },
				en,
				"en",
				false,
				T0,
			).loadLine,
		).toBe("44.1 lbs × 45 s");
	});

	it("keeps kg for a set in kg or without a unit", () => {
		expect(
			liveActivityProps({ ...lifting, unit: "kg" }, en, "en", false, T0)
				.loadLine,
		).toBe("80 kg × 8");
		expect(liveActivityProps(lifting, en, "en", false, T0).loadLine).toBe(
			"80 kg × 8",
		);
	});

	it("falls back to the session alone when no set is open", () => {
		const free = {
			...lifting,
			sessionName: null,
			exerciseName: null,
			setIndex: null,
			setCount: null,
			kg: null,
			reps: null,
		};
		expect(liveActivityProps(free, en, "en", false, T0)).toMatchObject({
			title: "Free session",
			exercise: null,
			setLine: null,
			loadLine: null,
		});
	});
});

describe("nextSetOf", () => {
	const facts = (): ExerciseFacts => ({
		exercise: { equipment: "barbell" },
		bodyweight: false,
		timed: false,
		stepKg: 2.5,
		measured: null,
		estimated: null,
		savedManual: null,
		measuredDate: null,
		last: null,
	});
	it("finds the first open set and its place in the exercise", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "squat",
					plannedSets: [
						{ reps: 5, weight: 100, unit: "kg" },
						{ reps: 5, weight: 100, unit: "kg" },
					],
				},
			],
			[
				{
					_id: "s1",
					exerciseId: "squat",
					setNumber: 1,
					weight: 100,
					unit: "kg",
					reps: 5,
				} as never,
			],
			facts,
		);
		expect(nextSetOf(plan, false)).toEqual({
			exerciseId: "squat",
			setIndex: 2,
			setCount: 2,
			kg: 100,
			unit: "kg",
			reps: 5,
			durationSeconds: null,
		});
	});
	it("carries a pound set's unit and typed load", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "squat",
					plannedSets: [{ reps: 5, weight: 100, unit: "kg" }],
				},
			],
			[],
			facts,
		);
		// The set editor's unit switch makes a set read in pounds.
		plan.sets.squat = (plan.sets.squat ?? []).map((row) =>
			withTypedLoad(switchUnit(row, "lbs", facts()), 225),
		);
		expect(nextSetOf(plan, false)).toMatchObject({
			unit: "lbs",
			typedLbs: 225,
			kg: convertLoad(225, "lbs", "kg"),
		});
	});
	it("counts working sets only, as the rest notification does", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "squat",
					plannedSets: [
						{ reps: 5, weight: 40, unit: "kg" },
						{ reps: 5, weight: 100, unit: "kg" },
						{ reps: 5, weight: 100, unit: "kg" },
					],
				},
			],
			[],
			facts,
		);
		const [warmup, ...working] = plan.sets.squat ?? [];
		if (!warmup) throw new Error("no rows");
		plan.sets.squat = [{ ...warmup, kind: "warmup" }, ...working];
		expect(nextSetOf(plan, false)).toMatchObject({
			setIndex: null,
			setCount: null,
		});
		plan.sets.squat = [{ ...warmup, kind: "warmup", done: true }, ...working];
		expect(nextSetOf(plan, false)).toMatchObject({ setIndex: 1, setCount: 2 });
	});
	it("offers one more set like the last once a free exercise is done", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "squat",
					plannedSets: [{ reps: 5, weight: 100, unit: "kg" }],
				},
			],
			[],
			facts,
		);
		plan.sets.squat = (plan.sets.squat ?? []).map((row) => ({
			...row,
			plan: undefined,
			done: true,
		}));
		expect(nextSetOf(plan, false)).toEqual({
			exerciseId: "squat",
			setIndex: 2,
			setCount: 2,
			kg: 100,
			unit: "kg",
			reps: 5,
			durationSeconds: null,
		});
	});
	it("reads a timed hold's reps as seconds", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "personal-hold",
					plannedSets: [{ reps: 60, weight: 0, unit: "kg" }],
				},
			],
			[],
			facts,
		);
		expect(nextSetOf(plan, true)).toMatchObject({
			reps: null,
			durationSeconds: 60,
		});
		expect(nextSetOf(null, false)).toBeNull();
	});
});

describe("session Live Activity", () => {
	beforeEach(() => {
		endSessionActivity();
		fake.activities.length = 0;
		fake.enabled = true;
		fake.endGate = null;
		fake.endError = null;
		fake.updateGate = null;
		jest.mocked(Sentry.captureException).mockClear();
	});
	const props = (over: Partial<SessionNow> = {}) =>
		liveActivityProps({ ...lifting, ...over }, en, "en", false, T0);

	it("starts one activity, updates it, and ends it", async () => {
		showSessionActivity(props());
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		expect(live()).toHaveLength(1);
		expect(live()[0]?.props.setLine).toBe("Set 4 of 4");
		endSessionActivity();
		await flush();
		expect(live()).toHaveLength(0);
	});

	it("passes the rest end as the stale date, so the layout can say rest over", async () => {
		showSessionActivity(props({ restEndsAt: T0 + 60_000 }));
		await flush();
		expect(live()[0]?.staleDate).toEqual(new Date(T0 + 60_000));
	});

	it("replaces activities it did not start for this session", async () => {
		fake.activities.push(
			{ id: "old-1", props: props(), ended: false },
			{ id: "old-2", props: props(), ended: false },
		);
		showSessionActivity(props({ exerciseName: "Squat" }));
		await flush();
		expect(live()).toHaveLength(1);
		expect(live()[0]?.id).not.toMatch(/^old-/);
		expect(live()[0]?.props.exercise).toBe("Squat");
	});

	it("gives a session that directly follows another its own activity", async () => {
		showSessionActivity(props());
		await flush();
		const [first] = live();
		showSessionActivity(props({ sessionName: "Leg day", startedAt: T0 + 1 }));
		await flush();
		expect(first?.ended).toBe(true);
		expect(live()).toHaveLength(1);
		expect(live()[0]?.props.title).toBe("Leg day");
	});

	it("clears the stale date once the rest is over", async () => {
		showSessionActivity(props({ restEndsAt: T0 + 60_000 }));
		await flush();
		expect(live()[0]?.staleDate).toEqual(new Date(T0 + 60_000));
		showSessionActivity(
			liveActivityProps({ ...lifting, restEndsAt: null }, en, "en", true, T0),
		);
		await flush();
		expect(live()[0]?.staleDate).toBeUndefined();
		expect(live()[0]?.props.restOver).toBe(true);
	});

	it("ends a surviving activity once Clerk loads with nobody signed in", async () => {
		showSessionActivity(props());
		await flush();
		const hook = await renderHook(
			({ loaded, user }: { loaded: boolean; user: string | null }) =>
				useEndActivityWhenSignedOut(loaded, user),
			{ initialProps: { loaded: false, user: null } },
		);
		await flush();
		expect(live()).toHaveLength(1);
		await hook.rerender({ loaded: true, user: "user_1" });
		await flush();
		expect(live()).toHaveLength(1);
		await hook.rerender({ loaded: true, user: null });
		await flush();
		expect(live()).toHaveLength(0);
	});

	/** Mounts the root's retry; returns what coming to the foreground calls. */
	async function mountRetry() {
		await renderHook(() => useRetryFailedActivityEnd());
		const onChange = jest
			.mocked(AppState.addEventListener)
			.mock.calls.at(-1)?.[1];
		if (!onChange) throw new Error("no AppState listener");
		return (state: "active" | "background") => onChange(state);
	}

	it("retries a failed end on every foreground until it succeeds, signed out too", async () => {
		const change = await mountRetry();
		showSessionActivity(props());
		await flush();
		fake.endError = new Error("ActivityKit failed");
		await renderHook(() => useEndActivityWhenSignedOut(true, null));
		await flush();
		expect(live()).toHaveLength(1);
		expect(Sentry.captureException).toHaveBeenCalledTimes(1);
		change("active");
		await flush();
		expect(live()).toHaveLength(1);
		fake.endError = null;
		change("background");
		await flush();
		expect(live()).toHaveLength(1);
		change("active");
		await flush();
		expect(live()).toHaveLength(0);
	});

	it("leaves the next session's activity alone after a failed end", async () => {
		const change = await mountRetry();
		showSessionActivity(props());
		await flush();
		fake.endError = new Error("ActivityKit failed");
		endSessionActivity();
		await flush();
		fake.endError = null;
		showSessionActivity(props({ sessionName: "Leg day", startedAt: T0 + 1 }));
		await flush();
		change("active");
		await flush();
		expect(live().map((item) => item.props.title)).toEqual(["Leg day"]);
	});

	it("updates its own activity in place", async () => {
		showSessionActivity(props());
		await flush();
		const [first] = live();
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		expect(live()).toEqual([first]);
		expect(first?.props.setLine).toBe("Set 4 of 4");
	});

	it("reports a failed setup once, then leaves Live Activities alone", async () => {
		// A fresh driver (and its mocks) whose factory has not been created yet.
		let driver: typeof import("./live-activity.ios") | undefined;
		let widgets: { createLiveActivity: jest.Mock } | undefined;
		let sentry: { captureException: jest.Mock } | undefined;
		jest.isolateModules(() => {
			widgets = jest.requireMock("expo-widgets");
			sentry = jest.requireMock("@sentry/react-native");
			widgets?.createLiveActivity.mockClear();
			widgets?.createLiveActivity.mockImplementationOnce(() => {
				throw new Error("no app group");
			});
			driver = require("./live-activity.ios");
		});
		sentry?.captureException.mockClear();
		driver?.showSessionActivity(props());
		await flush();
		driver?.showSessionActivity(props({ setIndex: 4 }));
		await flush();
		expect(widgets?.createLiveActivity).toHaveBeenCalledTimes(1);
		expect(sentry?.captureException).toHaveBeenCalledTimes(1);
	});

	/** A relaunch: a fresh driver over the activities and store left by the last run. */
	function relaunch(left: {
		activities: FakeState["activities"];
		owner?: { activityId: string; startedAt: number } | string;
	}) {
		let driver: typeof import("./live-activity.ios") | undefined;
		let state: FakeState | undefined;
		jest.isolateModules(() => {
			state = (
				jest.requireMock("expo-widgets") as { __liveActivities: FakeState }
			).__liveActivities;
			state.activities.push(...left.activities);
			if (left.owner !== undefined) {
				const store = jest.requireMock("expo-sqlite/kv-store") as {
					default: { setItemSync: (key: string, value: string) => void };
				};
				store.default.setItemSync(
					"workouts:live-activity",
					typeof left.owner === "string"
						? left.owner
						: JSON.stringify(left.owner),
				);
			}
			driver = require("./live-activity.ios");
		});
		if (!driver || !state) throw new Error("no driver");
		return {
			driver,
			live: () => state?.activities.filter((item) => !item.ended) ?? [],
		};
	}

	it("keeps the running activity across a relaunch during the same session", async () => {
		const running = { id: "la-kept", props: props(), ended: false };
		const app = relaunch({
			activities: [running],
			owner: { activityId: "la-kept", startedAt: lifting.startedAt },
		});
		app.driver.showSessionActivity(props({ setIndex: 4 }));
		await flush();
		expect(running.ended).toBe(false);
		expect(app.live()).toEqual([running]);
		expect(running.props.setLine).toBe("Set 4 of 4");
	});

	it("still replaces a leftover from another session after a relaunch", async () => {
		const leftover = { id: "la-other", props: props(), ended: false };
		const app = relaunch({
			activities: [leftover],
			owner: { activityId: "la-other", startedAt: lifting.startedAt - 1 },
		});
		app.driver.showSessionActivity(props());
		await flush();
		expect(leftover.ended).toBe(true);
		expect(app.live()).toHaveLength(1);
		expect(app.live()[0]?.id).not.toBe("la-other");
	});

	it("replaces the leftover when the kept owner is unreadable", async () => {
		const leftover = { id: "la-kept", props: props(), ended: false };
		const app = relaunch({ activities: [leftover], owner: "{not json" });
		app.driver.showSessionActivity(props());
		await flush();
		expect(leftover.ended).toBe(true);
		expect(app.live()).toHaveLength(1);
	});

	it("ends another session's leftover during a background launch, and keeps its own", async () => {
		const setState = (value: string) =>
			Object.defineProperty(AppState, "currentState", {
				value,
				configurable: true,
				writable: true,
			});
		try {
			setState("background");
			const leftover = { id: "la-other", props: props(), ended: false };
			const other = relaunch({
				activities: [leftover],
				owner: { activityId: "la-other", startedAt: lifting.startedAt - 1 },
			});
			other.driver.showSessionActivity(props());
			await flush();
			expect(leftover.ended).toBe(true);
			expect(other.live()).toHaveLength(0);

			const running = { id: "la-kept", props: props(), ended: false };
			const own = relaunch({
				activities: [running],
				owner: { activityId: "la-kept", startedAt: lifting.startedAt },
			});
			own.driver.showSessionActivity(props({ setIndex: 4 }));
			await flush();
			expect(own.live()).toEqual([running]);
			expect(running.props.setLine).toBe("Set 4 of 4");
		} finally {
			setState("active");
		}
	});

	it("forgets the owner once the session's activity ends", async () => {
		showSessionActivity(props());
		await flush();
		const [first] = live();
		endSessionActivity();
		await flush();
		const app = relaunch({
			activities: first ? [{ ...first, ended: false }] : [],
		});
		app.driver.showSessionActivity(props());
		await flush();
		expect(app.live().map((item) => item.id)).not.toContain(first?.id);
	});

	it("does nothing when Live Activities are turned off", async () => {
		fake.enabled = false;
		expect(() => showSessionActivity(props())).not.toThrow();
		await flush();
		expect(live()).toHaveLength(0);
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it("finishes an end before the next session's activity starts", async () => {
		showSessionActivity(props());
		await flush();
		let release: () => void = () => undefined;
		fake.endGate = new Promise((resolve) => {
			release = resolve;
		});
		endSessionActivity();
		showSessionActivity(props({ exerciseName: "Squat" }));
		await flush();
		expect(live()).toHaveLength(1);
		expect(live()[0]?.props.exercise).toBe("Bench press");
		release();
		await flush();
		expect(live()).toHaveLength(1);
		expect(live()[0]?.props.exercise).toBe("Squat");
		fake.endGate = null;
	});

	/** The user swipes the activity away: iOS ends it and stops listing it. */
	const dismiss = () => {
		for (const item of live()) item.ended = true;
	};

	it("stays dismissed for the rest of the session, without reporting it", async () => {
		showSessionActivity(props());
		await flush();
		dismiss();
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		showSessionActivity(props({ setIndex: 4, restEndsAt: T0 + 60_000 }));
		await flush();
		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(live()).toHaveLength(0);
		expect(fake.activities).toHaveLength(1);
	});

	it("stays dismissed when the dismissal lands during an update", async () => {
		showSessionActivity(props());
		await flush();
		let release: () => void = () => undefined;
		fake.updateGate = new Promise((resolve) => {
			release = resolve;
		});
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		dismiss();
		release();
		await flush();
		fake.updateGate = null;
		showSessionActivity(props({ setIndex: 2 }));
		await flush();
		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(live()).toHaveLength(0);
	});

	it("starts a new activity for the next session after a dismissal", async () => {
		showSessionActivity(props());
		await flush();
		dismiss();
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		endSessionActivity();
		showSessionActivity(props({ sessionName: "Leg day", startedAt: T0 + 1 }));
		await flush();
		expect(live()).toHaveLength(1);
		expect(live()[0]?.props.title).toBe("Leg day");
	});

	it("starts a new activity for a session that directly follows a dismissed one", async () => {
		showSessionActivity(props());
		await flush();
		dismiss();
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		showSessionActivity(props({ sessionName: "Leg day", startedAt: T0 + 1 }));
		await flush();
		expect(live()).toHaveLength(1);
		expect(live()[0]?.props.title).toBe("Leg day");
	});

	it("stays dismissed across a relaunch during the same session", async () => {
		showSessionActivity(props());
		await flush();
		dismiss();
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		// The owner kept on the phone survives; the dismissed activity does not.
		const store = jest.requireMock("expo-sqlite/kv-store") as {
			default: { getItemSync: (key: string) => string | null };
		};
		const kept = store.default.getItemSync("workouts:live-activity");
		expect(kept).not.toBeNull();
		const app = relaunch({ activities: [], owner: kept ?? undefined });
		app.driver.showSessionActivity(props({ setIndex: 4 }));
		await flush();
		expect(app.live()).toHaveLength(0);
		// A relaunch into the next session starts one again.
		app.driver.showSessionActivity(props({ startedAt: T0 + 1 }));
		await flush();
		expect(app.live()).toHaveLength(1);
	});

	it("notices a dismissal that happened while the app was closed", async () => {
		const app = relaunch({
			activities: [],
			owner: { activityId: "la-kept", startedAt: lifting.startedAt },
		});
		app.driver.showSessionActivity(props());
		await flush();
		app.driver.showSessionActivity(props({ setIndex: 4 }));
		await flush();
		expect(app.live()).toHaveLength(0);
	});

	it("starts only while the app is active, and retries once it is", async () => {
		const setState = (value: string | null) =>
			Object.defineProperty(AppState, "currentState", {
				value,
				configurable: true,
				writable: true,
			});
		try {
			for (const state of ["background", "inactive", "unknown", null]) {
				setState(state);
				showSessionActivity(props());
				await flush();
				expect(live()).toHaveLength(0);
			}
			setState("active");
			showSessionActivity(props());
			await flush();
			expect(live()).toHaveLength(1);
		} finally {
			setState("active");
		}
	});

	it("keeps an end asked for while an update is still running", async () => {
		showSessionActivity(props());
		await flush();
		const [first] = live();
		let release: () => void = () => undefined;
		fake.updateGate = new Promise<void>((resolve) => {
			release = resolve;
		});
		showSessionActivity(props({ setIndex: 2 }));
		await flush();
		endSessionActivity();
		showSessionActivity(props({ exerciseName: "Squat" }));
		release();
		await flush();
		fake.updateGate = null;
		expect(first?.ended).toBe(true);
		expect(live()).toHaveLength(1);
		expect(live()[0]?.id).not.toBe(first?.id);
		expect(live()[0]?.props.exercise).toBe("Squat");
	});

	it("applies quick changes in order", async () => {
		showSessionActivity(props());
		await flush();
		showSessionActivity(props({ setIndex: 2 }));
		showSessionActivity(props({ setIndex: 3 }));
		await flush();
		expect(live()[0]?.props.setLine).toBe("Set 3 of 4");
	});

	it("ignores the send time when deciding whether anything changed", () => {
		const a = liveActivityProps(lifting, en, "en", false, T0);
		const b = liveActivityProps(lifting, en, "en", false, T0 + 5_000);
		expect(contentKey(a)).toBe(contentKey(b));
	});
});
