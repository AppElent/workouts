import {
	draftFromGoals,
	draftToGoals,
	emptyGoalDraft,
	goalDraftEquals,
	goalHistoryLabel,
	parseGoalNumber,
} from "./nutrition-goal-history";

describe("nutrition goal history helpers", () => {
	it("accepts Dutch decimal commas without changing the draft text", () => {
		expect(parseGoalNumber("12,5")).toBe(12.5);
		const draft = emptyGoalDraft();
		draft.protein.min = "12,5";
		const parsed = draftToGoals(draft);
		expect(parsed.errors).toEqual([]);
		expect(parsed.goals).toContainEqual({
			nutrient: "protein",
			direction: "min",
			target: 12.5,
		});
	});

	it("reports invalid input and crossed bounds clearly", () => {
		const draft = emptyGoalDraft();
		draft.protein.min = "150";
		draft.protein.max = "100";
		draft.energy.max = "wat";
		expect(draftToGoals(draft).errors).toEqual(
			expect.arrayContaining([
				{ key: "energy.max", message: "invalid" },
				{ key: "protein.range", message: "range" },
			]),
		);
	});

	it("lets a dirty draft survive a changed server response", () => {
		const clean = draftFromGoals([
			{ nutrient: "energy", direction: "max", target: 2000 },
		]);
		const dirty = { ...clean, energy: { ...clean.energy, max: "2100" } };
		const refreshed = draftFromGoals([
			{ nutrient: "energy", direction: "max", target: 1800 },
		]);
		expect(goalDraftEquals(dirty, refreshed)).toBe(false);
		expect(dirty.energy.max).toBe("2100");
	});

	it("labels a legacy reference separately from a dated version", () => {
		expect(
			goalHistoryLabel({
				basis: "reference",
				effectiveFrom: null,
				locale: "en",
			}),
		).toContain("legacy");
		expect(
			goalHistoryLabel({
				basis: "effective",
				effectiveFrom: "2026-09-12",
				locale: "nl",
			}),
		).toContain("2026-09-12");
	});
});
