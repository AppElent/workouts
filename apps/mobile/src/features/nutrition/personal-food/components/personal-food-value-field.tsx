import { type Ref, useImperativeHandle, useRef, useState } from "react";
import { Pressable, TextInput } from "react-native";
import { type, useTokens } from "../../../../theme";
import { AppText } from "../../../../ui/text";

/**
 * A value that is its own field. Focus greys the current value into the
 * placeholder so the first keystroke replaces it; leaving empty keeps it.
 * The unit after it belongs to the field: tapping "g" edits the number too.
 */
export function PersonalFoodValueField({
	display,
	unit,
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
	/** Shown after the value, such as "g" or "kcal"; empty keeps its space. */
	unit?: string;
	accessibilityLabel: string;
	inputRef?: Ref<TextInput | null>;
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
	const input = useRef<TextInput>(null);
	useImperativeHandle(inputRef, () => input.current as TextInput);
	const editing = buffer !== null;
	const field = (
		<TextInput
			ref={input}
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
	if (unit === undefined) return field;
	return (
		<Pressable
			accessible={false}
			onPress={() => input.current?.focus()}
			style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}
		>
			{field}
			<AppText variant="footnote" style={{ width: 30, marginLeft: 4 }}>
				{unit}
			</AppText>
		</Pressable>
	);
}
