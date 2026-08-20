/**
 * The only component allowed to set a font size. Screens pass a `variant`
 * name from the type ramp; a screen that reaches for `fontSize` is drift.
 */
import { Text, type TextProps } from "react-native";
import { type as typeRamp } from "../theme";

type Props = TextProps & { variant?: keyof typeof typeRamp };

export function AppText({ variant = "body", style, ...rest }: Props) {
	return <Text style={[typeRamp[variant], style]} {...rest} />;
}
