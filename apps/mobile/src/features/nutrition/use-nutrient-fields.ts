import type { NutrientKey, NutrientValue } from "@workouts/core/nutrition";
import { useRef, useState } from "react";
import { Keyboard, type TextInput } from "react-native";

/** A nutrient as typed: its kind, and the text of a value. */
export type NutrientInput = { kind: NutrientValue["kind"]; amount: string };

/** Label order: what you read on a package, "of which" rows indented. */
export const FOOD_NUTRIENT_ROWS: readonly {
	key: NutrientKey;
	indent?: boolean;
}[] = [
	{ key: "energy" },
	{ key: "protein" },
	{ key: "carbs" },
	{ key: "sugars", indent: true },
	{ key: "fat" },
	{ key: "saturatedFat", indent: true },
	{ key: "fibre" },
	{ key: "salt" },
];

const ORDER = FOOD_NUTRIENT_ROWS.map((row) => row.key);

/**
 * The eight nutrient fields of a food form: which one has focus, ‹ › through
 * them in label order, and Trace and Unknown from the keyboard bar. Leaving a
 * field empty keeps the value it had when it was focused.
 */
export function useNutrientFields({
	values,
	onChange,
}: {
	values: Readonly<Record<NutrientKey, NutrientInput>>;
	onChange: (key: NutrientKey, next: NutrientInput) => void;
}) {
	const [focused, setFocused] = useState<NutrientKey | null>(null);
	const inputs = useRef(new Map<NutrientKey, TextInput>());
	const before = useRef<NutrientInput | undefined>(undefined);
	const index = focused ? ORDER.indexOf(focused) : -1;
	const focus = (key: NutrientKey) =>
		requestAnimationFrame(() => inputs.current.get(key)?.focus());
	const set = (input: NutrientInput) => {
		if (!focused) return;
		onChange(focused, input);
		Keyboard.dismiss();
	};
	return {
		focused,
		focus,
		/** Props for one row's value field. */
		field: (key: NutrientKey) => ({
			inputRef: (input: TextInput | null) => {
				if (input) inputs.current.set(key, input);
				else inputs.current.delete(key);
			},
			onFocus: () => {
				before.current = values[key];
				setFocused(key);
			},
			onBlur: () => setFocused((current) => (current === key ? null : current)),
			onChange: (text: string) =>
				onChange(
					key,
					text
						? { kind: "value", amount: text }
						: (before.current ?? values[key]),
				),
		}),
		/** Handlers for the keyboard bar while a nutrient has focus. */
		bar: {
			visible: focused !== null,
			onTrace: () => set({ kind: "trace", amount: "" }),
			onUnknown: () => set({ kind: "absent", amount: "" }),
			onPrevious: index > 0 ? () => focus(ORDER[index - 1]) : undefined,
			onNext:
				index >= 0 && index < ORDER.length - 1
					? () => focus(ORDER[index + 1])
					: undefined,
		},
	};
}
