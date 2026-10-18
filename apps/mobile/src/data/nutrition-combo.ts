import {
	combinedNutrients,
	foodSnapshotAtAmount,
	getShippedFood,
	type LibraryFood,
	type NutrientKey,
	type NutrientValue,
	rescaleToQuantity,
	roundForDisplay,
} from "@workouts/core/nutrition";
import type {
	Combo,
	ComboPart,
	ComboPartSnapshot,
	PersonalFood,
} from "./personal-food-repository";

/** Resolve stable references for each new log; one-offs keep their frozen figures. */
export function resolveComboPart(
	part: Pick<ComboPart, "reference" | "snapshot">,
	findPersonalFood: (id: string) => PersonalFood | undefined,
): ComboPartSnapshot {
	const { reference } = part;
	if (reference.kind === "oneOff") return part.snapshot;
	let source: LibraryFood | undefined;
	if (reference.kind === "personal") {
		const food = findPersonalFood(reference.foodId);
		source = food && { kind: "personal", food };
	} else {
		const food = getShippedFood(reference.foodId);
		source = food && { kind: "shipped", food };
	}
	if (!source) throw new Error("Combo source is missing.");
	return foodSnapshotAtAmount(source, part.snapshot);
}

/** One part's choice for a single log: left out, or an "only this time" amount. */
export type ComboPartChoice = {
	readonly included: boolean;
	readonly once?: ComboPartSnapshot;
};

export type ComboLogPart = {
	readonly part: ComboPart;
	readonly included: boolean;
	readonly once?: ComboPartSnapshot;
	/**
	 * What this part logs for one whole Combo: current figures from its
	 * referenced Food, at the saved or "only this time" amount. Until the Food
	 * resolves it shows the saved snapshot and `resolved` is false.
	 */
	readonly snapshot: ComboPartSnapshot;
	readonly resolved: boolean;
};

/**
 * A Combo log before it is written: the preview and the logged Diary Entries
 * both come from these snapshots, so what is shown is what is logged.
 */
export type ComboLogPlan = {
	readonly parts: readonly ComboLogPart[];
	readonly included: readonly ComboLogPart[];
	/** Parts whose source is an Unavailable Food; they stay off. */
	readonly missing: readonly ComboPart[];
	/** Per whole Combo, before the Combo Scale. */
	readonly nutrients: Record<NutrientKey, NutrientValue>;
};

export function comboLogPlan(
	combo: Combo,
	choices: Readonly<Record<string, ComboPartChoice>>,
	findPersonalFood: (id: string) => PersonalFood | undefined,
): ComboLogPlan {
	const parts = combo.parts.map((part): ComboLogPart => {
		// A part whose source is gone stays off: there is nothing to log it from.
		if (part.status === "missing") {
			return {
				part,
				included: false,
				snapshot: part.snapshot,
				resolved: false,
			};
		}
		const choice = choices[part.id] ?? { included: true };
		const chosen = choice.once ?? part.snapshot;
		try {
			return {
				part,
				...choice,
				snapshot: resolveComboPart(
					{ reference: part.reference, snapshot: chosen },
					findPersonalFood,
				),
				resolved: true,
			};
		} catch {
			return { part, ...choice, snapshot: chosen, resolved: false };
		}
	});
	const included = parts.filter((item) => item.included);
	return {
		parts,
		included,
		missing: combo.parts.filter((part) => part.status === "missing"),
		nutrients: combinedNutrients(
			included.map(({ snapshot }) => snapshot.nutrients),
		),
	};
}

/** The Diary Entry snapshots a plan logs at a whole-Combo Combo Scale. */
export function comboLogEntries(
	plan: ComboLogPlan,
	scale: number,
): ComboPartSnapshot[] {
	if (!Number.isFinite(scale) || scale <= 0) {
		throw new Error("Combo multiplier must be greater than zero.");
	}
	if (plan.included.length === 0) throw new Error("Nothing to log.");
	return plan.included.map(({ snapshot, resolved }) => {
		if (!resolved) throw new Error("Combo source is missing.");
		return rescaleToQuantity(snapshot, snapshot.quantity * scale);
	});
}

/**
 * A Combo's own kcal, summed from the snapshots it was saved with.
 *
 * A part's `nutrients` are already the figures for the amount that part logs —
 * the same values the diary prints per entry — so this sums them rather than
 * rescaling by `quantity`.
 */
export function comboEnergy(combo: Combo): number | undefined {
	let total = 0;
	let known = false;
	for (const part of combo.parts) {
		const energy = part.snapshot.nutrients.energy;
		if (energy.kind !== "value") continue;
		known = true;
		total += energy.amount;
	}
	return known ? roundForDisplay("energy", total) : undefined;
}
