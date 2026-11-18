import * as Sentry from "@sentry/react-native";
import { AppState } from "react-native";
import { DICTIONARIES } from "../../../i18n/dictionaries";
import { type ExerciseFacts, seedPlan } from "../session-plan";
import { endSessionActivity, showSessionActivity } from "./live-activity.ios";
import {
	contentKey,
	type LiveActivityProps,
	liveActivityProps,
} from "./live-activity-props";
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
		expect(nextSetOf(plan)).toEqual({
			exerciseId: "squat",
			setIndex: 2,
			setCount: 2,
			kg: 100,
			reps: 5,
			durationSeconds: null,
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
		expect(nextSetOf(plan)).toMatchObject({ setIndex: null, setCount: null });
		plan.sets.squat = [{ ...warmup, kind: "warmup", done: true }, ...working];
		expect(nextSetOf(plan)).toMatchObject({ setIndex: 1, setCount: 2 });
	});
	it("reads a timed hold's reps as seconds", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "shipped:exercise:plank",
					plannedSets: [{ reps: 60, weight: 0, unit: "kg" }],
				},
			],
			[],
			facts,
		);
		expect(nextSetOf(plan)).toMatchObject({ reps: null, durationSeconds: 60 });
		expect(nextSetOf(null)).toBeNull();
	});
});

describe("session Live Activity", () => {
	beforeEach(() => {
		endSessionActivity();
		fake.activities.length = 0;
		fake.enabled = true;
		fake.endGate = null;
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

	it("adopts a running activity after a restart and ends extras", async () => {
		fake.activities.push(
			{ id: "old-1", props: props(), ended: false },
			{ id: "old-2", props: props(), ended: false },
		);
		showSessionActivity(props({ exerciseName: "Squat" }));
		await flush();
		expect(live().map((item) => item.id)).toEqual(["old-1"]);
		expect(live()[0]?.props.exercise).toBe("Squat");
	});

	it("does nothing when Live Activities are turned off", () => {
		fake.enabled = false;
		expect(() => showSessionActivity(props())).not.toThrow();
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

	it("treats a dismissed activity as gone, without reporting it", async () => {
		showSessionActivity(props());
		await flush();
		const [activity] = live();
		if (activity) activity.ended = true;
		showSessionActivity(props({ setIndex: 4 }));
		await flush();
		expect(Sentry.captureException).not.toHaveBeenCalled();
		expect(live()).toHaveLength(1);
	});

	it("starts only in the foreground, and retries once active", async () => {
		// The jest mock has a function here; the native AppState has a string.
		const original = Object.getOwnPropertyDescriptor(AppState, "currentState");
		const setState = (value: string) =>
			Object.defineProperty(AppState, "currentState", {
				value,
				configurable: true,
			});
		try {
			setState("background");
			showSessionActivity(props());
			await flush();
			expect(live()).toHaveLength(0);
			setState("active");
			showSessionActivity(props());
			await flush();
			expect(live()).toHaveLength(1);
		} finally {
			if (original) Object.defineProperty(AppState, "currentState", original);
		}
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
