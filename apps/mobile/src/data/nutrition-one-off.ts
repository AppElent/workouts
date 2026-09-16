import type { NutritionDiarySnapshot } from "@workouts/core";
import {
	formatQuantity,
	NUTRIENT_KEYS,
	type NutrientKey,
	type NutrientValue,
} from "@workouts/core/nutrition";

export function positiveCookingNumber(value: string, label: string): number {
	const parsed = Number(value.replace(",", ".").trim());
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`${label} must be greater than zero.`);
	}
	return parsed;
}

export function formatSnapshotAmount(
	amount: number,
	baseUnit: "g" | "ml" | "serving",
) {
	return {
		en: `${formatQuantity(amount, "en")} ${baseUnit === "serving" ? "serving(s)" : baseUnit}`,
		nl: `${formatQuantity(amount, "nl")} ${baseUnit === "serving" ? "portie(s)" : baseUnit}`,
	};
}

/** A reviewed one-off estimate is intake without creating a reusable Food. */
export function oneOffLogSnapshot(input: {
	date: string;
	meal: NutritionDiarySnapshot["meal"];
	name: { readonly en: string; readonly nl: string };
	amount: number;
	baseUnit?: "g" | "ml" | "serving";
	nutrients: Partial<Record<NutrientKey, NutrientValue>>;
	clientEntryId: string;
	note?: string;
}): NutritionDiarySnapshot & { readonly clientEntryId: string } {
	if (!Number.isFinite(input.amount) || input.amount <= 0) {
		throw new Error("Log once amount must be greater than zero.");
	}
	const nutrients = {} as Record<NutrientKey, NutrientValue>;
	for (const key of NUTRIENT_KEYS) {
		const nutrient = input.nutrients[key] ?? { kind: "absent" };
		if (
			nutrient.kind === "value" &&
			(!Number.isFinite(nutrient.amount) || nutrient.amount < 0)
		) {
			throw new Error(`${key} must be zero or greater.`);
		}
		nutrients[key] = nutrient;
	}
	const baseUnit = input.baseUnit ?? "serving";
	return {
		date: input.date,
		meal: input.meal,
		name: input.name,
		serving: formatSnapshotAmount(input.amount, baseUnit),
		quantity: 1,
		amount: input.amount,
		baseUnit,
		nutrients,
		estimated: true,
		provenance: { source: "oneOff" },
		clientEntryId: input.clientEntryId,
	};
}
