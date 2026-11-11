import { en } from "../../../i18n/messages/en";
import { nl } from "../../../i18n/messages/nl";
import { goalPresetMenuHint, goalPresetSummary } from "./goal-presets";

it("quotes each preset's own targets in the phone's number format", () => {
	const copy = en.nutrition.goalEditor;
	expect(goalPresetSummary(copy, "reference", "en")).toBe(
		"2,000 kcal · EU 1169/2011 Annex XIII",
	);
	expect(goalPresetSummary(copy, "loseWeight", "en")).toBe(
		"1,700 kcal · Reference −300 kcal",
	);
	expect(goalPresetMenuHint(copy, "buildMuscle", "en")).toBe(
		"Reference, energy +300 kcal, protein +50 g",
	);
	expect(goalPresetSummary(nl.nutrition.goalEditor, "buildMuscle", "nl")).toBe(
		"2.300 kcal · eiwit 100 g",
	);
});
