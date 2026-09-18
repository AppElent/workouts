import {
	formatQuantity,
	getShippedFood,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
	personalFoodSnapshotAtAmount,
	rescaleNutrients,
	shippedSourceMeta,
} from "@workouts/core/nutrition";
import { formatSnapshotAmount } from "./nutrition-one-off";
import type {
	ComboPart,
	ComboPartSnapshot,
	PersonalFood,
} from "./personal-food-repository";

/** Resolve stable references for each new log; one-offs keep their frozen figures. */
export function resolveComboPart(
	part: ComboPart,
	findPersonalFood: (id: string) => PersonalFood | undefined,
): ComboPartSnapshot {
	if (part.reference.kind === "oneOff") return part.snapshot;
	if (part.reference.kind === "personal") {
		const food = findPersonalFood(part.reference.foodId);
		if (!food) throw new Error("Combo source is missing.");
		return personalFoodSnapshotAtAmount(food, part.snapshot);
	}
	const food = getShippedFood(part.reference.foodId);
	if (!food) throw new Error("Combo source is missing.");
	const source = shippedSourceMeta(food);
	const scaled = rescaleNutrients(food.nutrients, part.snapshot.amount / 100);
	const { estimated: _estimated, ...snapshot } = part.snapshot;
	return {
		...snapshot,
		name: food.name,
		baseUnit: food.baseUnit,
		nutrients: Object.fromEntries(
			NUTRIENT_KEYS.map((key) => [key, scaled[key]]),
		) as Record<NutrientKey, NutrientValue>,
		provenance: {
			source: "shipped",
			sourceId: food.id,
			dataset: source.name,
			edition: source.edition,
			sourceCode: food.code,
			sourceName: food.sourceName,
			saltDerived: source.saltDerived,
		},
	};
}

/** Scaling a new log keeps the saved Combo and every snapshot property intact. */
export function scaleComboSnapshot<
	T extends {
		readonly quantity: number;
		readonly amount: number;
		readonly nutrients: Readonly<Record<NutrientKey, NutrientValue>>;
	},
>(snapshot: T, multiplier: number): T {
	if (!Number.isFinite(multiplier) || multiplier <= 0) {
		throw new Error("Combo multiplier must be greater than zero.");
	}
	const scaled = {
		...snapshot,
		quantity: snapshot.quantity * multiplier,
		amount: snapshot.amount * multiplier,
		nutrients: rescaleNutrients(snapshot.nutrients, multiplier),
	};
	if ("serving" in scaled && "baseUnit" in scaled) {
		const baseUnit = scaled.baseUnit;
		if (baseUnit === "g" || baseUnit === "ml" || baseUnit === "serving") {
			const serving = scaled.serving as { en: string; nl: string };
			const hasQuantity =
				serving.en.includes(" × ") && serving.nl.includes(" × ");
			return Object.assign(scaled, {
				serving: hasQuantity
					? {
							en: serving.en.replace(
								/ × [\d.,]+$/,
								` × ${formatQuantity(scaled.quantity, "en")}`,
							),
							nl: serving.nl.replace(
								/ × [\d.,]+$/,
								` × ${formatQuantity(scaled.quantity, "nl")}`,
							),
						}
					: formatSnapshotAmount(scaled.amount, baseUnit),
			});
		}
	}
	return scaled;
}
