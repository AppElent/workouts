import {
	type GoalPresetKey,
	type Locale,
	NUTRITION_GOAL_PRESETS,
} from "@foundry/core";
import { dateLocale, fmt, type Messages } from "../../../i18n";

type GoalEditorCopy = Messages["nutrition"]["goalEditor"];

function target(key: GoalPresetKey, nutrient: "energy" | "protein") {
	return (
		NUTRITION_GOAL_PRESETS[key].goals.find((goal) => goal.nutrient === nutrient)
			?.target ?? 0
	);
}

/** The numbers a preset's summary and hint quote, read from the preset itself. */
function presetValues(key: GoalPresetKey, locale: Locale) {
	const number = (value: number) => value.toLocaleString(dateLocale(locale));
	const signed = (value: number) =>
		`${value < 0 ? "−" : "+"}${number(Math.abs(value))}`;
	return {
		energy: number(target(key, "energy")),
		protein: number(target(key, "protein")),
		energyDelta: signed(target(key, "energy") - target("reference", "energy")),
		proteinDelta: signed(
			target(key, "protein") - target("reference", "protein"),
		),
	};
}

export function goalPresetSummary(
	copy: GoalEditorCopy,
	key: GoalPresetKey,
	locale: Locale,
) {
	return fmt(copy.presetSummary[key], presetValues(key, locale));
}

export function goalPresetMenuHint(
	copy: GoalEditorCopy,
	key: GoalPresetKey,
	locale: Locale,
) {
	return fmt(copy.presetMenuHint[key], presetValues(key, locale));
}
