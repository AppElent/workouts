import { describe, expect, it } from "vitest";
import {
	currentOneRepMax,
	exerciseRecords,
	isReferenceEligible,
	type PerformedSet,
	repMaxCurve,
	resolveStrengthReferences,
	type StrengthReferenceRecord,
	sessionOneRepMax,
	validateManualOneRepMax,
	validatePlannedExercise,
	validateSetInput,
	workingVolume,
} from "./strength";

const errors = (result: { ok: boolean; errors?: unknown }) =>
	result.ok ? [] : result.errors;

describe("validateSetInput", () => {
	it("checks load in the set's own unit, up to 2000", () => {
		expect(errors(validateSetInput({ weight: 2000, reps: 0 }))).toEqual([]);
		expect(errors(validateSetInput({ weight: 2000.5 }))).toEqual([
			{ field: "weight", code: "tooLarge" },
		]);
		expect(errors(validateSetInput({ weight: -1 }))).toEqual([
			{ field: "weight", code: "tooSmall" },
		]);
	});
	it("requires whole reps within 0–1000", () => {
		expect(errors(validateSetInput({ reps: 1000 }))).toEqual([]);
		expect(errors(validateSetInput({ reps: 1001 }))).toEqual([
			{ field: "reps", code: "tooLarge" },
		]);
		expect(errors(validateSetInput({ reps: 2.5 }))).toEqual([
			{ field: "reps", code: "notStep" },
		]);
	});
	it("allows RPE 1–10 in half steps, and null to clear it", () => {
		expect(errors(validateSetInput({ rpe: 7.5 }))).toEqual([]);
		expect(errors(validateSetInput({ rpe: null }))).toEqual([]);
		expect(errors(validateSetInput({ rpe: 7.25 }))).toEqual([
			{ field: "rpe", code: "notStep" },
		]);
		expect(errors(validateSetInput({ rpe: 0.5 }))).toEqual([
			{ field: "rpe", code: "tooSmall" },
		]);
		expect(errors(validateSetInput({ weight: Number.NaN }))).toEqual([
			{ field: "weight", code: "notNumber" },
		]);
	});
	it("bounds planned work and manual 1RMs", () => {
		expect(
			errors(validatePlannedExercise({ plannedSets: 0, plannedReps: 5 })),
		).toEqual([{ field: "plannedSets", code: "tooSmall" }]);
		expect(errors(validatePlannedExercise({ plannedSets: 100 }))).toEqual([]);
		expect(errors(validateManualOneRepMax(0))).toEqual([
			{ field: "manualOneRepMax", code: "tooSmall" },
		]);
	});
});

const barbell = { equipment: "barbell" as const };
const set = (
	weight: number,
	reps: number,
	extra: Partial<PerformedSet> = {},
): PerformedSet => ({
	weight,
	reps,
	unit: "kg",
	performanceVerified: true,
	setType: "working",
	...extra,
});

describe("isReferenceEligible", () => {
	it("follows the server rule", () => {
		expect(isReferenceEligible(set(100, 1), barbell)).toBe(true);
		expect(
			isReferenceEligible(set(100, 1, { setType: "warmup" }), barbell),
		).toBe(true);
		expect(isReferenceEligible(set(0, 5), barbell)).toBe(false);
		expect(isReferenceEligible(set(100, 0), barbell)).toBe(false);
		expect(
			isReferenceEligible(
				set(100, 5, { performanceVerified: undefined }),
				barbell,
			),
		).toBe(false);
		expect(isReferenceEligible(set(20, 5), { equipment: "bodyweight" })).toBe(
			false,
		);
		expect(isReferenceEligible(set(100, 5), null)).toBe(false);
	});
});

describe("exerciseRecords", () => {
	it("compares loads in kg across units", () => {
		const lbs = set(225, 1, { unit: "lbs" });
		const kg = set(100, 1);
		const records = exerciseRecords([kg, lbs], barbell);
		expect(records.heaviest?.set).toBe(lbs);
		expect(records.heaviest?.valueKg).toBeCloseTo(102.06, 2);
	});
	it("ignores ineligible sets for load records but counts their reps", () => {
		const legacy = set(300, 1, { performanceVerified: undefined });
		const highReps = set(0, 50);
		const real = set(100, 5);
		const records = exerciseRecords([legacy, highReps, real], barbell);
		expect(records.heaviest?.set).toBe(real);
		expect(records.bestEstimate?.valueKg).toBe(116.7);
		expect(records.mostReps).toBe(highReps);
	});
	it("breaks equal loads by reps and reports requested rep maxes only", () => {
		const three = set(100, 3);
		const five = set(100, 5);
		const records = exerciseRecords(
			[three, five, set(90, 10)],
			barbell,
			[1, 5, 10],
		);
		expect(records.heaviest?.set).toBe(five);
		expect(records.repMaxes.map((r) => [r.reps, r.valueKg])).toEqual([
			[5, 100],
			[10, 90],
		]);
		expect(records.bestSetVolume?.valueKg).toBe(900);
	});
	it("has no load records for bodyweight exercises", () => {
		const records = exerciseRecords([set(10, 12)], { equipment: "bodyweight" });
		expect(records.heaviest).toBeNull();
		expect(records.mostReps?.reps).toBe(12);
	});
});

describe("workingVolume", () => {
	it("excludes warm-ups and converts pounds to kg", () => {
		expect(
			workingVolume([
				set(100, 5),
				set(60, 5, { setType: "warmup" }),
				set(80, 8, { setType: "drop" }),
				set(100, 10, { unit: "lbs", setType: "failure" }),
			]),
		).toBeCloseTo(500 + 640 + 453.59237, 5);
	});
});

describe("repMaxCurve", () => {
	it("returns the 1RM itself at one rep", () => {
		expect(repMaxCurve(120, [1, 10])).toEqual([
			{ reps: 1, weight: 120 },
			{ reps: 10, weight: 90 },
		]);
	});
});

describe("One-rep Max precedence", () => {
	const record = (
		source: StrengthReferenceRecord["source"],
		value: number,
		date: number,
		extra: Partial<StrengthReferenceRecord> = {},
	): StrengthReferenceRecord => ({
		source,
		value,
		date,
		unit: "kg",
		...(source === "manual" ? {} : { sourceSetId: `${source}-${value}` }),
		...extra,
	});

	it("resolves the best derived records by kg and the newest manual", () => {
		const lbs = record("actual", 250, 1, { unit: "lbs" });
		const refs = resolveStrengthReferences(
			[
				record("actual", 110, 5),
				lbs,
				record("calculated", 130, 2),
				record("calculated", 200, 9, { sourceSetId: undefined }),
				record("manual", 90, 3),
				record("manual", 95, 3, { _creationTime: 2 }),
			],
			barbell,
		);
		expect(refs.measured).toBe(lbs);
		expect(refs.estimated?.value).toBe(130);
		expect(refs.manual?.value).toBe(95);
	});
	it("has no derived references for bodyweight exercises", () => {
		const refs = resolveStrengthReferences([record("actual", 10, 1)], {
			equipment: "bodyweight",
		});
		expect(refs.measured).toBeNull();
	});
	it("uses Measured unless a Manual entry is newer", () => {
		const measured = record("actual", 100, 10);
		const estimated = record("calculated", 120, 20);
		expect(
			sessionOneRepMax({ measured, estimated, manual: record("manual", 90, 5) })
				?.kind,
		).toBe("measured");
		expect(
			sessionOneRepMax({
				measured,
				estimated,
				manual: record("manual", 90, 11),
			})?.kind,
		).toBe("manual");
		expect(
			sessionOneRepMax({ measured: null, estimated, manual: null }),
		).toBeNull();
	});
	it("falls back to Estimated only for the current 1RM", () => {
		const estimated = record("calculated", 120, 20);
		expect(
			currentOneRepMax({ measured: null, estimated, manual: null }),
		).toEqual({ reference: estimated, kind: "estimated" });
		expect(
			currentOneRepMax({
				measured: record("actual", 100, 1),
				estimated,
				manual: null,
			})?.kind,
		).toBe("measured");
	});
});
