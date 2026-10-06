import { type Ref, useState } from "react";
import { TextInput } from "react-native";
import { type, useTokens } from "../../../../theme";

/**
 * A value that is its own field. Focus greys the current value into the
 * placeholder so the first keystroke replaces it; leaving empty keeps it.
 */
export function PersonalFoodValueField({
	display,
	accessibilityLabel,
	inputRef,
	onChange,
	onFocus,
	onBlur,
	keyboardType = "decimal-pad",
	align = "right",
	emphasis = true,
	width,
}: {
	/** What the field shows when idle: a number, "—" or a word such as "Trace". */
	display: string;
	accessibilityLabel: string;
	inputRef?: Ref<TextInput>;
	/** Called on every keystroke; "" means "back to the value from before". */
	onChange: (text: string) => void;
	onFocus?: () => void;
	onBlur?: () => void;
	keyboardType?: "decimal-pad" | "default";
	align?: "left" | "right" | "center";
	emphasis?: boolean;
	width?: number;
}) {
	const colors = useTokens();
	const [buffer, setBuffer] = useState<string | null>(null);
	const editing = buffer !== null;
	return (
		<TextInput
			ref={inputRef}
			accessibilityLabel={accessibilityLabel}
			accessibilityValue={{ text: display }}
			value={editing ? buffer : display}
			placeholder={editing ? display : undefined}
			placeholderTextColor={colors.textFaint}
			selectionColor={colors.accent}
			keyboardType={keyboardType}
			onFocus={() => {
				setBuffer("");
				onFocus?.();
			}}
			onChangeText={(text) => {
				setBuffer(text);
				onChange(text.trim());
			}}
			onBlur={() => {
				setBuffer(null);
				onBlur?.();
			}}
			style={{
				...type.secondary,
				minWidth: width ?? 64,
				minHeight: 40,
				paddingVertical: 6,
				textAlign: align,
				color: colors.text,
				fontWeight: emphasis ? "700" : "400",
				fontVariant: ["tabular-nums"],
			}}
		/>
	);
}
