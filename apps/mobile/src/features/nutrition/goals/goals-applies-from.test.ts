import { goalEditorEn } from "../../../i18n/messages/goal-editor";
import { goalsAppliesFrom } from "./goals-applies-from";

const base = {
	today: "2026-10-06",
	locale: "en-GB",
	copy: goalEditorEn,
	requestedDate: undefined,
};

describe("goalsAppliesFrom", () => {
	it("says since when today's goals apply", () => {
		expect(
			goalsAppliesFrom({
				...base,
				date: "2026-10-06",
				version: {
					goals: 1,
					effectiveFrom: "2026-09-12",
					nextEffectiveFrom: null,
				},
			}),
		).toEqual({
			body: "Current goals apply since 12 Sept. Earlier days keep their goals.",
		});
	});

	it("names the past range a change covers and what earlier days keep", () => {
		expect(
			goalsAppliesFrom({
				...base,
				date: "2026-09-28",
				requestedDate: "2026-09-28",
				version: {
					goals: 1,
					effectiveFrom: "2026-09-12",
					nextEffectiveFrom: null,
				},
			}),
		).toEqual({
			lead: "Also applies to 28 Sept through today.",
			body: "Days before keep the goals from 12 Sept. Opened from the diary of 28 Sept.",
		});
	});

	it("ends a past change where the next dated version starts", () => {
		expect(
			goalsAppliesFrom({
				...base,
				date: "2026-09-28",
				version: {
					goals: 0,
					effectiveFrom: null,
					nextEffectiveFrom: "2026-10-03",
				},
			}).lead,
		).toBe("Also applies to 28 Sept through 2 Oct.");
	});

	it("explains a future start", () => {
		expect(
			goalsAppliesFrom({
				...base,
				date: "2026-10-10",
				version: {
					goals: 1,
					effectiveFrom: "2026-09-12",
					nextEffectiveFrom: null,
				},
			}).body,
		).toBe("Applies from 10 Oct. Until then, the current goals apply.");
	});

	it("says a first set of goals leaves earlier days without goals", () => {
		expect(
			goalsAppliesFrom({
				...base,
				date: "2026-10-06",
				version: { goals: 0, effectiveFrom: null, nextEffectiveFrom: null },
			}).body,
		).toBe("Goals apply from this date. Earlier days stay without goals.");
	});
});
