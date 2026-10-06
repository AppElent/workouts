import { type Ref, useRef, useState } from "react";
import { Platform, TextInput } from "react-native";
import { parseGoalNumber } from "../../../../data/nutrition-goal-history";
import { radius, type, useTokens } from "../../../../theme";

export function formatGoalInput(value: string, locale: string): string {
	const parsed = parseGoalNumber(value);
	if (parsed === null || Number.isNaN(parsed)) return value;
	return parsed.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/**
 * The number is the field. Focus greys the saved value into the placeholder so
 * the first keystroke replaces it; leaving without typing keeps it.
 */
export function GoalNumberField({
	value,
	locale,
	accessibilityLabel,
	invalid,
	disabled,
	inputRef,
	onChange,
	onFocus,
	onBlur,
	onSubmitEditing,
}: {
	value: string;
	locale: string;
	accessibilityLabel: string;
	invalid: boolean;
	disabled: boolean;
	inputRef?: Ref<TextInput>;
	onChange: (value: string) => void;
	onFocus?: () => void;
	onBlur?: () => void;
	onSubmitEditing?: () => void;
}) {
	const colors = useTokens();
	const [buffer, setBuffer] = useState<string | null>(null);
	const original = useRef(value);
	const editing = buffer !== null;
	// Sized for the longest text it shows, so typing never reflows the row.
	const width =
		28 +
		11 *
			Math.max(
				3,
				formatGoalInput(editing ? original.current : value, locale).length,
				buffer?.length ?? 0,
			);
	return (
		<TextInput
			ref={inputRef}
			accessibilityLabel={accessibilityLabel}
			accessibilityValue={{ text: formatGoalInput(value, locale) }}
			value={editing ? buffer : formatGoalInput(value, locale)}
			placeholder={
				editing ? formatGoalInput(original.current, locale) : undefined
			}
			placeholderTextColor={colors.textFaint}
			selectionColor={colors.accent}
			keyboardType="decimal-pad"
			// iOS walks fields with the bar above the keyboard; Android has no bar.
			returnKeyType={Platform.OS === "android" ? "next" : undefined}
			editable={!disabled}
			onFocus={() => {
				original.current = value;
				setBuffer("");
				onFocus?.();
			}}
			onBlur={() => {
				setBuffer(null);
				onBlur?.();
			}}
			onChangeText={(text) => {
				setBuffer(text);
				onChange(text === "" ? original.current : text);
			}}
			onSubmitEditing={onSubmitEditing}
			style={{
				...type.control,
				width,
				minHeight: 44,
				paddingHorizontal: 10,
				borderRadius: radius.lg,
				borderCurve: "continuous",
				borderWidth: 1.5,
				borderColor: invalid
					? colors.danger
					: editing
						? colors.accent
						: "transparent",
				backgroundColor: editing ? colors.surface : colors.surface2,
				color: invalid ? colors.danger : colors.text,
				fontWeight: "700",
				textAlign: "right",
				fontVariant: ["tabular-nums"],
				opacity: disabled ? 0.5 : 1,
			}}
		/>
	);
}
