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

	it("rejects invalid measurements", () => {
		const valid = {
			occurredAt: 1_000,
			durationSeconds: 600,
			distanceMeters: 2000,
		};
		expect(() => validateEnduranceInput(valid)).not.toThrow();
		expect(() =>
			validateEnduranceInput({ ...valid, occurredAt: 2000 }, 1000),
		).toThrow("future");
		expect(() =>
			validateEnduranceInput({ ...valid, distanceMeters: 0 }),
		).toThrow();
		expect(() =>
			validateEnduranceInput({ ...valid, averageHeartRate: 63.5 }),
		).toThrow();
		expect(() => validateEnduranceInput({ ...valid, effort: 11 })).toThrow();
		expect(() =>
			validateEnduranceInput({ ...valid, elevationGainMeters: -1 }),
		).toThrow();
	});
});
