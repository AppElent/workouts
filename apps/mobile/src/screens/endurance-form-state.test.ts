import { enduranceCopy } from "./endurance-copy";
import {
	formatPace,
	parseEnduranceValues,
	valuesForActivity,
} from "./endurance-form-state";

describe("endurance form values", () => {
	const base = {
		...valuesForActivity(),
		date: "2026-09-20",
		time: "08:30",
		distance: "5,25",
		hours: "0",
		minutes: "31",
		seconds: "15",
	};

	it("accepts Dutch decimal input and converts metric values", () => {
		const parsed = parseEnduranceValues(base, enduranceCopy.nl);
		expect(parsed.error).toBeUndefined();
		expect(parsed.value).toMatchObject({
			distanceMeters: 5250,
			durationSeconds: 1875,
		});
	});

	it("rejects calendar overflow and bad duration", () => {
		expect(
			parseEnduranceValues({ ...base, date: "2026-02-30" }, enduranceCopy.en)
				.error,
		).toBe(enduranceCopy.en.invalidDate);
		expect(
			parseEnduranceValues({ ...base, minutes: "60" }, enduranceCopy.en).error,
		).toBe(enduranceCopy.en.invalidDuration);
	});

	it("checks optional measurements without losing blank fields", () => {
		expect(
			parseEnduranceValues({ ...base, effort: "11" }, enduranceCopy.en).error,
		).toBe(enduranceCopy.en.invalidEffort);
		expect(
			parseEnduranceValues({ ...base, heartRate: "71.5" }, enduranceCopy.en)
				.error,
		).toBe(enduranceCopy.en.invalidHeartRate);
		expect(
			parseEnduranceValues({ ...base, elevation: "-3" }, enduranceCopy.en)
				.error,
		).toBe(enduranceCopy.en.invalidElevation);
		expect(
			parseEnduranceValues(
				{ ...base, title: "  ", notes: "  " },
				enduranceCopy.en,
			).value,
		).toMatchObject({
			title: null,
			notes: null,
			elevationGainMeters: null,
			averageHeartRate: null,
			effort: null,
		});
	});

	it("rounds pace across the minute boundary", () => {
		expect(formatPace(359.8)).toBe("6:00 /km");
	});

	it("rejects text beyond the backend limits before save", () => {
		expect(
			parseEnduranceValues(
				{ ...base, title: "a".repeat(201) },
				enduranceCopy.en,
			).error,
		).toBe(enduranceCopy.en.invalidTitle);
		expect(
			parseEnduranceValues(
				{ ...base, notes: "a".repeat(10_001) },
				enduranceCopy.en,
			).error,
		).toBe(enduranceCopy.en.invalidNotes);
	});
});
