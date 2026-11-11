import { describe, expect, it } from "vitest";
import {
	enduranceTotals,
	paceSecondsPerKilometer,
	speedKilometersPerHour,
	validateEnduranceInput,
} from "./activity";

describe("endurance calculations", () => {
	it("calculates pace and speed from time and distance", () => {
		expect(paceSecondsPerKilometer(5000, 1500)).toBe(300);
		expect(speedKilometersPerHour(20000, 3600)).toBe(20);
		expect(paceSecondsPerKilometer(0, 100)).toBeNull();
	});

	it("weights combined pace and speed by total distance", () => {
		const totals = enduranceTotals([
			{ distanceMeters: 1000, durationSeconds: 300 },
			{ distanceMeters: 3000, durationSeconds: 600 },
		]);
		expect(totals).toMatchObject({
			count: 2,
			distanceMeters: 4000,
			durationSeconds: 900,
			paceSecondsPerKilometer: 225,
			speedKilometersPerHour: 16,
		});
		expect(enduranceTotals([]).paceSecondsPerKilometer).toBeNull();
	});

	it("reports each broken field with a code", () => {
		const valid = {
			occurredAt: 1_000,
			durationSeconds: 600,
			distanceMeters: 2000,
		};
		const errors = (input: Parameters<typeof validateEnduranceInput>[0]) => {
			const result = validateEnduranceInput(input, 10_000);
			return result.ok ? [] : result.errors;
		};
		expect(validateEnduranceInput(valid, 10_000)).toEqual({
			ok: true,
			value: valid,
		});
		expect(errors({ ...valid, occurredAt: 20_000 })).toEqual([
			{ field: "occurredAt", code: "future" },
		]);
		expect(errors({ ...valid, occurredAt: 1.5 })).toEqual([
			{ field: "occurredAt", code: "invalid" },
		]);
		expect(
			errors({ ...valid, distanceMeters: 0, durationSeconds: -1 }),
		).toEqual([
			{ field: "durationSeconds", code: "notPositive" },
			{ field: "distanceMeters", code: "notPositive" },
		]);
		expect(errors({ ...valid, averageHeartRate: 63.5 })).toEqual([
			{ field: "averageHeartRate", code: "notWhole" },
		]);
		expect(errors({ ...valid, averageHeartRate: 0 })).toEqual([
			{ field: "averageHeartRate", code: "notPositive" },
		]);
		expect(errors({ ...valid, effort: 10 })).toEqual([]);
		expect(errors({ ...valid, effort: 11 })).toEqual([
			{ field: "effort", code: "outOfRange" },
		]);
		expect(errors({ ...valid, effort: 0 })).toEqual([
			{ field: "effort", code: "outOfRange" },
		]);
		expect(errors({ ...valid, elevationGainMeters: 0 })).toEqual([]);
		expect(errors({ ...valid, elevationGainMeters: -1 })).toEqual([
			{ field: "elevationGainMeters", code: "negative" },
		]);
		expect(errors({ ...valid, title: "x".repeat(200) })).toEqual([]);
		expect(errors({ ...valid, title: "x".repeat(201) })).toEqual([
			{ field: "title", code: "tooLong" },
		]);
		expect(errors({ ...valid, notes: "x".repeat(10_001) })).toEqual([
			{ field: "notes", code: "tooLong" },
		]);
	});
});
