import {
	evaluateGoal,
	type GoalBounds,
	type Locale,
	NUTRIENT_UNITS,
	type NutrientTotal,
} from "@foundry/core";
import { fmt, type Messages } from "../../../i18n";
import type { Tokens } from "../../../theme";
import { formatNutrientAmount } from "../nutrient-amount";

/** "60–80 g", "≥120 g" or "≤2,5 g". */
export function targetLabel(group: GoalBounds, locale: Locale): string {
	const value = (amount: number) =>
		formatNutrientAmount(group.nutrient, amount, locale);
	const unit = NUTRIENT_UNITS[group.nutrient];
	if (group.min !== undefined && group.max !== undefined)
		return `${value(group.min)}–${value(group.max)} ${unit}`;
	if (group.min !== undefined) return `≥${value(group.min)} ${unit}`;
	return `≤${value(group.max ?? 0)} ${unit}`;
}

export function outcome(
	colors: Tokens,
	{ t, locale }: { t: Messages; locale: Locale },
	group: GoalBounds,
	total?: NutrientTotal,
): { label: string; color: string } {
	const evaluation = evaluateGoal(group, total);
	const unit = NUTRIENT_UNITS[group.nutrient];
	const amount = (value = 0) =>
		formatNutrientAmount(group.nutrient, value, locale);
	switch (evaluation.status) {
		case "noGoal":
		case "empty":
			return {
				label: t.nutrition.goals.state.neutral,
				color: colors.textMuted,
			};
		case "exceeded":
			return {
				label: fmt(t.nutrition.goals.over, {
					amount: amount(evaluation.over),
					unit,
				}),
				color: colors.danger,
			};
		case "incomplete":
			return { label: t.nutrition.goals.incomplete, color: colors.textMuted };
	}
	if (evaluation.approximate)
		return { label: t.nutrition.goals.approximate, color: colors.textMuted };
	switch (evaluation.status) {
		case "below":
			return {
				label: fmt(
					group.max === undefined
						? t.nutrition.goals.toMinimum
						: t.nutrition.goals.toRange,
					{ amount: amount(evaluation.toMinimum), unit },
				),
				color: colors.accent,
			};
		case "met":
			return { label: t.nutrition.goals.minimumMet, color: colors.success };
		case "within":
			if (group.min !== undefined)
				return { label: t.nutrition.goals.withinRange, color: colors.success };
			return evaluation.toMaximum
				? {
						label: fmt(t.nutrition.goals.remaining, {
							amount: amount(evaluation.toMaximum),
							unit,
						}),
						color: colors.accent,
					}
				: { label: t.nutrition.goals.atMaximum, color: colors.accent };
	}
}
