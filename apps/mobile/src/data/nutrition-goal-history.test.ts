import {
	draftFromGoals,
	draftToGoals,
	emptyGoalDraft,
	goalDraftEquals,
	goalHistoryLabel,
	goalKind,
	parseGoalNumber,
	referenceGoalTarget,
	setGoalKind,
	withGoal,
	withoutGoal,
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

	it("reads the kind of a goal from which bounds are filled", () => {
		const draft = emptyGoalDraft();
		draft.energy = { min: "2300", max: "2700" };
		draft.protein = { min: "120", max: "" };
		draft.fat = { min: "", max: "80" };
		expect(goalKind(draft.energy)).toBe("range");
		expect(goalKind(draft.protein)).toBe("min");
		expect(goalKind(draft.fat)).toBe("max");
		expect(goalKind(draft.salt)).toBeNull();
	});

	it("changes a goal's kind and keeps the number the user had", () => {
		const draft = emptyGoalDraft();
		draft.protein = { min: "120", max: "" };
		const range = setGoalKind(draft, "protein", "range");
		expect(range.protein).toEqual({ min: "120", max: "120" });
		const max = setGoalKind(range, "protein", "max");
		expect(max.protein).toEqual({ min: "", max: "120" });
		expect(draft.protein).toEqual({ min: "120", max: "" });
	});

	it("adds a nutrient with its default direction and reference value", () => {
		expect(referenceGoalTarget("saturatedFat")).toBe(20);
		const draft = withGoal(emptyGoalDraft(), "fibre");
		expect(draft.fibre).toEqual({ min: "25", max: "" });
		expect(withoutGoal(draft, "fibre").fibre).toEqual({ min: "", max: "" });
	});
});
