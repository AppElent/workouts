import {
	evaluateGoal,
	type GoalBounds,
	type Locale,
	NUTRIENT_UNITS,
	type NutrientKey,
	type NutrientTotal,
	roundForDisplay,
} from "@foundry/core";
import { fmt, type Messages } from "../../../i18n";
import type { Tokens } from "../../../theme";

export function displayAmount(
	nutrient: NutrientKey,
	total?: NutrientTotal,
	locale: Locale = "en",
): string {
	const amount = new Intl.NumberFormat(locale, { useGrouping: false }).format(
		roundForDisplay(nutrient, total?.amount ?? 0),
	);
	if (total?.incomplete) return `≥ ${amount}`;
	if (total?.qualified) return `~ ${amount}`;
	return String(amount);
}

export function targetLabel(group: GoalBounds, unit: string): string {
	if (group.min !== undefined && group.max !== undefined)
		return `${group.min}–${group.max} ${unit}`;
	if (group.min !== undefined) return `≥${group.min} ${unit}`;
	return `≤${group.max ?? 0} ${unit}`;
}

export function outcome(
	colors: Tokens,
	t: Messages,
	group: GoalBounds,
	total?: NutrientTotal,
): { label: string; color: string } {
	const evaluation = evaluateGoal(group, total);
	const unit = t.nutrition.units[NUTRIENT_UNITS[group.nutrient]];
	const amount = (value = 0) => roundForDisplay(group.nutrient, value);
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

/** Keep translated status copy consistent with the user's decimal separator. */
export function localizedGoalStatus(label: string, locale: Locale) {
	return label.replace(/\d+\.\d+/g, (value) =>
		new Intl.NumberFormat(locale, { useGrouping: false }).format(Number(value)),
	);
}
