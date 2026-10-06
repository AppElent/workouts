import type { ServingOption } from "@workouts/core/nutrition";
import { useState } from "react";
import { servingKey } from "../../../data/nutrition-shortcuts";
import { useI18n } from "../../../i18n";

/**
 * The serving and quantity an amount editor is setting. The exact amount is
 * kept as it was until the person changes the quantity or the serving, so an
 * unchanged edit never drifts through rounding.
 */
export function useAmountSelection({
	option,
	quantity: initialQuantity,
	amount: initialAmount,
}: {
	option: ServingOption;
	quantity: number;
	amount: number;
}) {
	const { locale } = useI18n();
	const asText = (value: number) =>
		locale === "nl" ? String(value).replace(".", ",") : String(value);
	const [initial] = useState(() => ({
		option,
		amount: initialAmount,
	}));
	const [selected, setSelected] = useState<ServingOption>(option);
	const [quantityText, setQuantityText] = useState(() =>
		asText(initialQuantity),
	);
	const [amount, setAmount] = useState(initialAmount);
	const quantity = Number(quantityText.replace(",", "."));
	const valid =
		quantityText.trim().length > 0 &&
		Number.isFinite(quantity) &&
		quantity > 0 &&
		Number.isFinite(amount) &&
		amount > 0;
	return {
		selected,
		quantityText,
		quantity,
		amount,
		valid,
		/** The serving or the amount differs from where the editor started. */
		changed:
			amount !== initial.amount ||
			servingKey(selected) !== servingKey(initial.option),
		setQuantity(text: string) {
			setQuantityText(locale === "nl" ? text.replace(".", ",") : text);
			setAmount(Number(text.replace(",", ".")) * selected.amount);
		},
		select(next: ServingOption) {
			if (servingKey(next) === servingKey(selected)) return;
			const nextQuantity =
				next.kind === "base-unit" && next.unit !== "serving" ? 100 : 1;
			setSelected(next);
			setAmount(nextQuantity * next.amount);
			setQuantityText(asText(nextQuantity));
		},
	};
}

export type AmountSelection = ReturnType<typeof useAmountSelection>;
