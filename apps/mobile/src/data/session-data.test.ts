import { dayLabel, isSameDay } from "./session-data";

const NOW = new Date(2026, 10, 23, 23, 30).getTime();

describe("dayLabel", () => {
	const format = (ms: number) => `on ${new Date(ms).getDate()}`;
	it("says today's word for any time earlier the same day (APP-624)", () => {
		const morning = new Date(2026, 10, 23, 0, 5).getTime();
		expect(dayLabel(morning, "vandaag", format, NOW)).toBe("vandaag");
		expect(dayLabel(NOW, "vandaag", format, NOW)).toBe("vandaag");
	});
	it("formats other days", () => {
		const yesterday = new Date(2026, 10, 22, 23, 59).getTime();
		expect(dayLabel(yesterday, "vandaag", format, NOW)).toBe("on 22");
	});
	it("compares calendar days, not 24-hour spans", () => {
		const lateYesterday = new Date(2026, 10, 22, 23, 59).getTime();
		expect(
			isSameDay(lateYesterday, new Date(2026, 10, 23, 0, 1).getTime()),
		).toBe(false);
	});
});
