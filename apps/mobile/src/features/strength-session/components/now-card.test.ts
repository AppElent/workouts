import {
	addExerciseToPlan,
	addSet,
	type ExerciseFacts,
	emptyPlan,
	type SessionPlan,
} from "../session-plan";
import { nowTarget } from "./now-card";

const FACTS: ExerciseFacts = {
	exercise: { equipment: "barbell" },
	bodyweight: false,
	timed: false,
	stepKg: 2.5,
	measured: null,
	estimated: null,
	savedManual: null,
	measuredDate: null,
	last: { kg: 80, reps: 8 },
};
const doneAll = (plan: SessionPlan): SessionPlan => ({
	...plan,
	sets: Object.fromEntries(
		Object.entries(plan.sets).map(([id, rows]) => [
			id,
			rows.map((row) => ({ ...row, done: true })),
		]),
	),
});

describe("nowTarget", () => {
	it("offers the open set first", () => {
		const { plan } = addExerciseToPlan(emptyPlan(), "bench", FACTS);
		const target = nowTarget(plan);
		expect(target?.draft).toBe(false);
		expect(target?.number).toBe(1);
	});

	it("offers one more like the last set once a free exercise is done", () => {
		const added = addExerciseToPlan(emptyPlan(), "bench", FACTS).plan;
		const target = nowTarget(doneAll(added));
		expect(target).toMatchObject({ draft: true, number: 2, total: 2 });
		expect(target?.row).toMatchObject({ kg: 80, reps: 8, done: false });
	});

	it("offers nothing extra after a planned exercise or an empty session", () => {
		const added = addExerciseToPlan(emptyPlan(), "bench", FACTS).plan;
		const planned = doneAll({
			...added,
			sets: {
				bench: (added.sets.bench ?? []).map((row) => ({
					...row,
					plan: { kg: 80, reps: 8, percent: null },
				})),
			},
		});
		expect(nowTarget(planned)).toBeNull();
		expect(nowTarget(emptyPlan())).toBeNull();
	});

	it("is the same draft whether or not it was added yet", () => {
		const done = doneAll(addExerciseToPlan(emptyPlan(), "bench", FACTS).plan);
		const draft = nowTarget(done);
		const real = nowTarget(addSet(done, "bench", FACTS).plan);
		expect(real?.draft).toBe(false);
		expect(real?.number).toBe(draft?.number);
		expect(real?.row.kg).toBe(draft?.row.kg);
	});
});
