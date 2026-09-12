import { canonicalJson } from "@workouts/core";
import type { ServingOption } from "@workouts/core/nutrition";
import type { PortionMemory } from "./nutrition-local-repository";

export type RememberedSelection = {
	readonly option: ServingOption;
	readonly quantity: number;
	readonly remembered: boolean;
	readonly reset: boolean;
};

export function foodSourceKey(
	kind: "shipped" | "personal",
	id: string,
): string {
	return `${kind}:${id}`;
}

export function servingKey(option: ServingOption): string {
	return canonicalJson({
		kind: option.kind,
		amount: option.amount,
		label: option.label,
		...(option.kind === "authored" && option.volumeMl !== undefined
			? { volumeMl: option.volumeMl }
			: {}),
	});
}

export function portionMemoryFor(
	option: ServingOption,
	quantity: number,
	baseUnit: "g" | "ml",
): PortionMemory {
	return {
		kind: option.kind,
		servingKey: servingKey(option),
		baseUnit,
		amount: option.amount,
		quantity,
		label: option.label,
	};
}

export function rememberedSelection(
	options: readonly ServingOption[],
	baseUnit: "g" | "ml",
	memory: PortionMemory | undefined,
): RememberedSelection | undefined {
	if (!memory || memory.baseUnit !== baseUnit) return undefined;
	if (
		!Number.isFinite(memory.amount) ||
		memory.amount <= 0 ||
		!Number.isFinite(memory.quantity) ||
		memory.quantity <= 0
	) {
		return undefined;
	}
	const authored = options.find(
		(option) =>
			option.kind === "authored" && servingKey(option) === memory.servingKey,
	);
	if (authored) {
		return {
			option: authored,
			quantity: memory.quantity,
			remembered: true,
			reset: false,
		};
	}
	const base = options.find(
		(option) => option.kind === "base-unit" && option.unit === baseUnit,
	);
	if (!base) return undefined;
	const totalAmount = memory.amount * memory.quantity;
	if (!Number.isFinite(totalAmount) || totalAmount <= 0) return undefined;
	return { option: base, quantity: totalAmount, remembered: true, reset: true };
}
