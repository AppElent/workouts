import { convertLoad } from "@foundry/core";
import {
	addExerciseToPlan,
	addSet,
	addSetTemplate,
	addToGroup,
	addWarmup,
	allRows,
	amrapScore,
	applyPercent,
	beginAttempt,
	canSwap,
	clearManual,
	closeGroup,
	closeOpenClocks,
	confirmKey,
	dissolveGroup,
	type ExerciseFacts,
	failedRows,
	fillFromLast,
	findRow,
	type GroupRound,
	groupOfExercise,
	groupWith,
	isValidRow,
	manualIsOdd,
	markFailed,
	markLogged,
	moveEntry,
	nextSetNumber,
	type PlanSet,
	payloadFor,
	recapOf,
	reconcilePlan,
	referenceFor,
	removeExercise,
	removeRow,
	repeatRow,
	resetToPlan,
	restAfterLog,
	restoreRows,
	rowOneRepMax,
	rowsOf,
	type SessionPlan,
	seedPlan,
	sessionExercises,
	setGroupMode,
	setGroupRounds,
	setManual,
	shownLoad,
	shownPercent,
	startClock,
	stepLoad,
	stopClock,
	swapExercise,
	switchUnit,
	takeOutOfGroup,
	targetPercent,
	tickClocks,
	typoCheck,
	updateRow,
	withTypedLoad,
} from "./session-plan";

const facts = (over: Partial<ExerciseFacts> = {}): ExerciseFacts => ({
	bodyweight: false,
	stepKg: 2.5,
	measured: null,
	estimated: null,
	savedManual: null,
	measuredDate: null,
	last: null,
	...over,
});
const SQUAT = facts({ measured: 120, estimated: 126, measuredDate: 100 });
const CURL = facts({ measured: 60, stepKg: 1 });
const PLAIN = facts();
const PULLUP = facts({ bodyweight: true });
const TABLE: Record<string, ExerciseFacts> = {
	squat: SQUAT,
	curl: CURL,
	plain: PLAIN,
	pullup: PULLUP,
	press: facts({ measured: 80, last: { kg: 50, reps: 8 } }),
	row: facts({ last: { kg: 40, reps: 10 } }),
};
const lookup = (id: string) => TABLE[id] ?? PLAIN;

function plannedPlan(
	sets: Record<string, { reps: number; weight: number }[]> = {
		squat: [
			{ reps: 5, weight: 95 },
			{ reps: 5, weight: 95 },
			{ reps: 5, weight: 95 },
		],
	},
) {
	return seedPlan(
		Object.entries(sets).map(([exerciseId, planned]) => ({
			exerciseId,
			plannedSets: planned.map((item) => ({ ...item, unit: "kg" as const })),
		})),
		[],
		lookup,
	);
}
const firstOpen = (plan: SessionPlan, id = "squat") =>
	rowsOf(plan, id).find((row) => !row.done) as PlanSet;
function log(plan: SessionPlan, row: PlanSet, serverId = `s-${row.id}`) {
	const attempt = beginAttempt(plan, row.id, `op-${row.id}`) as PlanSet;
	const sent = updateRow(plan, row.id, attempt);
	return markLogged(
		sent,
		row.id,
		serverId,
		attempt.attempt?.setNumber as number,
		lookup(row.exerciseId),
	).plan;
}

describe("1RM", () => {
	it("uses Epley, and a single is its weight", () => {
		expect(
			rowOneRepMax({ kg: 100, reps: 1, kind: "working" }, false)?.value,
		).toBe(100);
		expect(
			rowOneRepMax({ kg: 95, reps: 5, kind: "working" }, false)?.value,
		).toBe(110.8);
	});
	it("never counts a warm-up or failed reps", () => {
		expect(
			rowOneRepMax({ kg: 100, reps: 1, kind: "warmup" }, false),
		).toBeNull();
		expect(
			rowOneRepMax({ kg: 100, reps: 0, kind: "working" }, false),
		).toBeNull();
		expect(
			rowOneRepMax({ kg: 100, reps: 3, kind: "working" }, true),
		).toBeNull();
	});
	it("takes percentages from Measured, not Estimated", () => {
		const plan = plannedPlan();
		expect(referenceFor(plan, SQUAT, "squat")).toEqual({
			value: 120,
			source: "measured",
		});
		expect(referenceFor(plan, facts({ estimated: 100 }), "x")).toBeNull();
	});
	it("lets manual override, and undo and correction apply", () => {
		let plan = plannedPlan();
		plan = setManual(plan, "squat", 130, SQUAT).plan;
		expect(referenceFor(plan, SQUAT, "squat")?.source).toBe("manual");
		plan = setManual(plan, "squat", 135, SQUAT).plan;
		expect(referenceFor(plan, SQUAT, "squat")?.value).toBe(135);
		plan = clearManual(plan, "squat", SQUAT).plan;
		expect(referenceFor(plan, SQUAT, "squat")).toEqual({
			value: 120,
			source: "measured",
		});
	});
	it("prefers a saved manual only while newer than Measured, until cleared", () => {
		const saved = facts({
			measured: 120,
			measuredDate: 100,
			savedManual: { value: 130, date: 200 },
		});
		const plan = plannedPlan();
		expect(referenceFor(plan, saved, "squat")?.value).toBe(130);
		expect(
			referenceFor(
				plan,
				{ ...saved, savedManual: { value: 130, date: 50 } },
				"squat",
			)?.value,
		).toBe(120);
		expect(
			referenceFor(clearManual(plan, "squat", saved).plan, saved, "squat")
				?.value,
		).toBe(120);
	});
});

describe("plan weight", () => {
	it("reprices only open sets still at plan weight", () => {
		let plan = plannedPlan();
		const [one, two, three] = rowsOf(plan, "squat") as [
			PlanSet,
			PlanSet,
			PlanSet,
		];
		plan = log(plan, one);
		plan = updateRow(plan, two.id, withTypedLoad(two, 100));
		plan = setManual(plan, "squat", 130, SQUAT).plan;
		expect(findRow(plan, one.id)?.kg).toBe(95);
		expect(findRow(plan, two.id)?.kg).toBe(100);
		expect(findRow(plan, three.id)?.kg).toBe(102.5);
	});
	it("still reprices after a reps-only edit", () => {
		let plan = plannedPlan();
		const row = firstOpen(plan);
		plan = updateRow(plan, row.id, { ...row, reps: 8 });
		plan = setManual(plan, "squat", 130, SQUAT).plan;
		expect(findRow(plan, row.id)).toMatchObject({ kg: 102.5, reps: 8 });
	});
	it("never reprices an edited repeat", () => {
		let plan = plannedPlan();
		const row = firstOpen(plan);
		plan = repeatRow(log(plan, row), row.id).plan;
		const copy = rowsOf(plan, "squat").find(
			(item) => item.free && !item.done,
		) as PlanSet;
		plan = updateRow(plan, copy.id, withTypedLoad(copy, 90));
		plan = setManual(plan, "squat", 130, SQUAT).plan;
		expect(findRow(plan, copy.id)?.kg).toBe(90);
	});
	it("returns to plan from any edit", () => {
		const plan = plannedPlan();
		const row = firstOpen(plan);
		const edited = applyPercent({ ...row, reps: 3 }, 90, { value: 120 }, SQUAT);
		expect(edited).toMatchObject({ kg: 107.5, percent: 90, reps: 3 });
		expect(resetToPlan(edited)).toMatchObject({ kg: 95, reps: 5 });
	});
});

describe("units", () => {
	const row = (): PlanSet => firstOpen(plannedPlan());
	it("never changes the stored load, there and back", () => {
		const start = row();
		const lbs = switchUnit(start, "lbs", SQUAT);
		expect(lbs.kg).toBe(95);
		expect(shownLoad(lbs)).toBe(209.4);
		expect(switchUnit(lbs, "kg", SQUAT).kg).toBe(95);
	});
	it("also holds for logged sets", () => {
		const start = plannedPlan();
		const plan = log(start, firstOpen(start));
		const logged = rowsOf(plan, "squat")[0] as PlanSet;
		expect(logged.done).toBe(true);
		const there = switchUnit(logged, "lbs", SQUAT);
		expect(there.kg).toBe(logged.kg);
		expect(switchUnit(there, "kg", SQUAT).kg).toBe(logged.kg);
	});
	it("keeps typed lbs as typed, even after switching away", () => {
		const typed = withTypedLoad(switchUnit(row(), "lbs", SQUAT), 137);
		expect(shownLoad(typed)).toBe(137);
		expect(payloadFor(typed, 1)).toMatchObject({ weight: 137, unit: "lbs" });
		const away = switchUnit(typed, "kg", SQUAT);
		expect(shownLoad(switchUnit(away, "lbs", SQUAT))).toBe(137);
	});
	it("keeps kg steps exact and lbs steps on 5 lb", () => {
		expect(stepLoad(row(), 1, SQUAT).kg).toBe(97.5);
		const lbs = stepLoad(switchUnit(row(), "lbs", SQUAT), 1, SQUAT);
		expect(shownLoad(lbs)).toBe(215);
	});
	it("references stay kg whatever the set's unit", () => {
		const lbs = switchUnit(row(), "lbs", SQUAT);
		expect(shownPercent(lbs, { value: 120 }, 2.5)).toBe(
			shownPercent(row(), { value: 120 }, 2.5),
		);
	});
	it("carried group weights keep their unit", () => {
		let plan = plannedPlan({
			squat: [
				{ reps: 5, weight: 95 },
				{ reps: 5, weight: 95 },
			],
			curl: [
				{ reps: 12, weight: 40 },
				{ reps: 12, weight: 40 },
			],
		});
		plan = groupWith(plan, "squat", "curl").plan;
		const first = rowsOf(plan, "squat")[0] as PlanSet;
		const typed = withTypedLoad(switchUnit(first, "lbs", SQUAT), 225);
		plan = updateRow(plan, first.id, typed);
		plan = log(plan, typed);
		const later = rowsOf(plan, "squat")[1] as PlanSet;
		expect(later).toMatchObject({ unit: "lbs", typedLbs: 225, carried: true });
		expect(shownLoad(later)).toBe(225);
	});
});

describe("logged percent", () => {
	it("freezes at logging", () => {
		const plan = plannedPlan();
		const row = firstOpen(plan);
		let next = log(plan, row);
		expect(findRow(next, row.id)?.loggedPercent).toBe(79);
		next = setManual(next, "squat", 200, SQUAT).plan;
		const logged = findRow(next, row.id) as PlanSet;
		expect(shownPercent(logged, { value: 200 }, 2.5)).toBe(79);
	});
	it("shows the true percent once a 1RM exists for sets logged before any", () => {
		let plan = seedPlan(
			[
				{
					exerciseId: "plain",
					plannedSets: [{ reps: 5, weight: 50, unit: "kg" }],
				},
			],
			[],
			lookup,
		);
		const row = firstOpen(plan, "plain");
		plan = log(plan, row);
		expect(findRow(plan, row.id)?.loggedPercent).toBeNull();
		plan = setManual(plan, "plain", 100, PLAIN).plan;
		expect(
			shownPercent(findRow(plan, row.id) as PlanSet, { value: 100 }, 2.5),
		).toBe(50);
	});
});

describe("swap", () => {
	const percented = (over: Partial<PlanSet> = {}) => {
		let plan = plannedPlan();
		for (const row of rowsOf(plan, "squat"))
			plan = updateRow(plan, row.id, {
				...applyPercent(row, 80, { value: 120 }, SQUAT),
				...over,
			});
		return plan;
	};
	it("takes the new exercise's percent", () => {
		const plan = swapExercise(
			percented(),
			"squat",
			"press",
			TABLE.press as ExerciseFacts,
		);
		expect(rowsOf(plan.plan, "press")[0]).toMatchObject({
			kg: 65,
			percent: 80,
			reps: 5,
		});
		expect(plan.note?.code).toBe("swapped");
		expect(rowsOf(plan.plan, "squat")).toHaveLength(0);
	});
	it("uses the last result when the set has no percent", () => {
		const plan = swapExercise(
			plannedPlan({ plain: [{ reps: 5, weight: 40 }] }),
			"plain",
			"row",
			TABLE.row as ExerciseFacts,
		);
		expect(rowsOf(plan.plan, "row")[0]).toMatchObject({ kg: 40, reps: 10 });
	});
	it("without a 1RM keeps plan percent and reps, fills last weight, and says so", () => {
		const plan = swapExercise(
			percented(),
			"squat",
			"row",
			TABLE.row as ExerciseFacts,
		);
		expect(rowsOf(plan.plan, "row")[0]).toMatchObject({
			kg: 40,
			percent: 80,
			reps: 5,
		});
		expect(plan.note?.code).toBe("swapLastFilled");
	});
	it("prices a warm-up at half the first work set, or a work set on bodyweight", () => {
		const start = percented();
		const warm = addWarmup(start, "squat", SQUAT).plan;
		const swapped = swapExercise(
			warm,
			"squat",
			"press",
			TABLE.press as ExerciseFacts,
		).plan;
		expect(rowsOf(swapped, "press")[0]).toMatchObject({
			kind: "warmup",
			kg: 32.5,
		});
		const onBody = swapExercise(warm, "squat", "pullup", PULLUP).plan;
		expect(rowsOf(onBody, "pullup")[0]?.kind).toBe("working");
	});
	it("drops lbs on bodyweight and never carries RPE", () => {
		const plan = percented({ unit: "lbs", rpe: 8 });
		const row = rowsOf(
			swapExercise(plan, "squat", "pullup", PULLUP).plan,
			"pullup",
		)[0];
		expect(row).toMatchObject({ unit: "kg", rpe: null });
		const row2 = rowsOf(
			swapExercise(plan, "squat", "press", TABLE.press as ExerciseFacts).plan,
			"press",
		)[0];
		expect(row2?.rpe).toBeNull();
	});
	it("restores the plan exactly on swapping back", () => {
		const start = plannedPlan();
		const before = rowsOf(start, "squat");
		const there = swapExercise(
			start,
			"squat",
			"press",
			TABLE.press as ExerciseFacts,
		).plan;
		const back = swapExercise(there, "press", "squat", SQUAT).plan;
		expect(rowsOf(back, "squat")).toEqual(before);
		expect(sessionExercises(back)).toEqual(["squat"]);
	});
	it("allows swapping onto logged-only, refuses onto open sets", () => {
		let plan = plannedPlan({
			squat: [{ reps: 5, weight: 95 }],
			press: [{ reps: 5, weight: 60 }],
		});
		expect(canSwap(plan, "squat", "press")).toEqual({
			ok: false,
			code: "swapHasOpen",
		});
		expect(
			swapExercise(plan, "squat", "press", TABLE.press as ExerciseFacts)
				.refused,
		).toBe(true);
		plan = log(plan, firstOpen(plan, "press"));
		const swapped = swapExercise(
			plan,
			"squat",
			"press",
			TABLE.press as ExerciseFacts,
		).plan;
		const rows = rowsOf(swapped, "press");
		expect(rows.filter((row) => row.done)).toHaveLength(1);
		expect(rows.filter((row) => !row.done)).toHaveLength(1);
		expect(sessionExercises(swapped)).toEqual(["press"]);
	});
});

describe("groups", () => {
	const two = () =>
		plannedPlan({
			squat: [
				{ reps: 5, weight: 95 },
				{ reps: 5, weight: 95 },
				{ reps: 5, weight: 95 },
			],
			curl: [{ reps: 12, weight: 40 }],
		});
	it("keeps an exercise solo or grouped, never both", () => {
		const plan = groupWith(two(), "squat", "curl").plan;
		expect(plan.sets.squat).toBeUndefined();
		expect(groupOfExercise(plan, "squat")).toBeDefined();
		expect(sessionExercises(plan)).toEqual(["squat", "curl"]);
	});
	it("repeats a working set, not a warm-up, when a round is added", () => {
		const warm = addWarmup(two(), "squat", SQUAT).plan;
		const grouped = groupWith(warm, "squat", "curl");
		const added = setGroupRounds(grouped.plan, grouped.groupId as string, 1);
		const rounds = added.plan.groups[grouped.groupId as string]?.rounds ?? [];
		const lastRound = rounds[rounds.length - 1];
		expect(lastRound?.items.every((row) => row.kind !== "warmup")).toBe(true);
	});
	it("states how many sets a group adds", () => {
		const result = groupWith(two(), "squat", "curl");
		expect(result.note).toEqual({
			code: "groupedAdded",
			values: { rounds: 3, added: 2 },
		});
	});
	it("invents no sets for a fully logged exercise", () => {
		let plan = plannedPlan({
			squat: [{ reps: 5, weight: 95 }],
			curl: [{ reps: 12, weight: 40 }],
			press: [{ reps: 5, weight: 60 }],
		});
		const grouped = groupWith(plan, "squat", "curl");
		plan = log(grouped.plan, firstOpen(grouped.plan, "squat"));
		plan = log(plan, firstOpen(plan, "press"), "press-1");
		const added = addToGroup(plan, grouped.groupId as string, "press");
		expect(rowsOf(added.plan, "press")).toHaveLength(1);
		expect(rowsOf(added.plan, "press").every((row) => row.done)).toBe(true);
		expect(added.note?.code).toBe("addedToGroup");
	});
	it("says how many sets adding to a group creates", () => {
		const plan = plannedPlan({
			squat: [
				{ reps: 5, weight: 95 },
				{ reps: 5, weight: 95 },
			],
			curl: [
				{ reps: 12, weight: 40 },
				{ reps: 12, weight: 40 },
			],
			press: [{ reps: 5, weight: 60 }],
		});
		const grouped = groupWith(plan, "squat", "curl");
		const added = addToGroup(grouped.plan, grouped.groupId as string, "press");
		expect(rowsOf(added.plan, "press")).toHaveLength(2);
		expect(added.note).toEqual({
			code: "addedToGroupWithSet",
			values: { added: 1 },
		});
	});
	it("loses no exercise switching mode and restores per-round edits", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const id = grouped.groupId as string;
		const round2 = rowsOf(grouped.plan, "squat")[1] as PlanSet;
		const edited = updateRow(grouped.plan, round2.id, { ...round2, reps: 8 });
		const amrap = setGroupMode(edited, id, "amrap").plan;
		expect(sessionExercises(amrap)).toEqual(["squat", "curl"]);
		expect(amrap.groups[id]?.rounds).toHaveLength(1);
		const back = setGroupMode(amrap, id, "rounds").plan;
		expect(findRow(back, round2.id)?.reps).toBe(8);
		expect(back.groups[id]?.rounds).toHaveLength(3);
	});
	it("locks the mode once a set is logged", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const id = grouped.groupId as string;
		const plan = log(grouped.plan, firstOpen(grouped.plan));
		expect(setGroupMode(plan, id, "amrap").refused).toBe(true);
	});
	it("refuses to ungroup a closed AMRAP", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const id = grouped.groupId as string;
		let plan = setGroupMode(grouped.plan, id, "amrap").plan;
		plan = startClock(plan, id, 1000).plan;
		plan = log(plan, firstOpen(plan));
		plan = closeGroup(plan, id);
		expect(plan.groups[id]?.state).toBe("closed");
		expect(takeOutOfGroup(plan, "squat").refused).toBe(true);
		expect(dissolveGroup(plan, id).refused).toBe(true);
	});
	it("dissolves into solo exercises and keeps every set", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const before = allRows(grouped.plan).length;
		const plan = dissolveGroup(grouped.plan, grouped.groupId as string).plan;
		expect(Object.keys(plan.groups)).toHaveLength(0);
		expect(allRows(plan)).toHaveLength(before);
	});
	it("takes one out, dissolving a group left with one exercise", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const result = takeOutOfGroup(grouped.plan, "curl");
		expect(Object.keys(result.plan.groups)).toHaveLength(0);
		expect(result.note?.code).toBe("groupDissolved");
		expect(sessionExercises(result.plan).sort()).toEqual(["curl", "squat"]);
	});
	it("refuses a round with logged sets being removed", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const id = grouped.groupId as string;
		let plan = grouped.plan;
		for (const row of allRows(plan)) plan = log(plan, row);
		expect(setGroupRounds(plan, id, -1).refused).toBe(true);
	});
	it("rests only at round completion", () => {
		const grouped = groupWith(two(), "squat", "curl");
		let plan = grouped.plan;
		const round = plan.groups[grouped.groupId as string]?.rounds[0];
		const [first, second] = (round as GroupRound).items as [PlanSet, PlanSet];
		expect(restAfterLog(plan, first.id)).toBeNull();
		plan = log(plan, first);
		expect(restAfterLog(plan, second.id)).toBe(90);
	});
	it("AMRAP adds rounds as they complete, and scores closed rounds", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const id = grouped.groupId as string;
		let plan = setGroupMode(grouped.plan, id, "amrap").plan;
		plan = startClock(plan, id, 1000).plan;
		const round = plan.groups[id]?.rounds[0]?.items as PlanSet[];
		for (const row of round) plan = log(plan, row);
		expect(plan.groups[id]?.rounds).toHaveLength(2);
		plan = log(plan, plan.groups[id]?.rounds[1]?.items[0] as PlanSet);
		plan = closeGroup(plan, id);
		expect(
			amrapScore(plan.groups[id] as NonNullable<SessionPlan["groups"][string]>),
		).toEqual({
			rounds: 1,
			sets: 1,
		});
	});
	it("clock reads from its end time: time over after a restart, resume after a stop", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const id = grouped.groupId as string;
		let plan = setGroupMode(grouped.plan, id, "amrap").plan;
		plan = startClock(plan, id, 0).plan;
		expect(plan.groups[id]?.endsAt).toBe(600_000);
		const stopped = stopClock(plan, id, 100_000);
		expect(stopped.groups[id]?.stoppedRemaining).toBe(500_000);
		expect(startClock(stopped, id, 200_000).plan.groups[id]?.endsAt).toBe(
			700_000,
		);
		plan = tickClocks(plan, 700_000);
		expect(plan.groups[id]).toMatchObject({ state: "timeup", endsAt: null });
	});
	it("keeps the plan when a clock closes with nothing logged", () => {
		const grouped = groupWith(two(), "squat", "curl");
		const id = grouped.groupId as string;
		const idle = setGroupMode(grouped.plan, id, "amrap").plan;
		const running = startClock(idle, id, 0).plan;
		const closed = closeGroup(stopClock(running, id, 100_000), id);
		expect(closed.groups[id]).toMatchObject({
			state: "idle",
			endsAt: null,
			stoppedRemaining: null,
		});
		expect(closed.groups[id]?.rounds).toEqual(idle.groups[id]?.rounds);
	});
	it("runs one clock at a time", () => {
		const plan0 = plannedPlan({
			squat: [{ reps: 5, weight: 95 }],
			curl: [{ reps: 12, weight: 40 }],
			press: [{ reps: 5, weight: 60 }],
			row: [{ reps: 5, weight: 60 }],
		});
		const one = groupWith(plan0, "squat", "curl");
		const two2 = groupWith(one.plan, "press", "row");
		let plan = setGroupMode(two2.plan, one.groupId as string, "amrap").plan;
		plan = setGroupMode(plan, two2.groupId as string, "amrap").plan;
		plan = startClock(plan, one.groupId as string, 0).plan;
		expect(startClock(plan, two2.groupId as string, 0).refused).toBe(true);
		expect(closeOpenClocks(plan).groups[one.groupId as string]?.state).toBe(
			"idle",
		);
	});
});

describe("typo guards", () => {
	const plan = plannedPlan();
	const row = firstOpen(plan);
	it("asks about implausible reps", () => {
		expect(typoCheck(plan, { ...row, reps: 31 }, SQUAT, row)?.kind).toBe(
			"reps",
		);
		expect(typoCheck(plan, { ...row, reps: 11 }, SQUAT, row)?.code).toBe(
			"repsAbovePlan",
		);
	});
	it("asks about implausible load", () => {
		expect(typoCheck(plan, { ...row, kg: 200 }, SQUAT, row)?.kind).toBe("kg");
		expect(typoCheck(plan, { ...row, kg: 30 }, SQUAT, row)?.code).toBe(
			"belowPlan",
		);
		expect(
			typoCheck(plan, { ...row, kg: 140, reps: 1 }, SQUAT, row)?.code,
		).toBe("singleHigh");
	});
	it("needs exactly one confirmation", () => {
		const odd = { ...row, kg: 200 };
		const confirmed = { ...odd, confirmedKey: confirmKey(odd) };
		expect(typoCheck(plan, confirmed, SQUAT, row)).toBeNull();
		expect(
			typoCheck(plan, { ...confirmed, kg: 201 }, SQUAT, row),
		).not.toBeNull();
	});
	it("guards a far-off manual 1RM", () => {
		expect(manualIsOdd(plan, "squat", 400, SQUAT)).toBe(true);
		expect(manualIsOdd(plan, "squat", 130, SQUAT)).toBe(false);
	});
	it("leaves ordinary sets alone", () => {
		expect(typoCheck(plan, row, SQUAT, row)).toBeNull();
		expect(typoCheck(plan, { ...row, reps: 0 }, SQUAT, row)).toBeNull();
	});
});

describe("repeat and add", () => {
	it("lands a repeat after logged sets, without renumbering", () => {
		let plan = plannedPlan();
		const [one, two] = rowsOf(plan, "squat") as [PlanSet, PlanSet];
		plan = log(plan, one);
		plan = log(plan, two);
		plan = repeatRow(plan, one.id).plan;
		const rows = rowsOf(plan, "squat");
		expect(rows.map((row) => row.setNumber)).toEqual([
			1,
			2,
			undefined,
			undefined,
		]);
		expect(rows[2]).toMatchObject({ done: false, kg: 95, reps: 5, free: true });
	});
	it("added sets keep known weight and leave unknown reps empty", () => {
		let plan = addExerciseToPlan(plannedPlan(), "plain", PLAIN).plan;
		const blank = rowsOf(plan, "plain")[0] as PlanSet;
		plan = updateRow(plan, blank.id, { ...blank, kg: 50 });
		plan = addSet(plan, "plain", PLAIN).plan;
		expect(rowsOf(plan, "plain")[1]).toMatchObject({
			kg: 50,
			reps: 0,
			blank: true,
		});
	});
	it("a new exercise starts blank unless last time is known", () => {
		expect(
			rowsOf(addExerciseToPlan(plannedPlan(), "plain", PLAIN).plan, "plain")[0],
		).toMatchObject({
			kg: 0,
			blank: true,
		});
		expect(
			rowsOf(
				addExerciseToPlan(plannedPlan(), "row", TABLE.row as ExerciseFacts)
					.plan,
				"row",
			)[0],
		).toMatchObject({
			kg: 40,
			reps: 10,
		});
	});
	it("does not add an exercise twice", () => {
		expect(addExerciseToPlan(plannedPlan(), "squat", SQUAT).refused).toBe(true);
	});
	it("a blank set needs reps until 0 is entered on purpose", () => {
		const row = rowsOf(
			addExerciseToPlan(plannedPlan(), "plain", PLAIN).plan,
			"plain",
		)[0] as PlanSet;
		expect(isValidRow({ ...row, kg: 50, reps: 0 }, PLAIN)).toBe(false);
		expect(
			isValidRow({ ...row, kg: 50, reps: 0, blank: undefined }, PLAIN),
		).toBe(true);
	});
	it("fills empty rows from last time once", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "row",
					plannedSets: [{ reps: 8, weight: 0, unit: "kg" }],
				},
			],
			[],
			lookup,
		);
		const filled = fillFromLast(plan, "row", TABLE.row as ExerciseFacts);
		expect(rowsOf(filled, "row")[0]).toMatchObject({ kg: 40, reps: 8 });
		expect(rowsOf(filled, "row")[0]?.blank).toBeUndefined();
		expect(fillFromLast(filled, "row", TABLE.row as ExerciseFacts)).toBe(
			filled,
		);
	});
});

describe("offline", () => {
	it("a failed log stays open with its input until it succeeds", () => {
		let plan = plannedPlan();
		const row = firstOpen(plan);
		const attempt = beginAttempt(plan, row.id, "op-1") as PlanSet;
		plan = updateRow(plan, row.id, attempt);
		plan = markFailed(plan, row.id, true);
		expect(findRow(plan, row.id)).toMatchObject({
			done: false,
			failed: true,
			kg: 95,
		});
		expect(failedRows(plan)).toHaveLength(1);
	});
	it("a retry reuses the operation id and payload", () => {
		let plan = plannedPlan();
		const row = firstOpen(plan);
		plan = updateRow(
			plan,
			row.id,
			beginAttempt(plan, row.id, "op-1") as PlanSet,
		);
		const payload = findRow(plan, row.id)?.attempt?.payload;
		plan = markFailed(plan, row.id, true);
		const retry = beginAttempt(plan, row.id, "op-2") as PlanSet;
		expect(retry.attempt?.operationId).toBe("op-1");
		expect(retry.attempt?.payload).toEqual(payload);
	});
	it("a rejected attempt unlocks input", () => {
		let plan = plannedPlan();
		const row = firstOpen(plan);
		plan = updateRow(
			plan,
			row.id,
			beginAttempt(plan, row.id, "op-1") as PlanSet,
		);
		plan = markFailed(plan, row.id, false);
		expect(findRow(plan, row.id)?.attempt).toBeUndefined();
	});
	it("links a landed attempt to its server set instead of duplicating it", () => {
		let plan = plannedPlan();
		const row = firstOpen(plan);
		plan = updateRow(
			plan,
			row.id,
			beginAttempt(plan, row.id, "op-1") as PlanSet,
		);
		const next = reconcilePlan(
			plan,
			[],
			[
				{
					_id: "server-1",
					exerciseId: "squat",
					setNumber: 1,
					reps: 5,
					weight: 95,
					unit: "kg",
					setType: "working",
				},
			],
			lookup,
		);
		expect(rowsOf(next, "squat")).toHaveLength(3);
		expect(findRow(next, row.id)).toMatchObject({
			done: true,
			setId: "server-1",
		});
	});
});

describe("reconcile", () => {
	const set = (id: string, setNumber: number, weight = 95) => ({
		_id: id,
		exerciseId: "squat",
		setNumber,
		reps: 5,
		weight,
		unit: "kg" as const,
		setType: "working" as const,
	});
	it("seeds logged sets, then the rest of the plan", () => {
		const plan = seedPlan(
			[
				{
					exerciseId: "squat",
					plannedSets: [
						{ reps: 5, weight: 95, unit: "kg" },
						{ reps: 5, weight: 95, unit: "kg" },
					],
				},
			],
			[set("a", 1)],
			lookup,
		);
		expect(rowsOf(plan, "squat").map((row) => row.done)).toEqual([true, false]);
	});
	it("adds unknown server sets, copies changes, and drops deleted sets", () => {
		let plan = seedPlan(
			[{ exerciseId: "squat", plannedSets: [] }],
			[set("a", 1)],
			lookup,
		);
		plan = reconcilePlan(plan, [], [set("a", 1, 100), set("b", 2)], lookup);
		expect(rowsOf(plan, "squat").map((row) => row.kg)).toEqual([100, 95]);
		plan = reconcilePlan(plan, [], [set("b", 2)], lookup);
		expect(rowsOf(plan, "squat")).toHaveLength(1);
	});
	it("keeps a just-logged set the query has not delivered yet", () => {
		const plan = plannedPlan();
		const logged = log(plan, firstOpen(plan), "fresh");
		const same = reconcilePlan(logged, [], [], lookup, new Set());
		expect(same).toBe(logged);
	});
	it("does not bring back a removed exercise", () => {
		const removed = removeExercise(plannedPlan(), "squat").plan;
		const next = reconcilePlan(
			removed,
			[{ exerciseId: "squat", plannedSets: [] }],
			[],
			lookup,
		);
		expect(sessionExercises(next)).toEqual([]);
	});
	it("returns the same plan when nothing changed", () => {
		const plan = plannedPlan();
		expect(reconcilePlan(plan, [], [], lookup)).toBe(plan);
	});
});

describe("undo and removal", () => {
	it("restores a logged row", () => {
		const plan = plannedPlan();
		const row = firstOpen(plan);
		const sent = updateRow(
			plan,
			row.id,
			beginAttempt(plan, row.id, "op") as PlanSet,
		);
		const result = markLogged(sent, row.id, "s", 1, SQUAT);
		const back = restoreRows(result.plan, [row]);
		expect(findRow(back, row.id)).toEqual(row);
	});
	it("returns set ids to delete when removing an exercise", () => {
		let plan = plannedPlan();
		plan = log(plan, firstOpen(plan), "x");
		expect(removeExercise(plan, "squat").setIds).toEqual(["x"]);
	});
	it("refuses removing from a running group", () => {
		const grouped = groupWith(
			plannedPlan({
				squat: [{ reps: 5, weight: 95 }],
				curl: [{ reps: 12, weight: 40 }],
			}),
			"squat",
			"curl",
		);
		const id = grouped.groupId as string;
		let plan = setGroupMode(grouped.plan, id, "amrap").plan;
		plan = startClock(plan, id, 0).plan;
		expect(removeExercise(plan, "squat").refused).toBe(true);
	});
});

describe("recap", () => {
	it("excludes warm-ups from volume and reports records", () => {
		let plan = plannedPlan({ squat: [{ reps: 1, weight: 125 }] });
		plan = addWarmup(plan, "squat", SQUAT).plan;
		for (const row of rowsOf(plan, "squat")) plan = log(plan, row);
		const recap = recapOf(plan, lookup);
		expect(recap.sets).toBe(2);
		expect(recap.volume).toBe(125);
		expect(recap.exercises[0]).toMatchObject({
			tag: "newMeasured",
			was: 120,
			best: { value: 125, measured: true },
		});
		expect(recap.heroes).toHaveLength(1);
	});
	it("does not count a warm-up single as a new measured 1RM", () => {
		let plan = plannedPlan();
		const warm = addWarmup(plan, "squat", SQUAT);
		plan = warm.plan;
		const row = findRow(plan, warm.rowId) as PlanSet;
		const heavy = { ...row, kg: 200, reps: 1 };
		plan = updateRow(plan, row.id, heavy);
		plan = log(plan, heavy);
		expect(recapOf(plan, lookup).heroes).toHaveLength(0);
	});
});

describe("targets", () => {
	it("recognises a set still at its target, either unit", () => {
		const row = applyPercent(
			firstOpen(plannedPlan()),
			80,
			{ value: 120 },
			SQUAT,
		);
		expect(targetPercent(row, { value: 120 }, 2.5)).toBe(80);
		expect(targetPercent({ ...row, kg: 100 }, { value: 120 }, 2.5)).toBeNull();
		const lbs = applyPercent(
			switchUnit(row, "lbs", SQUAT),
			80,
			{ value: 120 },
			SQUAT,
		);
		expect(targetPercent(lbs, { value: 120 }, 2.5)).toBe(80);
	});
});

describe("randomised action sequences", () => {
	function rng(seed: number) {
		let state = seed;
		return () => {
			state = (state * 1664525 + 1013904223) % 4294967296;
			return state / 4294967296;
		};
	}
	const IDS = ["squat", "curl", "plain", "pullup", "press", "row"];
	function check(plan: SessionPlan, loggedIds: Set<string>) {
		for (const row of allRows(plan)) {
			expect(Number.isFinite(row.kg)).toBe(true);
			expect(Number.isFinite(row.reps)).toBe(true);
			expect(row.kg).toBeGreaterThanOrEqual(0);
			if (row.setId) expect(loggedIds.has(row.setId)).toBe(true);
			if (row.done) expect(row.setId).toBeDefined();
		}
		const solo = plan.order.flatMap((entry) =>
			entry.kind === "exercise" ? [entry.exerciseId] : [],
		);
		expect(new Set(solo).size).toBe(solo.length);
		for (const group of Object.values(plan.groups)) {
			for (const round of group.rounds)
				for (const row of round.items) {
					expect(plan.sets[row.exerciseId]?.length ?? 0).toBe(0);
					expect(solo).not.toContain(row.exerciseId);
				}
		}
		for (const id of Object.keys(plan.sets))
			if ((plan.sets[id]?.length ?? 0) > 0) expect(solo).toContain(id);
	}
	it.each(Array.from({ length: 40 }, (_, index) => index + 1))(
		"keeps invariants, seed %i",
		(seed) => {
			const random = rng(seed);
			const pick = <T>(items: readonly T[]) =>
				items[Math.floor(random() * items.length)] as T;
			let plan = plannedPlan();
			let now = 0;
			const loggedIds = new Set<string>();
			for (let step = 0; step < 120; step += 1) {
				now += 5000;
				const id = pick(IDS);
				const f = lookup(id);
				const rows = allRows(plan);
				const row = rows.length ? pick(rows) : undefined;
				const group = pick(
					Object.values(plan.groups).concat([undefined as never]),
				);
				switch (Math.floor(random() * 20)) {
					case 0:
						plan = addExerciseToPlan(plan, id, f).plan;
						break;
					case 1:
						if (
							plan.sets[id] &&
							plan.order.some(
								(e) => e.kind === "exercise" && e.exerciseId === id,
							)
						)
							plan = addSet(plan, id, f).plan;
						break;
					case 2:
						if (
							plan.sets[id] &&
							plan.order.some(
								(e) => e.kind === "exercise" && e.exerciseId === id,
							)
						)
							plan = addWarmup(plan, id, f).plan;
						break;
					case 3:
						if (row) plan = repeatRow(plan, row.id).plan;
						break;
					case 4:
						if (row && !row.setId) plan = removeRow(plan, row.id);
						break;
					case 5:
						if (row && !row.done) {
							const load =
								random() < 0.5 ? 20 + Math.floor(random() * 40) * 2.5 : 137;
							plan = updateRow(plan, row.id, withTypedLoad(row, load));
						}
						break;
					case 6:
						if (row && !row.done) {
							const original = row.kg;
							const flipped = switchUnit(
								row,
								row.unit === "kg" ? "lbs" : "kg",
								lookup(row.exerciseId),
							);
							if (!row.lbStep) expect(flipped.kg).toBe(original);
							plan = updateRow(plan, row.id, flipped);
						}
						break;
					case 7:
					case 8:
					case 9:
						if (
							row &&
							!row.done &&
							!row.attempt &&
							isValidRow(row, lookup(row.exerciseId))
						) {
							const inAmrapIdle = (() => {
								const home = Object.values(plan.groups).find((g) =>
									g.rounds.some((r) => r.items.some((i) => i.id === row.id)),
								);
								return home?.mode === "amrap" && home.state === "idle";
							})();
							if (inAmrapIdle) break;
							const setId = `srv-${seed}-${step}`;
							const attempted = beginAttempt(plan, row.id, setId) as PlanSet;
							const sent = updateRow(plan, row.id, attempted);
							loggedIds.add(setId);
							plan = markLogged(
								sent,
								row.id,
								setId,
								attempted.attempt?.setNumber as number,
								lookup(row.exerciseId),
							).plan;
						}
						break;
					case 10:
						plan = setManual(plan, id, 50 + Math.floor(random() * 100), f).plan;
						break;
					case 11:
						plan = clearManual(plan, id, f).plan;
						break;
					case 12: {
						const from = pick(sessionExercises(plan).concat(id));
						if (sessionExercises(plan).includes(from))
							plan = swapExercise(plan, from, id, f).plan;
						break;
					}
					case 13: {
						const solo = plan.order.flatMap((e) =>
							e.kind === "exercise" ? [e.exerciseId] : [],
						);
						if (solo.length >= 2) {
							const result = groupWith(
								plan,
								solo[0] as string,
								solo[1] as string,
							);
							plan = result.plan;
						}
						break;
					}
					case 14:
						if (
							group &&
							plan.sets[id] &&
							plan.order.some(
								(e) => e.kind === "exercise" && e.exerciseId === id,
							)
						)
							plan = addToGroup(plan, group.id, id).plan;
						break;
					case 15:
						if (group)
							plan = takeOutOfGroup(
								plan,
								pick(sessionExercises(plan).concat(id)),
							).plan;
						break;
					case 16:
						if (group) plan = dissolveGroup(plan, group.id).plan;
						break;
					case 17:
						if (group) {
							plan = setGroupMode(
								plan,
								group.id,
								random() < 0.5 ? "amrap" : "rounds",
							).plan;
							plan = setGroupRounds(
								plan,
								group.id,
								random() < 0.5 ? 1 : -1,
							).plan;
						}
						break;
					case 18:
						if (group) {
							plan = startClock(plan, group.id, now).plan;
							if (random() < 0.3) plan = stopClock(plan, group.id, now);
							if (random() < 0.2) plan = closeGroup(plan, group.id);
							plan = tickClocks(plan, now);
						}
						break;
					default: {
						const entry = plan.order[0];
						if (entry) plan = moveEntry(plan, entry, 1);
						if (random() < 0.15) {
							const result = removeExercise(plan, id);
							plan = result.plan;
						}
					}
				}
				check(plan, loggedIds);
				const stable = nextSetNumber(plan, id);
				expect(Number.isInteger(stable)).toBe(true);
			}
			expect(convertLoad(1, "kg", "kg")).toBe(1);
			expect(Number.isFinite(recapOf(plan, lookup).volume)).toBe(true);
		},
	);
});

describe("addSetTemplate", () => {
	it("copies the last work set, not a warm-up that happens to be last", () => {
		const work = { id: "work", kind: "working", kg: 60, reps: 5 };
		const warmup = { id: "warm", kind: "warmup", kg: 30, reps: 5 };
		expect(
			addSetTemplate([work, warmup] as unknown as Parameters<
				typeof addSetTemplate
			>[0])?.id,
		).toBe("work");
	});
	it("falls back to a warm-up when nothing else exists", () => {
		const warmup = { id: "warm", kind: "warmup", kg: 30, reps: 5 };
		expect(
			addSetTemplate([warmup] as unknown as Parameters<
				typeof addSetTemplate
			>[0])?.id,
		).toBe("warm");
	});
});
