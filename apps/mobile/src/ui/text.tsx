/**
 * The only component allowed to set a font size. Screens pass a `variant`
 * name from the type ramp; a screen that reaches for `fontSize` is drift.
 * Colour comes from `useTokens()`; a caller's `style` still wins.
 */
import { createContext, useContext } from "react";
import { Text, type TextProps } from "react-native";
import { type as typeRamp, useTokens } from "../theme";

type Variant = keyof typeof typeRamp;
type Props = TextProps & { variant?: Variant };

/** Variants whose ink is the secondary colour; everything else is primary. */
const MUTED: ReadonlySet<Variant> = new Set<Variant>([
	"label",
	"caption",
	"secondary",
	"footnote",
]);

/**
 * Caps Dynamic Type for every `AppText` inside, for a region that must not grow
 * past its share of the screen (the session dock). A text's own
 * `maxFontSizeMultiplier` still wins.
 */
export const TextScaleCap = createContext<number | undefined>(undefined);

export function AppText({ variant = "body", style, ...rest }: Props) {
	const tokens = useTokens();
	const cap = useContext(TextScaleCap);
	const color = MUTED.has(variant) ? tokens.textMuted : tokens.text;
	return (
		<Text
			maxFontSizeMultiplier={cap}
			style={[typeRamp[variant], { color }, style]}
			{...rest}
		/>
	);
}
