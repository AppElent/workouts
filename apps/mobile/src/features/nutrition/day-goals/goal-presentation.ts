import { type NutrientTotal, roundForDisplay } from "@workouts/core/nutrition";
import {
	type NutrientGoal,
	type NutrientKey,
	nutrientUnit,
} from "../../../data/nutrition-day";
import { fmt, type Messages } from "../../../i18n";
import type { Tokens } from "../../../theme";
export type GoalGroup = {
	nutrient: NutrientKey;
	min?: number;
	max?: number;
};

export function groupGoals(
	goals: readonly NutrientGoal[],
	displayOrder: readonly NutrientKey[],
): GoalGroup[] {
	const grouped = new Map<NutrientKey, GoalGroup>();
	for (const goal of goals) {
		const group = grouped.get(goal.nutrient) ?? { nutrient: goal.nutrient };
		group[goal.direction] = goal.target;
		grouped.set(goal.nutrient, group);
	}
	return displayOrder.flatMap((nutrient) => {
		const group = grouped.get(nutrient);
		return group ? [group] : [];
	});
}

export function displayAmount(
	nutrient: NutrientKey,
	total?: NutrientTotal,
	locale: "en" | "nl" = "en",
): string {
	const amount = new Intl.NumberFormat(locale, { useGrouping: false }).format(
		roundForDisplay(nutrient, total?.amount ?? 0),
	);
	if (total?.incomplete) return `≥ ${amount}`;
	if (total?.qualified) return `~ ${amount}`;
	return String(amount);
}

export function targetLabel(group: GoalGroup, unit: string): string {
	if (group.min !== undefined && group.max !== undefined)
		return `${group.min}–${group.max} ${unit}`;
	if (group.min !== undefined) return `≥${group.min} ${unit}`;
	return `≤${group.max ?? 0} ${unit}`;
}

export function outcome(
	colors: Tokens,
	t: Messages,
	group: GoalGroup,
	total?: NutrientTotal,
): { label: string; color: string } {
	if (!total || total.entryCount === 0)
		return { label: t.nutrition.goals.state.neutral, color: colors.textMuted };
	if (total.incomplete)
		return { label: t.nutrition.goals.incomplete, color: colors.textMuted };
	if (total.qualified)
		return { label: t.nutrition.goals.approximate, color: colors.textMuted };
	const amount = total.amount;
	const unit = t.nutrition.units[nutrientUnit(group.nutrient)];
	if (group.min !== undefined && group.max !== undefined) {
		if (amount < group.min)
			return {
				label: fmt(t.nutrition.goals.toRange, {
					amount: roundForDisplay(group.nutrient, group.min - amount),
					unit,
				}),
				color: colors.accent,
			};
		if (amount > group.max)
			return {
				label: fmt(t.nutrition.goals.over, {
					amount: roundForDisplay(group.nutrient, amount - group.max),
					unit,
				}),
				color: colors.danger,
			};
		return { label: t.nutrition.goals.withinRange, color: colors.success };
	}
	if (group.min !== undefined) {
		return amount < group.min
			? {
					label: fmt(t.nutrition.goals.toMinimum, {
						amount: roundForDisplay(group.nutrient, group.min - amount),
						unit,
					}),
					color: colors.accent,
				}
			: { label: t.nutrition.goals.minimumMet, color: colors.success };
	}
	const max = group.max ?? 0;
	if (amount < max)
		return {
			label: fmt(t.nutrition.goals.remaining, {
				amount: roundForDisplay(group.nutrient, max - amount),
				unit,
			}),
			color: colors.accent,
		};
	if (amount === max)
		return { label: t.nutrition.goals.atMaximum, color: colors.accent };
	return {
		label: fmt(t.nutrition.goals.over, {
			amount: roundForDisplay(group.nutrient, amount - max),
			unit,
		}),
		color: colors.danger,
	};
}

/** Keep translated status copy consistent with the user's decimal separator. */
export function localizedGoalStatus(label: string, locale: "en" | "nl") {
	return label.replace(/\d+\.\d+/g, (value) =>
		new Intl.NumberFormat(locale, { useGrouping: false }).format(Number(value)),
	);
}
