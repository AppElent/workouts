import {
	draftFromGoals,
	draftToGoals,
	emptyGoalDraft,
	goalDraftEquals,
	goalKind,
	parseGoalNumber,
	referenceGoalTarget,
	setGoalKind,
	withGoal,
	withoutGoal,
} from "./goal-draft";

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

	it("counts a draft as unchanged only while every bound matches", () => {
		const goals = [
			{ nutrient: "energy", direction: "max", target: 2000 },
			{ nutrient: "protein", direction: "min", target: 120 },
		] as const;
		const saved = draftFromGoals([...goals]);
		expect(goalDraftEquals(draftFromGoals([...goals]), saved)).toBe(true);
		expect(goalDraftEquals(setGoalKind(saved, "protein", "max"), saved)).toBe(
			false,
		);
		expect(
			goalDraftEquals({ ...saved, energy: { min: "", max: "2100" } }, saved),
		).toBe(false);
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
		const draft = withGoal(emptyGoalDraft(), "fibre");
		expect(draft.fibre).toEqual({
			min: String(referenceGoalTarget("fibre")),
			max: "",
		});
		expect(withGoal(emptyGoalDraft(), "salt").salt).toEqual({
			min: "",
			max: String(referenceGoalTarget("salt")),
		});
		expect(withoutGoal(draft, "fibre").fibre).toEqual({ min: "", max: "" });
	});
});
